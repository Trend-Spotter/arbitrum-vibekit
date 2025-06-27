import * as fs from 'fs/promises';
import * as path from 'path';

interface CanonicalEntity { 
  id: string; 
  name: string; 
  aliases: string[]; 
}

function generateAliases(name: string): string[] {
  const aliases = new Set<string>();
  const lowerCaseName = name.toLowerCase();

  aliases.add(lowerCaseName);

  // Extract acronym from parentheses
  const acronymMatch = name.match(/\(([^)]+)\)/);
  if (acronymMatch && acronymMatch[1]) {
    aliases.add(acronymMatch[1].toLowerCase());
  }

  // Text before parentheses
  const textBeforeParentheses = name.split('(')[0]?.trim();
  if (textBeforeParentheses && textBeforeParentheses.toLowerCase() !== lowerCaseName) {
    aliases.add(textBeforeParentheses.toLowerCase());
  }

  // Common abbreviations and variations
  const commonMappings: Record<string, string[]> = {
    'decentralized finance (defi)': ['defi', 'decentralized finance'],
    'artificial intelligence (ai)': ['ai', 'artificial intelligence'],
    'non-fungible token (nft)': ['nft', 'non-fungible token'],
    'automated market maker (amm)': ['amm', 'automated market maker'],
    'decentralized exchange (dex)': ['dex', 'decentralized exchange'],
    'initial coin offering (ico)': ['ico', 'initial coin offering'],
    'arbitrum ecosystem': ['arbitrum'],
    'ethereum ecosystem': ['ethereum', 'eth'],
    'bitcoin ecosystem': ['bitcoin', 'btc'],
    'binance smart chain': ['bsc', 'bnb chain'],
    'polygon pos': ['polygon', 'matic'],
    'avalanche': ['avax'],
    'fantom': ['ftm'],
    'harmony': ['one'],
    'solana': ['sol'],
    'cardano': ['ada'],
    'polkadot': ['dot'],
    'chainlink': ['link'],
    'uniswap': ['uni'],
    'compound': ['comp'],
    'aave': ['aave'],
    'maker': ['mkr'],
    'yearn': ['yfi'],
    'synthetix': ['snx'],
    'the graph': ['grt'],
    'curve': ['crv'],
    'sushiswap': ['sushi'],
    'pancakeswap': ['cake'],
    'compound tokens': ['compound', 'comp'],
    'aave tokens': ['aave'],
    'curve ecosystem': ['curve', 'crv']
  };

  // Add common mappings
  const nameKey = lowerCaseName;
  if (commonMappings[nameKey]) {
    commonMappings[nameKey].forEach(alias => aliases.add(alias));
  }

  return Array.from(aliases);
}

function generateTokenAliases(tokenName: string): string[] {
  const aliases = new Set<string>();
  const lowerCaseName = tokenName.toLowerCase();

  aliases.add(lowerCaseName);

  // Add common symbols and variations
  const commonTokenMappings: Record<string, string[]> = {
    'ethereum': ['eth'],
    'bitcoin': ['btc'],
    'solana': ['sol'],
    'cardano': ['ada'],
    'binancecoin': ['bnb'],
    'dogecoin': ['doge'],
    'shiba-inu': ['shib'],
    'arbitrum': ['arb'],
    'optimism': ['op'],
    'polygon': ['matic'],
    'avalanche-2': ['avax'],
    'chainlink': ['link'],
    'uniswap': ['uni'],
    'litecoin': ['ltc'],
    'ripple': ['xrp'],
    'polkadot': ['dot'],
    'tron': ['trx'],
    'near-protocol': ['near'],
    'cosmos': ['atom'],
    'internet-computer': ['icp'],
    'vechain': ['vet'],
    'filecoin': ['fil'],
    'elrond-erd-2': ['egld'],
    'tezos': ['xtz'],
    'monero': ['xmr'],
    'ethereum-classic': ['etc'],
    'stellar': ['xlm'],
    'eos': ['eos'],
    'iota': ['miota'],
    'dash': ['dash'],
    'zcash': ['zec'],
    'maker': ['mkr'],
    'aave': ['aave'],
    'compound': ['comp'],
    'sushi': ['sushi'],
    'curve-dao-token': ['crv'],
    'decentraland': ['mana'],
    'the-sandbox': ['sand'],
    'axie-infinity': ['axs'],
    'gala': ['gala'],
    'immutable-x': ['imx'],
    'render-token': ['rndr'],
    'fetch-ai': ['fet'],
    'ocean-protocol': ['ocean'],
    'singularitynet': ['agix'],
    'injective-protocol': ['inj'],
    'celestia': ['tia'],
    'sui': ['sui'],
    'aptos': ['apt'],
    'pepe': ['pepe'],
    'floki': ['floki'],
    'bonk': ['bonk'],
    'dogwifhat': ['wif'],
    'book-of-meme': ['bome'],
    'cat-in-a-dogs-world': ['mew'],
    'slerf': ['slerf'],
    'popcat': ['popcat'],
    'wif-hat': ['wif'],
    'magacoin': ['maga'],
    'jeo-boden': ['boden'],
    'delysium': ['agix'], // Example of a token with a common alias that might be ambiguous
  };

  const nameKey = lowerCaseName;
  if (commonTokenMappings[nameKey]) {
    commonTokenMappings[nameKey].forEach(alias => aliases.add(alias));
  }

  // Add symbol if it's different from the name
  if (tokenName.includes('(') && tokenName.includes(')')) {
    const symbolMatch = tokenName.match(/\(([^)]+)\)/);
    if (symbolMatch && symbolMatch[1]) {
      aliases.add(symbolMatch[1].toLowerCase());
    }
  }

  return Array.from(aliases);
}

const projectRoot = process.cwd();
const CACHE_DIR = path.join(projectRoot, 'cache');
const FALLBACK_DIR = path.join(projectRoot, 'src/data');

class EntityResolver {
  private static instance: EntityResolver;
  private categories: CanonicalEntity[] = [];
  private platforms: CanonicalEntity[] = [];
  private tokens: CanonicalEntity[] = [];
  private categoriesMap: Map<string, string> = new Map();
  private platformsMap: Map<string, string> = new Map();
  private tokensMap: Map<string, string> = new Map();
  private isInitialized = false;
  private lastMemoryCacheTime: number = 0;

  private constructor() {}

  public static getInstance(): EntityResolver {
    if (!EntityResolver.instance) {
      EntityResolver.instance = new EntityResolver();
    }
    return EntityResolver.instance;
  }

  public async initialize(mcpClient: any) {
    const cacheDurationMs = parseInt(process.env.ENTITY_CACHE_DURATION_MINUTES || '60', 10) * 60 * 1000;

    if (this.isInitialized && (Date.now() - this.lastMemoryCacheTime < cacheDurationMs)) {
      console.log('[EntityResolver] In-memory cache is fresh. Using it.');
      return;
    }

    console.log('[EntityResolver] Cache is stale or not initialized.');
    await fs.mkdir(CACHE_DIR, { recursive: true });

    const latestCacheFile = await this.findLatestCacheFile('categories');
    if (latestCacheFile) {
      const fileTimestamp = this.getTimestampFromFilename(latestCacheFile);
      if (fileTimestamp && (Date.now() - fileTimestamp < cacheDurationMs)) {
        console.log('[EntityResolver] Found fresh disk cache. Loading from disk.');
        try {
          await this.loadCacheFromDisk(latestCacheFile);
          return;
        } catch (e) {
          const errorMessage = e instanceof Error ? e.message : String(e);
          console.warn('[EntityResolver] Failed to load from disk cache, will try to refresh.', errorMessage);
        }
      }
    }

    try {
      console.log('[EntityResolver] No valid cache found. Fetching from MCP server...');
      const [categoriesRes, platformsRes] = await Promise.all([
        mcpClient.callTool({ name: 'getAllCategories', arguments: {} }),
        mcpClient.callTool({ name: 'getPlatforms', arguments: {} }),
      ]);

      console.log('[EntityResolver] Categories response:', JSON.stringify(categoriesRes, null, 2));
      console.log('[EntityResolver] Platforms response:', JSON.stringify(platformsRes, null, 2));

      const categoryNames = JSON.parse(categoriesRes.content[0].text);
      
      // Handle different response formats for platforms
      let platformNames: string[];
      if (platformsRes.structuredContent && platformsRes.structuredContent.platforms) {
        platformNames = platformsRes.structuredContent.platforms;
      } else {
        platformNames = JSON.parse(platformsRes.content[0].text);
      }

      this.populateMemoryCache(categoryNames, platformNames);
      await this.writeCacheToDisk(categoryNames, platformNames);
      console.log('[EntityResolver] Successfully refreshed cache from server.');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn('[EntityResolver] MCP fetch failed. Falling back to static JSON files.', errorMessage);
      try {
        await this.loadCacheFromDisk(null, true);
        console.log(`[EntityResolver] Successfully loaded cache from static fallback files.`);
      } catch (fallbackError) {
        console.error('[EntityResolver] CRITICAL: Failed to load from MCP and fallback.', fallbackError);
      }
    }
  }

  private generatePlatformAliases(platformName: string): string[] {
    const aliases = new Set<string>();
    const lowerName = platformName.toLowerCase();
    
    aliases.add(lowerName);
    
    // Common platform mappings - privilégier les noms explicites
    const platformMappings: Record<string, string[]> = {
      'arbitrum-one': ['arbitrum', 'arbitrum one'],
      'binance-smart-chain': ['bsc', 'binance smart chain'],
      'polygon-pos': ['polygon', 'polygon pos'],
      'optimistic-ethereum': ['optimism', 'optimistic ethereum'],
      'avalanche': ['avalanche chain'],
      'fantom': ['fantom chain'],
      'ethereum': ['ethereum chain'],
      'bitcoin': ['bitcoin chain'],
      'harmony-shard-0': ['harmony', 'harmony one'],
      'huobi-token': ['huobi chain'],
      'klay-token': ['klaytn'],
      'okex-chain': ['okx chain'],
      'xdai': ['gnosis chain'],
      'near-protocol': ['near protocol'],
      'internet-computer': ['internet computer', 'dfinity'],
      'the-open-network': ['ton network'],
      'hedera-hashgraph': ['hedera'],
      'solana': ['solana chain'],
      'cardano': ['cardano chain'],
      'stellar': ['stellar chain'],
      'tron': ['tron chain']
    };

    if (platformMappings[lowerName]) {
      platformMappings[lowerName].forEach(alias => aliases.add(alias));
    }

    // Also add base name without hyphens/underscores
    const baseName = lowerName.replace(/[-_]/g, ' ').trim();
    if (baseName !== lowerName) {
      aliases.add(baseName);
      // Add first word of multi-word platforms
      const firstWord = baseName.split(' ')[0];
      if (firstWord && firstWord.length > 2) {
        aliases.add(firstWord);
      }
    }

    return Array.from(aliases);
  }

  private populateMemoryCache(categoryNames: string[], platformNames: string[]) {
    this.categories = categoryNames.map(name => ({ 
      id: name.toLowerCase().replace(/\s+/g, '-'), 
      name, 
      aliases: generateAliases(name) 
    }));
    this.platforms = platformNames.map(name => ({ 
      id: name, 
      name, 
      aliases: this.generatePlatformAliases(name)
    }));

    // Static list of common tokens with their canonical IDs (e.g., CoinGecko IDs)
    const commonTokens = [
      { id: 'eth', name: 'Ethereum', aliases: ['ethereum'] },
      { id: 'btc', name: 'Bitcoin', aliases: ['bitcoin'] },
      { id: 'sol', name: 'Solana', aliases: ['solana'] },
      { id: 'doge', name: 'Dogecoin', aliases: ['dogecoin'] },
      { id: 'shib', name: 'Shiba Inu', aliases: ['shiba-inu'] },
      { id: 'arb', name: 'Arbitrum', aliases: ['arbitrum'] },
      { id: 'op', name: 'Optimism', aliases: ['optimism'] },
      { id: 'matic', name: 'Polygon', aliases: ['polygon'] },
      { id: 'avax', name: 'Avalanche', aliases: ['avalanche-2'] },
      { id: 'bnb', name: 'Binance Coin', aliases: ['binancecoin'] },
      { id: 'ada', name: 'Cardano', aliases: ['cardano'] },
      { id: 'xrp', name: 'XRP', aliases: ['ripple'] },
      { id: 'link', name: 'Chainlink', aliases: ['chainlink'] },
      { id: 'uni', name: 'Uniswap', aliases: ['uniswap'] },
      { id: 'ltc', name: 'Litecoin', aliases: ['litecoin'] },
      { id: 'dot', name: 'Polkadot', aliases: ['polkadot'] },
      { id: 'trx', name: 'TRON', aliases: ['tron'] },
      { id: 'near', name: 'NEAR Protocol', aliases: ['near-protocol'] },
      { id: 'atom', name: 'Cosmos', aliases: ['cosmos'] },
      { id: 'icp', name: 'Internet Computer', aliases: ['internet-computer'] },
      { id: 'vet', name: 'VeChain', aliases: ['vechain'] },
      { id: 'fil', name: 'Filecoin', aliases: ['filecoin'] },
      { id: 'egld', name: 'Elrond', aliases: ['elrond-erd-2'] },
      { id: 'xtz', name: 'Tezos', aliases: ['tezos'] },
      { id: 'xmr', name: 'Monero', aliases: ['monero'] },
      { id: 'etc', name: 'Ethereum Classic', aliases: ['ethereum-classic'] },
      { id: 'xlm', name: 'Stellar', aliases: ['stellar'] },
      { id: 'eos', name: 'EOS', aliases: ['eos'] },
      { id: 'miota', name: 'IOTA', aliases: ['iota'] },
      { id: 'dash', name: 'Dash', aliases: ['dash'] },
      { id: 'zec', name: 'Zcash', aliases: ['zcash'] },
      { id: 'mkr', name: 'Maker', aliases: ['maker'] },
      { id: 'aave', name: 'Aave', aliases: ['aave'] },
      { id: 'comp', name: 'Compound', aliases: ['compound'] },
      { id: 'sushi', name: 'Sushi', aliases: ['sushi'] },
      { id: 'crv', name: 'Curve DAO Token', aliases: ['curve-dao-token'] },
      { id: 'mana', name: 'Decentraland', aliases: ['decentraland'] },
      { id: 'sand', name: 'The Sandbox', aliases: ['the-sandbox'] },
      { id: 'axs', name: 'Axie Infinity', aliases: ['axie-infinity'] },
      { id: 'gala', name: 'Gala', aliases: ['gala'] },
      { id: 'imx', name: 'Immutable X', aliases: ['immutable-x'] },
      { id: 'rndr', name: 'Render Token', aliases: ['render-token'] },
      { id: 'fet', name: 'Fetch.ai', aliases: ['fetch-ai'] },
      { id: 'ocean', name: 'Ocean Protocol', aliases: ['ocean-protocol'] },
      { id: 'agix', name: 'SingularityNET', aliases: ['singularitynet'] },
      { id: 'inj', name: 'Injective Protocol', aliases: ['injective-protocol'] },
      { id: 'tia', name: 'Celestia', aliases: ['celestia'] },
      { id: 'sui', name: 'Sui', aliases: ['sui'] },
      { id: 'apt', name: 'Aptos', aliases: ['aptos'] },
      { id: 'pepe', name: 'Pepe', aliases: ['pepe'] },
      { id: 'floki', name: 'Floki', aliases: ['floki'] },
      { id: 'bonk', name: 'Bonk', aliases: ['bonk'] },
      { id: 'wif', name: 'dogwifhat', aliases: ['dogwifhat'] },
      { id: 'bome', name: 'Book of Meme', aliases: ['book-of-meme'] },
      { id: 'mew', name: 'Cat in a Dogs World', aliases: ['cat-in-a-dogs-world'] },
      { id: 'slerf', name: 'Slerf', aliases: ['slerf'] },
      { id: 'popcat', name: 'Popcat', aliases: ['popcat'] },
      { id: 'wif', name: 'WIF Hat', aliases: ['wif-hat'] },
      { id: 'maga', name: 'MAGA Coin', aliases: ['magacoin'] },
      { id: 'boden', name: 'Jeo Boden', aliases: ['jeo-boden'] },
    ];

    this.tokens = commonTokens.map(token => ({
      id: token.id,
      name: token.name,
      aliases: generateTokenAliases(token.name).concat(token.aliases)
    }));

    this.categoriesMap.clear();
    this.platformsMap.clear();
    this.tokensMap.clear();

    for (const cat of this.categories) {
      for (const alias of cat.aliases) {
        this.categoriesMap.set(alias, cat.name);
      }
    }

    for (const plat of this.platforms) {
      for (const alias of plat.aliases) {
        this.platformsMap.set(alias, plat.name);
      }
    }

    for (const token of this.tokens) {
      for (const alias of token.aliases) {
        this.tokensMap.set(alias, token.id);
      }
    }

    this.isInitialized = true;
    this.lastMemoryCacheTime = Date.now();
    console.log(`[EntityResolver] Memory cache populated with ${this.categories.length} categories, ${this.platforms.length} platforms, and ${this.tokens.length} tokens.`);
  }

  private async writeCacheToDisk(categories: string[], platforms: string[]) {
    const timestampUnix = Math.floor(Date.now() / 1000);
    const categoriesFile = path.join(CACHE_DIR, `categories_${timestampUnix}.json`);
    const platformsFile = path.join(CACHE_DIR, `platforms_${timestampUnix}.json`);
    
    // Clean old cache files first
    await this.cleanOldCacheFiles();
    
    await Promise.all([
      fs.writeFile(categoriesFile, JSON.stringify(categories, null, 2)),
      fs.writeFile(platformsFile, JSON.stringify(platforms, null, 2)),
    ]);
    console.log(`[EntityResolver] Wrote fresh cache to disk with timestamp: ${timestampUnix}`);
  }

  private async cleanOldCacheFiles() {
    try {
      const files = await fs.readdir(CACHE_DIR);
      for (const file of files) {
        if (file.startsWith('categories_') || file.startsWith('platforms_')) {
          await fs.unlink(path.join(CACHE_DIR, file));
        }
      }
    } catch (error) {
      console.warn('[EntityResolver] Failed to clean old cache files:', error);
    }
  }

  private async loadCacheFromDisk(baseFilename: string | null, useFallback = false) {
    let categoriesPath, platformsPath;

    if (useFallback) {
      categoriesPath = path.join(FALLBACK_DIR, 'categories.json');
      platformsPath = path.join(FALLBACK_DIR, 'platforms.json');
    } else if (baseFilename) {
      categoriesPath = path.join(CACHE_DIR, baseFilename);
      platformsPath = path.join(CACHE_DIR, baseFilename.replace('categories', 'platforms'));
    } else {
      throw new Error("No filename provided for disk cache loading.");
    }

    const [categoriesBuffer, platformsBuffer] = await Promise.all([
      fs.readFile(categoriesPath, 'utf-8'),
      fs.readFile(platformsPath, 'utf-8'),
    ]);
    this.populateMemoryCache(JSON.parse(categoriesBuffer), JSON.parse(platformsBuffer));
  }

  private async findLatestCacheFile(prefix: 'categories' | 'platforms'): Promise<string | null> {
    try {
      const files = await fs.readdir(CACHE_DIR);
      const cacheFiles = files
        .filter(file => file.startsWith(prefix) && file.endsWith('.json'))
        .sort()
        .reverse();
      return cacheFiles.length > 0 ? (cacheFiles[0] ?? null) : null;
    } catch {
      return null;
    }
  }

  private getTimestampFromFilename(filename: string): number | null {
    const match = filename.match(/_(\d+)\.json$/);
    if (match?.[1]) {
      return parseInt(match[1], 10) * 1000;
    }
    return null;
  }

  public resolveCategory(alias: string): string | null {
    if (!alias) return null;
    const searchTerm = alias.toLowerCase().trim();
    
    const exactMatch = this.categoriesMap.get(searchTerm);
    if (exactMatch) return exactMatch;
    
    for (const [key, value] of this.categoriesMap) {
      if (key.includes(searchTerm) || searchTerm.includes(key)) {
        return value;
      }
    }
    
    return null;
  }

  public resolvePlatform(alias: string): string | null {
    if (!alias) return null;
    const searchTerm = alias.toLowerCase().trim();
    
    // Check exact match first
    const exactMatch = this.platformsMap.get(searchTerm);
    if (exactMatch) return exactMatch;
    
    // Handle ambiguous cases: prefer platform over token symbol
    const ambiguousTerms: Record<string, string | null> = {
      'sol': 'solana', // SOL token vs Solana platform
      'avax': 'avalanche', // AVAX token vs Avalanche platform  
      'matic': 'polygon-pos', // MATIC token vs Polygon platform
      'ftm': 'fantom', // FTM token vs Fantom platform
      'ada': 'cardano', // ADA token vs Cardano platform
      'dot': null, // DOT token - no platform match in our list
      'eth': 'ethereum', // ETH token vs Ethereum platform
      'btc': 'bitcoin', // BTC token vs Bitcoin platform
      'bnb': 'binance-smart-chain', // BNB token vs BSC platform
      'one': 'harmony-shard-0', // ONE token vs Harmony platform
      'near': 'near-protocol', // NEAR token vs NEAR platform
    };
    
    if (searchTerm in ambiguousTerms) {
      const platformName = ambiguousTerms[searchTerm];
      if (platformName !== null) {
        return platformName!;
      }
    }
    
    // Standard partial matching
    for (const [key, value] of this.platformsMap) {
      if (key.includes(searchTerm) || searchTerm.includes(key)) {
        return value;
      }
    }
    
    return null;
  }

  public resolveToken(alias: string): string | null {
    console.log(`[EntityResolver] Attempting to resolve token alias: '${alias}'`);
    if (!alias) {
      console.log('[EntityResolver] Alias is empty.');
      return null;
    }
    const searchTerm = alias.toLowerCase().trim();
    console.log(`[EntityResolver] Search term: '${searchTerm}'`);

    // Check exact match first
    const exactMatch = this.tokensMap.get(searchTerm);
    if (exactMatch) {
      console.log(`[EntityResolver] Exact match found for '${searchTerm}': '${exactMatch}'`);
      return exactMatch;
    }
    console.log(`[EntityResolver] No exact match for '${searchTerm}'.`);

    // Standard partial matching
    for (const [key, value] of this.tokensMap) {
      if (key.includes(searchTerm) || searchTerm.includes(key)) {
        console.log(`[EntityResolver] Partial match found: key='${key}', value='${value}' for search term '${searchTerm}'`);
        return value;
      }
    }
    console.log(`[EntityResolver] No partial match found for '${searchTerm}'.`);

    return null;
  }

  /**
   * Get all available category names
   * @returns Array of category names
   */
  public getAvailableCategories(): string[] {
    return this.categories.map((cat) => cat.name);
  }

  /**
   * Get all available platform names
   * @returns Array of platform names
   */
  public getAvailablePlatforms(): string[] {
    return this.platforms.map((plat) => plat.name);
  }

  /**
   * Get cache statistics
   * @returns Object with cache info
   */
  public getCacheInfo() {
    return {
      isInitialized: this.isInitialized,
      categoriesCount: this.categories.length,
      platformsCount: this.platforms.length,
      lastCacheTime: this.lastMemoryCacheTime,
      cacheAge: Date.now() - this.lastMemoryCacheTime,
    };
  }
}

export const entityResolver = EntityResolver.getInstance();