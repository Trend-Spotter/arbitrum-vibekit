import { type HookFunction } from 'arbitrum-vibekit-core';
import { entityResolver } from '../services/entityResolver.js';
import { VibkitError } from 'arbitrum-vibekit-core';
import { parseTimeframe } from "../utils/timeframeParser.js";
import type { TrendmoonContext } from '../context/types.js';

export const entityResolutionHook: HookFunction<any, any, TrendmoonContext, any> = async (args: any, context): Promise<any> => {
    const mcpClient = context.mcpClients?.['trendmoon-mcp-server'];
    if (!mcpClient) {
        throw new VibkitError('ClientError', -32603, 'Trendmoon MCP client not available for entity resolution.');
    }

    await entityResolver.initialize(mcpClient);

    if (args.narrative) {
        const resolvedCategory = entityResolver.resolveCategory(args.narrative);
        if (!resolvedCategory) {
            throw new VibkitError('ValidationError', -32602, `Sorry, I don't recognize the category "${args.narrative}". Please try another one.`);
        }
        //console.log(`[Hook:entityResolution] Resolved category "${args.narrative}" to "${resolvedCategory}"`);
        args.narrative = resolvedCategory;
    }


    if (args.chain) {
        const resolvedPlatform = entityResolver.resolvePlatform(args.chain);
        if (!resolvedPlatform) {
            throw new VibkitError('ValidationError', -32602, `Sorry, I don't recognize the blockchain "${args.chain}". Please try another one.`);
        }
        //console.log(`[Hook:entityResolution] Resolved platform "${args.chain}" to "${resolvedPlatform}"`);
        args.chain = resolvedPlatform;
    }

    if (args.time_period) {
        const parsedDates = parseTimeframe(args.time_period);
        if (!parsedDates) {
            throw new VibkitError('ValidationError', -32602, `Sorry, I don't understand the timeframe "${args.time_period}". Please use formats like '7d', '2w', or '1m'.`);
        }

        /*
        console.log(`[Hook:entityResolution] Resolved timeframe "${args.time_period}" to start/end dates.`);
        console.log(`[Hook:entityResolution] Start date: ${parsedDates.startDate}`);
        console.log(`[Hook:entityResolution] End date: ${parsedDates.endDate}`);
         */

        args.start_date = parsedDates.startDate;
        args.end_date = parsedDates.endDate;
    }

    return args;
};