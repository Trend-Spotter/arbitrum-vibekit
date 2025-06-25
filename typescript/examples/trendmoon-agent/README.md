# Trendmoon Agent

A Vibekit agent that provides insights on social trends and market data for crypto tokens using the Trendmoon MCP server. This agent demonstrates integration with external data services through MCP (Model Context Protocol).

## Overview

The Trendmoon Agent provides:

- **Social Trend Analysis**: Track crypto token social metrics and sentiment
- **Market Data Insights**: Get comprehensive market performance data
- **Category Analysis**: Discover trending narratives and market sectors
- **Investment Insights**: Analyze tokens for investment opportunities
- **Real-time Data**: Access to live social and market data via Trendmoon API

## Features

### Core Capabilities

- ✅ Simple query interface - accepts natural language questions
- ✅ Intelligent entity resolution with caching system
- ✅ Automatic category and platform name resolution
- ✅ Timeframe parsing (7d, 1m, etc.)
- ✅ Integration with Trendmoon MCP server (25+ tools available)
- ✅ Context-aware hooks for data preprocessing
- ✅ Fallback to local data files when API unavailable

### Supported Queries

1. **Token Analysis**
   - "Analyze BTC social trends"
   - "What are the fundamentals for ETH?"
   - "Is SOL a good buy right now?"

2. **Market Discovery**
   - "What are the top meme tokens?"
   - "Find growing DeFi projects on Arbitrum"
   - "Show me trending narratives this week"

3. **Category Insights**
   - "Compare DeFi vs RWA performance"
   - "What's the fastest growing category?"
   - "Top alerts for today"

### Entity Resolution System

The agent includes intelligent entity resolution:

- **Categories**: "meme" → "Meme", "defi" → "DeFi" 
- **Platforms**: "arbitrum" → "Arbitrum", "solana" → "Solana"
- **Timeframes**: "7d" → last 7 days with specific dates
- **Caching**: 60-minute cache with MCP fallback to local files

## Quick Start

1. **Install dependencies**:
   ```bash
   pnpm install
   ```

2. **Set up environment**:
   ```bash
   cp .env.example .env
   # Add your required API keys:
   # OPENROUTER_API_KEY=your_openrouter_key
   # TRENDMOON_API_KEY=your_trendmoon_key
   ```

3. **Build the project**:
   ```bash
   pnpm build
   ```

4. **Run the agent**:
   ```bash
   pnpm start
   ```

5. **Test with curl**:
   ```bash
   curl -X POST -H "Content-Type: application/json" \
     -d '{"query": "What are the top meme tokens right now?"}' \
     http://localhost:3008
   ```

## Project Structure

```
trendmoon-agent/
├── src/
│   ├── index.ts           # Agent entry point with skill definition
│   ├── hooks/             # Entity resolution hooks
│   │   ├── index.ts       # Hook exports
│   │   └── entityResolutionHook.ts # Main entity resolution logic
│   ├── services/          # Business logic services
│   │   └── entityResolver.ts # Caching service for categories/platforms
│   ├── context/           # Context provider and types
│   │   ├── provider.ts    # Context initialization
│   │   └── types.ts       # TypeScript type definitions
│   ├── utils/             # Utility functions
│   │   └── timeframeParser.ts # Parse timeframe strings (7d, 1m, etc.)
│   └── data/              # Fallback data files
│       ├── categories.json # Crypto categories cache
│       └── plateforms.json # Blockchain platforms cache
├── test/                  # Integration tests
└── package.json
```

## MCP Integration

The agent connects to the Trendmoon MCP server which provides 25+ tools:

### Available Tools

- **Token Tools**: `searchCoins`, `getCoinDetails`, `getPlatforms`
- **Social Tools**: `getSocialTrend`, `getProjectSummary`, `searchSocialPosts`
- **Category Tools**: `getAllCategories`, `getCategoryCoins`, `getTopCategoriesToday`
- **Analysis Tools**: `getTopNarratives`, `getSocialAndMarketInsights`
- **Technical Tools**: `getHistoricalPrice`, `checkEMAPosition`

### Prompt Templates

- `detailedTokenAnalysis` - Comprehensive token analysis
- `topTokensList` - Ranked token lists with filters
- `tokenCatalysts` - Upcoming events and catalysts
- `availableFilterOptions` - Current filter options

## Environment Variables

| Variable               | Description                                    | Required |
| ---------------------- | ---------------------------------------------- | -------- |
| `OPENROUTER_API_KEY`   | OpenRouter API key for LLM                   | Yes      |
| `TRENDMOON_API_KEY`    | Trendmoon API key for market data            | Yes      |
| `PORT`                 | Server port (default: 3008)                  | No       |
| `LLM_MODEL`            | LLM model name (default: gemini-2.5-flash)   | No       |
| `TRENDMOON_API_URL`    | Trendmoon API URL (default: api.trendmoon.io)| No       |

## API Usage

### Request Format

```json
{
  "query": "Your natural language question about crypto trends"
}
```

### Example Requests

```bash
# Get trending meme tokens
curl -X POST -H "Content-Type: application/json" \
  -d '{"query": "What are the top 10 meme tokens?"}' \
  http://localhost:3008

# Analyze specific token
curl -X POST -H "Content-Type: application/json" \
  -d '{"query": "Analyze BTC social trends over the last week"}' \
  http://localhost:3008

# Find growing narratives
curl -X POST -H "Content-Type: application/json" \
  -d '{"query": "What narrative is growing fastest in crypto?"}' \
  http://localhost:3008
```

## Development

### Running in Development

```bash
pnpm dev
```

### Running Tests

```bash
pnpm test
```

**Note**: Some tests may take longer (up to 2 minutes) when calling `getSocialAndMarketInsights` and similar data-intensive MCP tools. The test timeout is configured for 120 seconds to accommodate these slower operations.

### Building

```bash
pnpm build
```

## Architecture

The Trendmoon Agent uses a modern MCP-based architecture:

1. **Query Processing**: Natural language queries are processed by the LLM
2. **Entity Resolution**: Hooks automatically resolve categories, platforms, and timeframes
3. **MCP Tool Selection**: LLM selects appropriate tools from the Trendmoon MCP server
4. **Data Retrieval**: Tools fetch real-time data from Trendmoon API
5. **Response Generation**: LLM formats the data into human-readable insights

This architecture ensures reliable data access with intelligent caching and fallback mechanisms.