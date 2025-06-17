// /tools/findCoinsByMindshare.ts
import { z } from 'zod';
import {
    type VibkitToolDefinition,
    type SuccessTask,
    withHooks,
    createSuccessTask,
    createErrorTask,
    VibkitError
} from 'arbitrum-vibekit-core';
import {entityResolutionHook} from "../hooks/entityResolutionHook.js";

// --- 1. Tool Parameters Schema ---
const FindCoinsByMindshareParams = z.object({
    category_name: z.string().describe("The name of the category to analyze. E.g., 'Meme', 'AI', 'DeFi'."),
});

// --- 2. The Base Tool Definition (Core Logic) ---
const baseFindCoinsByMindshareTool: VibkitToolDefinition<typeof FindCoinsByMindshareParams> = {
    name: 'find_coins_by_mindshare_in_category',
    description: "Finds the most popular cryptocurrencies (measured by social 'mindshare') within a specific category for today. Use for questions about 'most discussed' or 'trending' tokens in a sector.",
    parameters: FindCoinsByMindshareParams,

    // The 'execute' function contains the core business logic.
    execute: async (args, context) => {
        console.log(`[Tool:find_coins_by_mindshare] Executing with args:`, args);

        // Get the MCP client in a safe way
        const mcpClient = context.mcpClients?.['trendmoon-mcp-server'];
        if (!mcpClient) {
            return createErrorTask(
                'find-mindshare',
                new VibkitError('ClientError', -32603, 'Trendmoon MCP client not available in context.'),
            );
        }

        try {
            // --- Implement your Query Flow using mcpClient.callTool ---

            // Step 1: Get coins for the category
            const categoryCoinsResponse = await mcpClient.callTool({
                name: 'get_category_coins',
                arguments: { category_name: args.category_name, top_n: 100 },
            });
            const coin_ids = categoryCoinsResponse.content?.coin_ids;

            if (!coin_ids || coin_ids.length === 0) {
                return createSuccessTask(
                    'find-mindshare',
                    undefined, // no artifacts
                    { message: `No coins found for category: ${args.category_name}`, data: [] } // a successful task with an empty result
                );
            }

            // Step 2: Get social trends for these coins
            const today = new Date().toISOString().split('T')[0];
            const socialTrendsResponse = await mcpClient.callTool({
                name: 'get_social_trends',
                arguments: { coin_ids, start_date: today, end_date: today, interval: '1d' },
            });
            const socialData = socialTrendsResponse.content;

            // Step 3: Process/Rank data (assuming this logic is here or on the MCP)
            // For this example, we'll just sort by mentions and take the top 5
            const rankedCoins = socialData
                .sort((a: any, b: any) => (b.mentions || 0) - (a.mentions || 0))
                .slice(0, 5);

            console.log('[Tool:find_coins_by_mindshare] Successfully processed data.');

            // Return a success task with the RAW ranked data. The hook will format it.
            return createSuccessTask(
                'find-mindshare',
                undefined, // no artifacts
                rankedCoins, // The payload is the array of ranked coin objects
            );

        } catch (error) {
            console.error('[Tool:find_coins_by_mindshare] Error:', error);
            return createErrorTask(
                'find-mindshare',
                new VibkitError(
                    'MCPError',
                    -32603,
                    `Failed to fetch mindshare data: ${error instanceof Error ? error.message : String(error)}`,
                ),
            );
        }
    },
};

// --- 3. The 'after' Hook for Response Formatting ---
async function formatMindshareResponseHook(task: SuccessTask): Promise<SuccessTask> {
    console.log('[Hook:formatMindshareResponse] Formatting the result...');

    // The raw data is in `task.result`
    const rankedCoins = task.result as any[];

    if (!rankedCoins || rankedCoins.length === 0) {
        task.message = `No trending coins found.`;
        return task;
    }

    // Create a human-readable string from the data
    const formattedList = rankedCoins.map((coin, index) =>
        `${index + 1}. ${coin.name} ($${coin.symbol}) - Mentions: ${coin.mentions}, Daily Change: ${coin.daily_percent_change}%`
    ).join('\n');

    task.message = `Here are the top coins by mindshare today:\n${formattedList}`;

    // The hook must return the modified task object
    return task;
}


// --- 4. Export the Tool Wrapped with the Hook ---
export const findCoinsByMindshareTool = withHooks(baseFindCoinsByMindshareTool, {
    before: entityResolutionHook,
    after: formatMindshareResponseHook, // 'after' hook for formatting the final response
});