import { z } from 'zod';
import {
  type VibkitToolDefinition,
  createSuccessTask,
  createErrorTask,
  VibkitError,
  withHooks,
} from 'arbitrum-vibekit-core';
import { entityResolutionHook } from '../hooks/index.js';

const GetTopNarrativesSchema = z.object({
  time_period: z
    .enum(["24h", "7d", "30d"])
    .default("7d")
    .describe("The time period to analyze for narrative growth"),
  limit: z
    .number()
    .min(1)
    .max(100)
    .default(20)
    .describe("Number of top narratives to return (1-100)"),
  sort_by: z
    .enum([
      "category_mindshare_dominance",
      "category_market_cap", 
      "category_mindshare_pct_change",
      "market_cap_pct_change"
    ])
    .default("category_mindshare_dominance")
    .describe("Field to sort narratives by: mindshare dominance, market cap, mindshare growth, or market cap growth"),
  sort_order: z
    .enum(["asc", "desc"])
    .default("desc")
    .describe("Sort order: 'asc' for ascending, 'desc' for descending")
});

const baseGetTopNarratives: VibkitToolDefinition<typeof GetTopNarrativesSchema> = {
  name: 'get_top_narratives',
  description: 'Get the most trending market narratives (categories like RWA, AI, DeFi, Meme) ranked by mindshare dominance, market cap, or growth metrics. Perfect for queries like "top narratives of the day by mindshare" or "fastest growing narratives by market cap".',
  parameters: GetTopNarrativesSchema,

  execute: async (args, context) => {
    const mcpClient = context.mcpClients?.['trendmoon-mcp-server'];
    if (!mcpClient) {
      return createErrorTask(
        'mcp-client-error',
        new VibkitError('ClientError', -32603, 'Trendmoon MCP client not available.'),
      );
    }

    try {
      console.log(`[Tool:get_top_narratives] Calling MCP with parameters:`, {
        time_period: args.time_period,
        sort_by: args.sort_by,
        sort_order: args.sort_order,
        limit: args.limit
      });

      const mcpResponse = await mcpClient.callTool({
        name: 'getTopNarratives',
        arguments: {
          time_period: args.time_period,
          limit: args.limit,
          sort_by: args.sort_by,
          sort_order: args.sort_order
        }
      });

      console.log('[DEBUG] MCP Response:', JSON.stringify(mcpResponse, null, 2));
      
      if (!mcpResponse.content || !Array.isArray(mcpResponse.content) || mcpResponse.content.length === 0) {
        return createErrorTask('mcp-call-error', new VibkitError('ExecutionError', -32603, 'No content in MCP response.'));
      }

      // Extract the formatted text response
      let formattedText = '';
      for (const content of mcpResponse.content) {
        if (content.type === 'text') {
          formattedText = content.text;
          break;
        }
      }

      const finalMessage = formattedText || 'Successfully retrieved top narratives data. Check the structured data for details.';
      
      return createSuccessTask('narratives-retrieved', undefined, finalMessage);

    } catch (error) {
      console.error(`[Tool:get_top_narratives] Error during MCP call:`, error);
      return createErrorTask('mcp-call-error', new VibkitError('ExecutionError', -32603, 'Failed to get top narratives from the Trendmoon MCP server.'));
    }
  },
};

export const getTopNarratives = withHooks(baseGetTopNarratives, {
  before: entityResolutionHook,
}); 