import { z } from 'zod';
import {
    type VibkitToolDefinition,
    type SuccessTask,
    withHooks,
    createSuccessTask,
    createErrorTask,
    VibkitError
} from 'arbitrum-vibekit-core';
import { entityResolutionHook } from "../hooks/entityResolutionHook.js";

const GetTopCoinsInCategoryParams = z.object({
    category_name: z.string().describe("The name of the category to list coins for. E.g., 'Real World Assets (RWA)', 'Gaming'."),
});

const baseGetTopCoinsInCategoryTool: VibkitToolDefinition<typeof GetTopCoinsInCategoryParams> = {
    name: 'get_top_coins_in_category',
    description: "Provides a list of the top cryptocurrencies within a specific category, sorted by a combined score or social dominance. Useful for 'top X in Y' list requests.",
    parameters: GetTopCoinsInCategoryParams,
    execute: async (args, context) => {
        console.log(`[Tool:get_top_coins_in_category] Executing for category: ${args.category_name}`);
        const mcpClient = context.mcpClients?.['trendmoon-mcp-server'];
        if (!mcpClient) {
            return createErrorTask('get-top-coins', new VibkitError('ClientError', -32603, 'Trendmoon MCP client not available.'));
        }

        try {
            // Let the MCP server handle the sorting and limiting
            const topCoinsResponse = await mcpClient.callTool({
                name: 'get_category_coins',
                arguments: { category_name: args.category_name, top_n: 10, sort_by: 'combined_score' },
            });

            return createSuccessTask('get-top-coins', undefined, { category: args.category_name, coins: topCoinsResponse.content });
        } catch (error) {
            console.error(`[Tool:get_top_coins_in_category] Error for ${args.category_name}:`, error);
            return createErrorTask('get-top-coins', new VibkitError('MCPError', -32603, `Failed to fetch top coins for ${args.category_name}.`));
        }
    },
};

async function formatTopCoinsResponseHook(task: SuccessTask): Promise<SuccessTask> {
    const { category, coins } = task.result as any;

    if (!coins || coins.length === 0) {
        task.message = `I couldn't find any top coins for the category: ${category}.`;
        return task;
    }

    const formattedList = coins.map((coin: any, index: number) =>
        `${index + 1}. **${coin.name} ($${coin.symbol.toUpperCase()})** - Score: ${coin.score}`
    ).join('\n');

    task.message = `Here are the top coins to invest in **${category}** today:\n${formattedList}`;
    return task;
}

export const getTopCoinsInCategoryTool = withHooks(baseGetTopCoinsInCategoryTool, {
    before: entityResolutionHook,
    after: formatTopCoinsResponseHook,
});