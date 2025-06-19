/**
 * Trendmoon Agent Integration Tests
 */

import 'dotenv/config';
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { z } from 'zod';

import { Agent, defineSkill, type AgentConfig } from 'arbitrum-vibekit-core/src/agent.js';
import { getSocialAndMarketInsightsTool } from '../src/tools/socialAndMarketInsights.js';

describe('Trendmoon Agent - Integration Tests', () => {
  let agent: Agent<any, any>;
  let mcpClient: Client;
  let baseUrl: string;
  let testAgentConfig: AgentConfig;

  const port = 3456;

  beforeAll(async () => {
    console.log('🚀 Starting Trendmoon Agent for integration testing...');
    testAgentConfig = {
      name: 'Test Trendmoon Agent',
      version: '1.0.0',
      description: 'A test instance of the Trendmoon agent.',
      skills: [
        defineSkill({
          id: 'route-trendmoon-query',
          name: 'Route Trendmoon Query',
          description: 'Receives a natural-language query and routes it.',
          tags: ['crypto', 'analysis'],
          examples: ['What is the sentiment for Solana?'],
          inputSchema: z.object({ query: z.string().min(1) }),
          tools: [ getSocialAndMarketInsightsTool ],
          mcpServers: [{
            command: 'node',
            moduleName: 'trendmoon-mcp-server',
            env: { MCP_SERVER_PORT: process.env.MCP_SERVER_PORT || '50051' },
          }],
        }),
      ],
      url: 'localhost',
      capabilities: { streaming: false, pushNotifications: false },
    };
    const ORCHESTRATION_SYSTEM_PROMPT = `You are a helpful and expert crypto market analyst. Your job is to answer user questions based on data from tools.
        
        1.  Analyze the user's query to identify key entities like categories (narratives) and blockchains (chains).
        2.  You MUST call the 'get_social_and_market_insights' tool, passing the extracted entities as arguments. For example, for "DeFi coins on Arbitrum", you must call the tool with narrative: 'DeFi' and chain: 'Arbitrum'.
        3.  The tool will return JSON data. You must not output the raw JSON. Instead, synthesize it into a clear, helpful, human-readable answer.`;

    const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY || 'test-key' });
    agent = Agent.create(testAgentConfig, {
      llm: { model: openrouter(process.env.LLM_MODEL || 'openai/gpt-4o'), system: ORCHESTRATION_SYSTEM_PROMPT, },
      cors: true,
    });
    await agent.start(port);
    baseUrl = `http://localhost:${port}`;
    console.log(`✅ Agent started on ${baseUrl}`);
  }, 20000);

  // La configuration `afterAll` est correcte et ne change pas.
  afterAll(async () => {
    console.log('🛑 Shutting down test agent...');
    try {
      if (mcpClient) await mcpClient.close();
      if (agent) await agent.stop();
    } catch (error) { console.error('Error during cleanup:', error); }
  }, 15000);

  describe('Core Agent Functionality', () => {
    beforeAll(async () => {
      const transport = new SSEClientTransport(new URL(`${baseUrl}/sse`));
      mcpClient = new Client({ name: 'test-client', version: '1.0.0' });
      await mcpClient.connect(transport);
    });

    test('Agent should start and expose its skill', async () => {
      const tools = await mcpClient.listTools();
      expect(tools.tools).toHaveLength(1);
    });

    test('Should handle a query for a list of tokens by category', async () => {
      const result = await mcpClient.callTool({
        name: 'route-trendmoon-query',
        arguments: { query: 'Find top RWA coins' },
      });

      // 1. On extrait la chaîne de caractères JSON de la ressource
      const taskString = result.content[0].resource.text;
      const task = JSON.parse(taskString);

      // 2. On vérifie que la tâche a bien réussi
      expect(task.kind).toBe('task');
      expect(task.status.state).toBe('completed');

      // 3. On navigue dans la structure pour trouver les données brutes
      const rawResult = task.status.message.parts[0].text;

      // 4. On teste les données brutes retournées par l'outil
      expect(rawResult.filter.narrative).toBe('Real World Assets (RWA)');
      expect(rawResult.results).toBeInstanceOf(Array);
      expect(rawResult.results.length).toBeGreaterThan(0);
    }, 20000);

    test('Should handle a query for a detailed analysis of a single token', async () => {
      const result = await mcpClient.callTool({
        name: 'route-trendmoon-query',
        arguments: { query: 'What is the sentiment for Solana?' },
      });

      // 1. Extraire la Task
      const taskString = result.content[0].resource.text;
      const task = JSON.parse(taskString);

      // 2. Vérifier le statut
      expect(task.kind).toBe('task');
      expect(task.status.state).toBe('completed');

      // 3. Naviguer jusqu'au résultat brut
      const rawResult = task.status.message.parts[0].text;

      // 4. Tester le résultat brut
      expect(rawResult.token).toBe('Solana');
      expect(rawResult).toHaveProperty('social_posture');
    }, 20000);

    test('Should correctly process a query with platform and category via the hook', async () => {
      const result = await mcpClient.callTool({
        name: 'route-trendmoon-query',
        arguments: { query: 'Find top DeFi coins on Arbitrum' },
      });

      const taskString = result.content[0].resource.text;
      const task = JSON.parse(taskString);

      expect(task.kind).toBe('task');
      expect(task.status.state).toBe('completed');

      const rawResult = task.status.message.parts[0].text

      expect(rawResult.filter).toBeDefined();
      expect(rawResult.filter.narrative).toBe('Decentralized Finance (DeFi)');
      expect(rawResult.filter.chain).toBe('arbitrum-one');

    }, 20000);

    test('Should correctly process a query with a timeframe via the hook', async () => {

      const result = await mcpClient.callTool({
        name: 'route-trendmoon-query',
        arguments: { query: 'What are the top growing coins in the last 30 days?' },
      });

      const taskString = result.content[0].resource.text;
      const task = JSON.parse(taskString);

      expect(task.kind).toBe('task');
      expect(task.status.state).toBe('completed');

      const rawResult = task.status.message.parts[0].text;

      // console.log('[Timeframe Test] Echoed args from MCP:', rawResult);

      expect(rawResult.filter).not.toHaveProperty('timeframe');
      expect(rawResult.filter).toHaveProperty('start_date');
      expect(rawResult.filter).toHaveProperty('end_date');
      expect(rawResult.filter.start_date).toMatch(/^\d{4}-\d{2}-\d{2}/);
      expect(rawResult.filter.end_date).toMatch(/^\d{4}-\d{2}-\d{2}/);

    }, 20000);
  });
});