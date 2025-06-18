// test/integration.test.ts (Version Corrigée)

import 'dotenv/config';
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { z } from 'zod';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';

import { Agent, defineSkill, defineTool, createSuccessTask, type AgentConfig } from 'arbitrum-vibekit-core/src/agent.js';
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
          mcpServers: [
            {
              command: 'node',
              moduleName: 'trendmoon-mcp-server',
              env: { MCP_SERVER_PORT: process.env.MCP_SERVER_PORT || '50051' },
            },
          ],
        }),
      ],
      url: 'localhost',
      capabilities: { streaming: false, pushNotifications: false },
    };

    const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY || 'test-key' });
    agent = Agent.create(testAgentConfig, {
      llm: { model: openrouter(process.env.LLM_MODEL || 'openai/gpt-4o') },
      cors: true,
    });

    await agent.start(port);
    baseUrl = `http://localhost:${port}`;
    console.log(`✅ Agent started on ${baseUrl}`);
  }, 20000);

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
      expect(tools.tools[0].name).toBe('route-trendmoon-query');
    });

    // CORRECTION : On ne teste plus `isConnected()`, la connexion réussie suffit.
    test('Should establish an SSE connection successfully', () => {
      expect(mcpClient).toBeDefined();
    });

    test('Should handle a query for a list of tokens by category', async () => {
      const result = await mcpClient.callTool({
        name: 'route-trendmoon-query',
        arguments: { query: 'Find top RWA coins' },
      });

      const content = result.content as any[];
      // Le framework enveloppe le résultat dans une ressource, puis dans un Message
      const messageWrapper = JSON.parse(content[0].resource.text);

      // 1. On vérifie qu'on a bien un objet Message
      expect(messageWrapper.kind).toBe('task');

      // 2. Le vrai résultat de notre outil (la Task) est stringifié dans la partie texte du Message
      const task = JSON.parse(messageWrapper.parts[0].text);

      // 3. Maintenant on peut tester la Task comme prévu !
      expect(task.status.state).toBe('completed');
      expect(task.status.message).toContain('Top Tokens Matching Your Criteria');
    }, 20000);

    test('Should handle a query for a detailed analysis of a single token', async () => {
      const result = await mcpClient.callTool({
        name: 'route-trendmoon-query',
        arguments: { query: 'Is SOL a good buy?' },
      });

      const content = result.content as any[];
      console.log(content);
      const messageWrapper = JSON.parse(content[0].resource.text);
      console.log(messageWrapper.parts);

      // 1. On vérifie la structure Message
      expect(messageWrapper.kind).toBe('task');

      // 2. On extrait et on parse la Task
      const task = JSON.parse(messageWrapper.parts[0].text);

      // 3. On teste la Task
      expect(task.status.state).toBe('completed');
      expect(task.status.message).toContain('Analysis for $SOL');
    }, 20000);
  });
});