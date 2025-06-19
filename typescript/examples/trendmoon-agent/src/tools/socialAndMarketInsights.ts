import { z } from 'zod';
import {
    type VibkitToolDefinition,
    type SuccessTask,
    withHooks,
    createSuccessTask,
    createErrorTask,
    VibkitError
} from 'arbitrum-vibekit-core';
import { entityResolutionHook } from '../hooks/entityResolutionHook.js';

// Le schéma d'input est le même que celui défini sur le MCP server
const SocialAndMarketInsightsSchema = z.object({
    analysis_type: z
        .enum(["list", "detailed_summary", "catalyst_check"])
        .describe("The type of analysis to perform."),
    token_name: z.string().optional().describe("The name or symbol of the token (e.g., 'Solana', 'BTC')."),
    narrative: z.string().optional().describe("The category or narrative to filter by. For example: 'DeFi', 'RWA', 'Gaming', 'Meme'."),
    chain: z.string().optional().describe("The specific blockchain or platform to filter by. For example: 'Arbitrum', 'Solana', 'Ethereum'."),
    sort_by: z
        .enum(["mindshare_growth", "mindshare_total", "sentiment_positive"])
        .optional()
        .describe("The metric to sort results by."),
    time_period: z
        .enum(["24h", "7d", "30d"])
        .default("24h")
        .describe("The time period for analysis (e.g., '24h', '7d')."),

    // draft for LLM
    timeframe: z.string().optional().describe("A natural language description of a time period, e.g., 'last 7 days', 'past month'."),

    start_date: z.string().datetime().optional().describe("The start date for a custom time range (ISO 8601 format)."),
    end_date: z.string().datetime().optional().describe("The end date for a custom time range (ISO 8601 format)."),
});

const baseSocialAndMarketInsightsTool: VibkitToolDefinition<typeof SocialAndMarketInsightsSchema> = {
    name: 'get_social_and_market_insights',
    description: "Provides insights on social trends and market data for crypto tokens. Use this for ALL questions about token performance, mindshare, sentiment, catalysts, or finding lists of tokens based on criteria.",
    parameters: SocialAndMarketInsightsSchema,

    execute: async (args, context) => {
        console.log(`[Tool:get_social_and_market_insights] Executing with analysis type: ${args.analysis_type}`);

        const mcpClient = context.mcpClients?.['trendmoon-mcp-server'];
        if (!mcpClient) {
            return createErrorTask('mcp-client-error', new VibkitError('ClientError', -32603, 'Trendmoon MCP client not available.'));
        }

        try {
            const mcpResponse = await mcpClient.callTool({
                name: 'getSocialAndMarketInsights',
                arguments: args
            });

            // On extrait le contenu JSON de la réponse du MCP
            const resultData = JSON.parse(mcpResponse.content[0].text);

            // On crée une SuccessTask. Le nom 'insights-retrieved' sera utilisé par le hook 'after' pour savoir quel formatage appliquer.
            return createSuccessTask('insights-retrieved', undefined, resultData);

        } catch (error) {
            console.error(`[Tool:get_social_and_market_insights] Error during MCP call:`, error);
            return createErrorTask('mcp-call-error', new VibkitError('ExecutionError', -32603, 'Failed to get insights from the Trendmoon MCP server.'));
        }
    },
};

async function formatInsightsResponseHook(task: SuccessTask): Promise<SuccessTask> {
    if (task.status.state === 'failed' || !task.result) {
        // On s'assure qu'il y a un message d'erreur clair et on retourne.
        task.status.message = task.status.message || "An unknown error occurred during tool execution.";
        return task;
    }

    const result = task.result as any;
    let message = "Here is the information I found:";

    // On utilise le 'result' qui est le JSON parsé de la réponse du MCP
    if (result.filter) { // C'est une réponse de type 'list'
        message = `**Top Tokens Matching Your Criteria:**\n\n`;
        if (result.results && result.results.length > 0) {
            result.results.forEach((token: any) => {
                message += `- **$${token.token}**: Mindshare Growth: ${token.mindshare_growth}%, Sentiment: ${token.sentiment}\n`;
            });
        } else {
            message += "I couldn't find any tokens matching your criteria.";
        }
    } else if (result.social_posture) { // C'est une réponse de type 'detailed_summary'
        message = `
**Analysis for $${result.token.toUpperCase()}**

- **Social Posture:** ${result.social_posture}
- **Summary:** ${result.summary}
- **Key Metrics:** Mindshare Growth (7d): ${result.key_metrics.mindshare_growth_7d * 100}%, Sentiment Score: ${result.key_metrics.sentiment_score}/10
        `.trim();
    } else if (result.upcoming_catalysts) { // C'est une réponse de type 'catalyst_check'
        message = `**Upcoming Catalysts for $${result.token.toUpperCase()}:**\n\n`;
        if (result.upcoming_catalysts.length > 0) {
            result.upcoming_catalysts.forEach((catalyst: any) => {
                message += `- **${catalyst.date}**: ${catalyst.event}\n`;
            });
        } else {
            message += "No specific upcoming catalysts found.";
        }
    }

    task.message = message;
    return task;
}

export const getSocialAndMarketInsightsTool = withHooks(baseSocialAndMarketInsightsTool, {
    before: entityResolutionHook,
    // Le hook 'after' s'exécute après un `execute` réussi pour formater la réponse
//    after: formatInsightsResponseHook,
});