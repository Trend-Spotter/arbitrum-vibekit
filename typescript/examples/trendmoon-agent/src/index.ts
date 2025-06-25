import 'dotenv/config';
import { Agent, type AgentConfig, defineSkill } from 'arbitrum-vibekit-core';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { z } from 'zod';
import { contextProvider } from './context/provider.js';
import type { TrendmoonContext } from './context/types.js';
import { getSocialAndMarketInsightsTool } from './tools/socialAndMarketInsights.js';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- The System Prompt for the Trendmoon Agent ---
const TRENDMOON_SYSTEM_PROMPT = `You are a Trendmoon Agent that provides insights on social trends and market data for crypto tokens. 

You have access to comprehensive market data tools that can:
- Analyze token performance with social metrics and market data
- Find trending narratives and top performing categories
- Provide investment insights and catalyst analysis
- Search and discover tokens by various criteria
- Track social sentiment and trending keywords

When responding to queries:
1. Use the available MCP tools to gather relevant data
2. Provide clear, actionable insights
3. Focus on social trends, market sentiment, and token performance
4. Format responses in a user-friendly way
5. Always base your analysis on the actual data returned from the tools

Available analysis types:
- 'list' for top tokens with filtering options
- 'detailed_summary' for deep dive analysis on one token  
- 'catalyst_check' for upcoming events and catalysts

You can filter by narrative (e.g., 'Meme', 'DeFi', 'RWA') and chain (e.g., 'Arbitrum', 'Solana').`;

// --- Simple input schema - just query ---
const inputSchema = z.object({
    query: z.string().describe("The user's natural language question about crypto trends and market data."),
});

// Create OpenRouter LLM provider instance
const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
});

// Agent Configuration
export const agentConfig: AgentConfig = {
    name: process.env.AGENT_NAME || 'Trendmoon Agent',
    version: process.env.AGENT_VERSION || '1.0.0',
    description: process.env.AGENT_DESCRIPTION || 'Provides insights on social trends and market data for crypto tokens. Use this for questions about mindshare, sentiment, catalysts, and token performance.',

    // Single skill that handles all trendmoon queries
    skills: [
        defineSkill({
            id: 'trendmoon-insights',
            name: 'Trendmoon Insights',
            description: 'Provides insights on social trends and market data for crypto tokens. Can return sorted lists or detailed analysis for one token, and suggests specialized prompts.',
            inputSchema,
            
            // Required properties
            tags: ['crypto', 'social-trends', 'market-data', 'sentiment-analysis'],
            examples: [
                'What are the top meme tokens right now?',
                'Analyze BTC social trends',
                'Find growing DeFi projects on Arbitrum',
                'What narrative is trending this week?'
            ],
            tools: [getSocialAndMarketInsightsTool], // Real tool for crypto insights

            // Connect to our MCP server to access all Trendmoon tools
            mcpServers: [
                {
                    // Use the actual trendmoon-mcp-server module
                    command: 'node',
                    moduleName: 'trendmoon-mcp-server',
                    env: {
                        TRENDMOON_API_KEY: process.env.TRENDMOON_API_KEY || '',
                        TRENDMOON_API_URL: process.env.TRENDMOON_API_URL || 'https://api.qa.trendmoon.ai',
                        LLM_API_KEY: process.env.OPENROUTER_API_KEY || '',
                        LLM_BASE_URL: process.env.LLM_BASE_URL || 'https://openrouter.ai/api/v1',
                        LLM_MODEL_NAME: process.env.LLM_MODEL || 'google/gemini-2.5-flash-preview',
                    },
                },
            ],
            
            // NO HANDLER: Let the LLM orchestrate using the MCP tools directly
            // The LLM will automatically discover and use available tools from the MCP server
        }),
    ],
    url: 'localhost',
    capabilities: { streaming: false, pushNotifications: false },
    defaultInputModes: ['application/json'],
    defaultOutputModes: ['application/json'],
};

// Configure and start the agent
const agent = Agent.create(agentConfig, {
    cors: true,
    llm: {
        model: openrouter(process.env.LLM_MODEL || 'google/gemini-2.5-flash-preview'),
        baseSystemPrompt: TRENDMOON_SYSTEM_PROMPT,
    },
});

const PORT = parseInt(process.env.PORT || '3008', 10);
agent.start(PORT, contextProvider)
    .then(() => {
        console.log(`🚀 Trendmoon Agent running on port ${PORT}`);
        console.log(`📍 Base URL: http://localhost:${PORT}`);
        console.log(`🤖 Send a POST request to interact. Examples:`);
        console.log(`   curl -X POST -H "Content-Type: application/json" -d '{"query": "What are the top meme tokens right now?"}' http://localhost:${PORT}`);
        console.log(`   curl -X POST -H "Content-Type: application/json" -d '{"query": "Analyze BTC social trends"}' http://localhost:${PORT}`);
    })
    .catch((error) => console.error('Failed to start agent:', error));