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

const FindGrowingCoinsParams = z.object({
    category_name: z.string().describe("The narrative or category. E.g., 'DeFi', 'Gaming'."),
    chain_name: z.string().describe("The name of the blockchain. E.g., 'Arbitrum', 'Solana', 'Base'."),
});

const baseFindGrowingCoinsTool: VibkitToolDefinition<typeof FindGrowingCoinsParams> = {
    name: 'find_growing_coins_by_category_and_chain',
    description: 'Finds the top-growing cryptocurrencies that belong to both a specific category AND a specific blockchain. Intersects lists to find gems.',
    parameters: FindGrowingCoinsParams,
    execute: async (args, context) => {
        console.log(`[Tool:find_growing_coins] Executing for ${args.category_name} on ${args.chain_name}`);
        const mcpClient = context.mcpClients?.['trendmoon-mcp-server'];
        if (!mcpClient) {
            return createErrorTask('find-growing-coins', new VibkitError('ClientError', -32603, 'Trendmoon MCP client not available.'));
        }

        try {
            // Step 1: Fetch coins from chain and category in parallel
            const [chainCoinsRes, categoryCoinsRes] = await Promise.all([
                mcpClient.callTool({ name: 'search_coins_by_chain', arguments: { chain: args.chain_name } }),
                mcpClient.callTool({ name: 'get_category_coins', arguments: { category_name: args.category_name, top_n: 250 } })
            ]);
            const chainCoinIds = new Set(chainCoinsRes.content?.map((c: any) => c.id));
            const categoryCoinIds = new Set(categoryCoinsRes.content?.map((c: any) => c.id));

            // Step 2: Intersect the two sets of coin IDs
            const intersectionIds = [...chainCoinIds].filter(id => categoryCoinIds.has(id));

            if (intersectionIds.length === 0) {
                return createSuccessTask('find-growing-coins', undefined, { ...args, coins: [] });
            }

            // Step 3: Get trends for the intersected coins and rank them
            const trendsResponse = await mcpClient.callTool({
                name: 'get_social_trends',
                arguments: { coin_ids: intersectionIds }
            });

            const rankedCoins = trendsResponse.content
                .sort((a: any, b: any) => (b.mentions_growth || 0) - (a.mentions_growth || 0))
                .slice(0, 5);

            return createSuccessTask('find-growing-coins', undefined, { ...args, coins: rankedCoins });
        } catch (error) {
            console.error('[Tool:find_growing_coins] Error:', error);
            return createErrorTask('find-growing-coins', new VibkitError('MCPError', -32603, `Failed to find growing coins.`));
        }
    },
};

async function formatGrowingCoinsResponseHook(task: SuccessTask): Promise<SuccessTask> {
    const { category_name, chain_name, coins } = task.result as any;

    if (!coins || coins.length === 0) {
        task.message = `No growing coins found at the intersection of the **${category_name}** category and the **${chain_name}** blockchain.`;
        return task;
    }

    const formattedList = coins.map((coin: any, index: number) =>
        `${index + 1}. **${coin.name} ($${coin.symbol.toUpperCase()})** - Social Growth: ${coin.mentions_growth}%`
    ).join('\n');

    task.message = `Here are the top growing coins in **${category_name}** on the **${chain_name}** blockchain:\n${formattedList}`;
    return task;
}

export const findGrowingCoinsByCategoryAndChainTool = withHooks(baseFindGrowingCoinsTool, {
    before: entityResolutionHook,
    after: formatGrowingCoinsResponseHook,
});