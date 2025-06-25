/**
 * Mock Trendmoon Tool for Testing
 * 
 * Provides demo responses when MCP servers are not available
 */

import { z } from 'zod';
import type { VibkitToolDefinition } from 'arbitrum-vibekit-core';
import { createSuccessTask } from 'arbitrum-vibekit-core';
import type { TrendmoonContext } from '../context/types.js';

const MockTrendmoonParams = z.object({
  query: z.string().describe('The user query about crypto trends')
});

export const dummyTool: VibkitToolDefinition<typeof MockTrendmoonParams, any, TrendmoonContext, any> = {
  name: 'get_crypto_trends',
  description: 'Get crypto trends and market insights (mock data for testing)',
  parameters: MockTrendmoonParams,
  execute: async (args, _context) => {
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const query = args.query.toLowerCase();
    let mockResponse = '';
    
    if (query.includes('meme') || query.includes('top')) {
      mockResponse = `**Top Meme Tokens (Demo Data):**

- **$PEPE**: +156% (24h) - High social buzz on Twitter
- **$SHIB**: +23% (24h) - Growing community engagement  
- **$DOGE**: +12% (24h) - Stable sentiment, whale activity
- **$FLOKI**: +45% (24h) - New partnership announcements

*Note: This is demo data for testing. Connect real Trendmoon API for live data.*`;
    } else if (query.includes('btc') || query.includes('bitcoin')) {
      mockResponse = `**BTC Social Analysis (Demo Data):**

- **Social Sentiment**: Bullish (8.2/10)
- **Mentions (24h)**: 45,672 (+18%)
- **Top Keywords**: "ETF", "institutional", "halving"
- **Whale Activity**: High accumulation detected
- **Price Catalyst**: ETF approval speculation

*Note: This is demo data for testing. Connect real Trendmoon API for live data.*`;
    } else if (query.includes('defi') || query.includes('arbitrum')) {
      mockResponse = `**Growing DeFi Projects on Arbitrum (Demo Data):**

- **$ARB**: Native token showing 34% growth in TVL
- **$GMX**: Perpetual trading platform, +67% volume
- **$MAGIC**: Gaming ecosystem, new partnerships
- **$RDNT**: Lending protocol, yield farming trending

*Note: This is demo data for testing. Connect real Trendmoon API for live data.*`;
    } else if (query.includes('narrative') || query.includes('trending')) {
      mockResponse = `**Trending Narratives This Week (Demo Data):**

1. **AI + Crypto**: Projects combining AI and blockchain (+89% mentions)
2. **RWA (Real World Assets)**: Tokenization trend (+134% growth)  
3. **Layer 2 Scaling**: Arbitrum and Optimism focus (+56% discussions)
4. **Gaming Tokens**: P2E games gaining traction (+78% activity)

*Note: This is demo data for testing. Connect real Trendmoon API for live data.*`;
    } else {
      mockResponse = `**Crypto Market Overview (Demo Data):**

I can help you with:
- Top meme tokens analysis
- Bitcoin/BTC social trends  
- DeFi projects on Arbitrum
- Trending narratives and themes
- Social sentiment analysis
- Market catalyst detection

Try asking: "What are the top meme tokens?" or "Analyze BTC social trends"

*Note: This is demo data for testing. Connect real Trendmoon API for live data.*`;
    }
    
    return createSuccessTask(
      'trendmoon-insights',
      undefined,
      mockResponse
    );
  },
};