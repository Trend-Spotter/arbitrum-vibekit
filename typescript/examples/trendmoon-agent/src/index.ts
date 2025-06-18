import 'dotenv/config';
import { Agent, type AgentConfig, defineSkill } from 'arbitrum-vibekit-core';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { z } from 'zod';

// --- Import all your defined tools ---
import { findCoinsByMindshareTool } from './tools/findCoinsByMindshare.js';
import { analyzeInvestmentTimingTool } from './tools/analyzeInvestmentTiming.js';
import { findFastestGrowingNarrativeTool } from './tools/findFastestGrowingNarrative.js';
import { getTopCoinsInCategoryTool } from './tools/getTopCoinsInCategory.js';
import { getFundamentalCatalystsTool } from './tools/getFundamentalCatalysts.js';
import { findGrowingCoinsByCategoryAndChainTool } from './tools/findGrowingCoinsByCategoryAndChain.js';
import {getSocialAndMarketInsightsTool} from "./tools/socialAndMarketInsights.js";

// --- The System Prompt for the Routing LLM ---
const ROUTING_SYSTEM_PROMPT = `You are an expert routing engine for the Trendmoon Agent. Your sole purpose is to analyze the user's query and match it to one of the available internal tools.
- Analyze the query to understand its intent and extract key entities (e.g., symbols, categories, chains).
- Select the single best tool that perfectly matches the user's request.
- You must call a tool. Never answer the user's question directly.`;

// --- The user's query will be wrapped in this object ---
const inputSchema = z.object({
    query: z.string().describe("The user's natural language question to be routed to the correct tool."),
});

// Create OpenRouter LLM provider instance
const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
});

// Agent Configuration
export const agentConfig: AgentConfig = {
    name: process.env.AGENT_NAME || 'Trendmoon Agent',
    version: process.env.AGENT_VERSION || '1.0.0',
    description: process.env.AGENT_DESCRIPTION || 'An intelligent agent that understands crypto market queries and routes them to the correct Trendmoon tool.',

    // This single skill acts as the main entry point and orchestrator
    skills: [
        defineSkill({
            id: 'route-trendmoon-query',
            name: 'Route Trendmoon Query',
            description: 'Receives a natural-language query about crypto markets and routes it to the appropriate internal tool for execution.',
            inputSchema,
            tags: ['crypto', 'analysis', 'sentiment'],
            examples: [
                'What is the sentiment for Solana?',
                'Find me the top growing RWA tokens.',
            ],
            // The tools the LLM can choose from are your defined business logic functions.
            tools: [
                /*
                findCoinsByMindshareTool,
                analyzeInvestmentTimingTool,
                findFastestGrowingNarrativeTool,
                getTopCoinsInCategoryTool,
                getFundamentalCatalystsTool,
                findGrowingCoinsByCategoryAndChainTool,

                 */
                getSocialAndMarketInsightsTool
            ],

            // This skill declares that it depends on your MCP server module.
            // The framework will start this server and provide a client in the context.
            mcpServers: [
                {
                    command: 'node',
                    // This must match the name of your npm package for the MCP server
                    moduleName: 'trendmoon-mcp-server',
                    // Pass any environment variables your MCP server needs to start
                    env: {
                        MCP_SERVER_PORT: process.env.MCP_SERVER_PORT || '50051',
                        TRENDMOON_API_KEY: process.env.TRENDMOON_API_KEY,
                    },
                },
            ],
            // NO HANDLER: The framework uses the LLM to orchestrate calling one of the listed `tools`.
        }),
    ],
    url: 'localhost',
    capabilities: { streaming: false, pushNotifications: false },
};

// Configure and start the agent
const agent = Agent.create(agentConfig, {
    cors: true,
    llm: {
        model: openrouter(process.env.LLM_MODEL || 'google/gemini-2.5-flash-preview'),
        system: ROUTING_SYSTEM_PROMPT,
    },
});

const PORT = parseInt(process.env.PORT || '3008', 10);
agent.start(PORT)
    .then(() => {
        console.log(`🚀 Trendmoon Agent running on port ${PORT}`);
        console.log(`📍 Base URL: http://localhost:${PORT}`);
        console.log(`🤖 Send a POST request to interact. Example:`);
        console.log(`   curl -X POST -H "Content-Type: application/json" -d '{"query": "Would SOL be at a good point to buy?"}' http://localhost:${PORT}`);
    })
    .catch((error) => console.error('Failed to start agent:', error));