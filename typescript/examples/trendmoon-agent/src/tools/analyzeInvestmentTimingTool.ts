import { z } from 'zod';
import {
    type VibkitToolDefinition,
    type SuccessTask,
    withHooks,
    createSuccessTask,
    createErrorTask,
    VibkitError
} from 'arbitrum-vibekit-core';
import {parseTimeframe} from "../utils/timeframeParser.js";
import {entityResolutionHook} from "../hooks/entityResolutionHook.js";

const AnalyzeInvestmentTimingParams = z.object({
    symbol: z.string().describe('The ticker symbol of the cryptocurrency to analyze. E.g., SOL, BTC, ETH.'),
});

const baseAnalyzeInvestmentTimingTool: VibkitToolDefinition<typeof AnalyzeInvestmentTimingParams> = {
    name: 'analyze_investment_timing_for_coin',
    description: "Provides an aggregated analysis to determine if it's a good time to buy a specific cryptocurrency. Combines technical analysis (TA) and social sentiment.",
    parameters: AnalyzeInvestmentTimingParams,
    execute: async (args, context) => {
        console.log(`[Tool:analyze_investment_timing] Executing for symbol: ${args.symbol}`);

        const defaultTimeframe = parseTimeframe("14d")!;
        const startDate = args.start_date || defaultTimeframe.startDate;
        const endDate = args.end_date || defaultTimeframe.endDate;

        const mcpClient = context.mcpClients?.['trendmoon-mcp-server'];
        if (!mcpClient) {
            return createErrorTask('analyze-timing', new VibkitError('ClientError', -32603, 'Trendmoon MCP client not available.'));
        }

        try {
            // Step 1: Get social and price data in parallel
            const [socialResponse, priceResponse] = await Promise.all([
                mcpClient.callTool({ name: 'get_social_trend', arguments: { symbol: args.symbol, date_interval: 14, time_interval: '1d' } }),
                mcpClient.callTool({ name: 'fetch_ohlcv', arguments: { symbol: args.symbol, timeframe: '1d', limit: 14 } })
            ]);

            // Step 2: Pass raw data to analysis tools on the MCP server
            const [socialPosture, taSummary] = await Promise.all([
                mcpClient.callTool({ name: 'derive_social_posture', arguments: { social_data: socialResponse.content } }),
                mcpClient.callTool({ name: 'summarize_ta', arguments: { price_data: priceResponse.content } })
            ]);

            const finalAnalysis = {
                symbol: args.symbol,
                social: socialPosture.content,
                technical: taSummary.content,
            };

            return createSuccessTask('analyze-timing', undefined, finalAnalysis);
        } catch (error) {
            console.error(`[Tool:analyze_investment_timing] Error for ${args.symbol}:`, error);
            return createErrorTask('analyze-timing', new VibkitError('AnalysisError', -32603, `Failed to analyze ${args.symbol}.`));
        }
    },
};

async function formatAnalysisResponseHook(task: SuccessTask): Promise<SuccessTask> {
    const result = task.result as any;
    const { symbol, social, technical } = result;

    // Combine reasons for a final verdict
    const finalVerdict = `Overall sentiment suggests it is a **${social.posture || 'Neutral'}** time to consider an investment in $${symbol.toUpperCase()}.`;

    task.message = `
**Investment Timing Analysis for $${symbol.toUpperCase()}**

**Social Analysis:**
- **Posture:** ${social.posture || 'N/A'}
- **Reason:** ${social.reason || 'No specific reason found.'}

**Technical Analysis:**
- **RSI:** ${technical.rsi || 'N/A'}
- **Moving Averages:** ${technical.ma_cross || 'N/A'}
- **MACD Histogram:** ${technical.macd_hist || 'N/A'}

**Verdict:**
${finalVerdict}
*This is not financial advice. Please do your own research.*
  `.trim();
    return task;
}

export const analyzeInvestmentTimingTool = withHooks(baseAnalyzeInvestmentTimingTool, {
    before: entityResolutionHook,
    after: formatAnalysisResponseHook,
});