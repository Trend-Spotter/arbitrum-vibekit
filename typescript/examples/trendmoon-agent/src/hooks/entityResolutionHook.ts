import { type ToolExecutionContext } from 'arbitrum-vibekit-core';
import { entityResolver } from '../services/entityResolver.js';
import { VibkitError } from 'arbitrum-vibekit-core';
import { parseTimeframe } from "../utils/timeframeParser.js";

export async function entityResolutionHook(args: any, context: ToolExecutionContext): Promise<any> {
    const mcpClient = context.mcpClients?.['trendmoon-mcp-server'];
    if (!mcpClient) {
        throw new VibkitError('ClientError', -32603, 'Trendmoon MCP client not available for entity resolution.');
    }

    await entityResolver.initialize(mcpClient);

    if (args.category_name) {
        const resolvedCategory = entityResolver.resolveCategory(args.category_name);
        if (!resolvedCategory) {
            throw new VibkitError('ValidationError', -32602, `Sorry, I don't recognize the category "${args.category_name}". Please try another one.`);
        }
        console.log(`[Hook:entityResolution] Resolved category "${args.category_name}" to "${resolvedCategory}"`);
        args.category_name = resolvedCategory;
    }


    if (args.chain_name) {
        const resolvedPlatform = entityResolver.resolvePlatform(args.chain_name);
        if (!resolvedPlatform) {
            throw new VibkitError('ValidationError', -32602, `Sorry, I don't recognize the blockchain "${args.chain_name}". Please try another one.`);
        }
        console.log(`[Hook:entityResolution] Resolved platform "${args.chain_name}" to "${resolvedPlatform}"`);
        args.chain_name = resolvedPlatform;
    }

    if (args.timeframe) {
        const parsedDates = parseTimeframe(args.timeframe);
        if (!parsedDates) {
            throw new VibkitError('ValidationError', -32602, `Sorry, I don't understand the timeframe "${args.timeframe}". Please use formats like '7d', '2w', or '1m'.`);
        }

        console.log(`[Hook:entityResolution] Resolved timeframe "${args.timeframe}" to start/end dates.`);

        delete args.timeframe;
        args.start_date = parsedDates.startDate;
        args.end_date = parsedDates.endDate;
    }

    return args;
}