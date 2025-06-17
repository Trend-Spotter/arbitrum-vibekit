import { z } from 'zod';
import {
    type VibkitToolDefinition,
    type SuccessTask,
    withHooks,
    createSuccessTask,
    createErrorTask,
    VibkitError
} from 'arbitrum-vibekit-core';

const FindFastestGrowingNarrativeParams = z.object({}); // No parameters

const baseFindFastestGrowingNarrativeTool: VibkitToolDefinition<typeof FindFastestGrowingNarrativeParams> = {
    name: 'find_fastest_growing_narrative',
    description: 'Identifies the market category or narrative that has shown the highest growth recently, based on performance or score metrics.',
    parameters: FindFastestGrowingNarrativeParams,
    execute: async (args, context) => {
        console.log(`[Tool:find_fastest_growing_narrative] Executing.`);
        const mcpClient = context.mcpClients?.['trendmoon-mcp-server'];
        if (!mcpClient) {
            return createErrorTask('find-narrative', new VibkitError('ClientError', -32603, 'Trendmoon MCP client not available.'));
        }

        try {
            const topCategoriesResponse = await mcpClient.callTool({ name: 'get_top_categories_today', arguments: {} });
            // Assume the MCP returns a sorted list and we just need the first one.
            const topNarrative = topCategoriesResponse.content?.[0];

            if (!topNarrative) {
                return createErrorTask('find-narrative', new VibkitError('DataError', -32603, 'No category data returned from server.'));
            }

            return createSuccessTask('find-narrative', undefined, topNarrative);
        } catch (error) {
            console.error('[Tool:find_fastest_growing_narrative] Error:', error);
            return createErrorTask('find-narrative', new VibkitError('MCPError', -32603, 'Failed to fetch top narratives.'));
        }
    },
};

async function formatNarrativeResponseHook(task: SuccessTask): Promise<SuccessTask> {
    const narrative = task.result as any;
    task.message = `The narrative with the most growth lately is **${narrative.name}**, with a daily increase of **${narrative.day_perc_diff.toFixed(2)}%**.`;
    return task;
}

export const findFastestGrowingNarrativeTool = withHooks(baseFindFastestGrowingNarrativeTool, {
    after: formatNarrativeResponseHook,
});