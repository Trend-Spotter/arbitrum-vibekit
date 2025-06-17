
import { z } from 'zod';
import {
    type VibkitToolDefinition,
    type SuccessTask,
    withHooks,
    createSuccessTask,
    createErrorTask,
    VibkitError
} from 'arbitrum-vibekit-core';

const GetFundamentalCatalystsParams = z.object({
    symbol: z.string().describe("The ticker symbol of the cryptocurrency to analyze. E.g., 'ADA', 'ETH'."),
});

const baseGetFundamentalCatalystsTool: VibkitToolDefinition<typeof GetFundamentalCatalystsParams> = {
    name: 'get_fundamental_catalysts',
    description: 'Finds and summarizes recent or upcoming fundamental catalysts for a specific cryptocurrency, such as roadmap updates, partnership announcements, or major events.',
    parameters: GetFundamentalCatalystsParams,
    execute: async (args, context) => {
        console.log(`[Tool:get_fundamental_catalysts] Executing for symbol: ${args.symbol}`);
        const mcpClient = context.mcpClients?.['trendmoon-mcp-server'];
        if (!mcpClient) {
            return createErrorTask('get-catalysts', new VibkitError('ClientError', -32603, 'Trendmoon MCP client not available.'));
        }

        try {
            // Fetch summary and news in parallel for efficiency
            const [summaryResponse, newsResponse] = await Promise.all([
                mcpClient.callTool({ name: 'get_project_summary', arguments: { symbol: args.symbol, days_ago: 30 } }),
                mcpClient.callTool({ name: 'get_topic_news', arguments: { topic: args.symbol.toLowerCase() } })
            ]);

            const result = {
                symbol: args.symbol,
                overview: summaryResponse.content?.overview,
                catalysts: summaryResponse.content?.catalysts || [],
                upcoming_events: newsResponse.content?.upcoming_events || [],
            };

            return createSuccessTask('get-catalysts', undefined, result);
        } catch (error) {
            console.error(`[Tool:get_fundamental_catalysts] Error for ${args.symbol}:`, error);
            return createErrorTask('get-catalysts', new VibkitError('MCPError', -32603, `Failed to fetch catalysts for ${args.symbol}.`));
        }
    },
};

async function formatCatalystsResponseHook(task: SuccessTask): Promise<SuccessTask> {
    const { symbol, overview, catalysts, upcoming_events } = task.result as any;
    let message = `**Fundamental Summary for $${symbol.toUpperCase()}**\n\n**Overview:**\n${overview || 'No overview available.'}\n`;

    if (catalysts && catalysts.length > 0) {
        message += "\n**Recent & Upcoming Catalysts:**\n" + catalysts.map((c: string) => `- ${c}`).join('\n');
    }

    if (upcoming_events && upcoming_events.length > 0) {
        message += "\n**Related News & Events:**\n" + upcoming_events.map((e: string) => `- ${e}`).join('\n');
    }

    if (catalysts.length === 0 && upcoming_events.length === 0) {
        message += "\nNo specific catalysts or upcoming events found in the last 30 days.";
    }

    task.message = message;
    return task;
}

export const getFundamentalCatalystsTool = withHooks(baseGetFundamentalCatalystsTool, {
    after: formatCatalystsResponseHook,
});