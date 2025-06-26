import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';

// --- Début des types et fonctions utilitaires ---
interface CanonicalEntity {
  id: string;
  name: string;
  aliases: string[];
}

function generateAliases(name: string): string[] {
  const aliases = new Set<string>();
  const lowerCaseName = name.toLowerCase();

  aliases.add(lowerCaseName);

  const acronymMatch = name.match(/\(([^)]+)\)/);
  if (acronymMatch && acronymMatch[1]) {
    aliases.add(acronymMatch[1].toLowerCase());
  }

  const textBeforeParentheses = name.split('(')[0]?.trim();
  if (textBeforeParentheses && textBeforeParentheses.toLowerCase() !== lowerCaseName) {
    aliases.add(textBeforeParentheses.toLowerCase());
  }

  return Array.from(aliases);
}

// --- Calcul du répertoire source ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fallbackDir = path.join(__dirname, '..', 'data');

class EntityResolver {
  private static instance: EntityResolver;
  private categories: CanonicalEntity[] = [];
  private platforms: CanonicalEntity[] = [];
  private isInitialized = false;
  private lastCacheTime: number = 0;

  private constructor() {}

  public static getInstance(): EntityResolver {
    if (!EntityResolver.instance) {
      EntityResolver.instance = new EntityResolver();
    }
    return EntityResolver.instance;
  }

  public async initialize(mcpClient: any) {
    const cacheDurationMinutes = parseInt(process.env.ENTITY_CACHE_DURATION_MINUTES || '60', 10);
    const cacheDurationMs = cacheDurationMinutes * 60 * 1000;

    if (this.isInitialized && Date.now() - this.lastCacheTime < cacheDurationMs) {
      return;
    }

    console.log('[EntityResolver] Cache is stale or not initialized. Refreshing...');

    try {
      // ÉTAPE 1 : On essaie de récupérer les données fraîches depuis le serveur MCP
      console.log('[EntityResolver] Attempting to fetch fresh data from MCP server...');
      const [categoriesRes, platformsRes] = await Promise.all([
        mcpClient.callTool({
          name: 'getAllCategories',
          arguments: {},
        }),
        mcpClient.callTool({
          name: 'getPlatforms',
          arguments: {},
        }),
      ]);

      // Debug: Log the actual response structures
      console.log('[EntityResolver] Categories response structure:', JSON.stringify(categoriesRes, null, 2));
      console.log('[EntityResolver] Platforms response structure:', JSON.stringify(platformsRes, null, 2));

      // Parse the response content properly
      let categoryNames: string[] = [];
      let platformNames: string[] = [];

      // Extract categories from response
      if (categoriesRes.content && categoriesRes.content.length > 0) {
        const categoryContent = categoriesRes.content[0];
        if (categoryContent.type === 'text') {
          try {
            categoryNames = JSON.parse(categoryContent.text);
          } catch (e) {
            console.warn('[EntityResolver] Failed to parse categories response as JSON:', categoryContent.text);
          }
        }
      }

      // Extract platforms from response
      if (platformsRes.content && platformsRes.content.length > 0) {
        // First try to get from structuredContent (new format)
        if (platformsRes.structuredContent && platformsRes.structuredContent.platforms) {
          platformNames = platformsRes.structuredContent.platforms;
        } else {
          // Fallback to parsing text content (old format)
          const platformContent = platformsRes.content[0];
          if (platformContent.type === 'text') {
            try {
              platformNames = JSON.parse(platformContent.text);
            } catch (e) {
              console.warn('[EntityResolver] Failed to parse platforms response as JSON:', platformContent.text);
            }
          }
        }
      }

      this.populateCache(categoryNames, platformNames);
      console.log(`[EntityResolver] Successfully loaded cache from MCP server.`);
    } catch (mcpError) {
      // ÉTAPE 2 : Échec du serveur MCP, on utilise les fichiers JSON locaux comme fallback
      const errorMessage = mcpError instanceof Error ? mcpError.message : String(mcpError);
      console.warn('[EntityResolver] MCP server fetch failed:', errorMessage);
      console.log('[EntityResolver] Attempting to load cache from local files as fallback...');

      try {
        const categoriesPath = path.join(fallbackDir, 'categories.json');
        const platformsPath = path.join(fallbackDir, 'plateforms.json');

        const [categoriesBuffer, platformsBuffer] = await Promise.all([
          fs.readFile(categoriesPath, 'utf-8'),
          fs.readFile(platformsPath, 'utf-8'),
        ]);

        const categoryNames = JSON.parse(categoriesBuffer);
        const platformNames = JSON.parse(platformsBuffer);

        this.populateCache(categoryNames, platformNames);
        console.log(`[EntityResolver] Successfully loaded cache from local files.`);
      } catch (fallbackError) {
        const errorMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
        console.error('[EntityResolver] CRITICAL: Failed to load from both MCP server and local files.', errorMessage);
        this.isInitialized = false;
      }
    }
  }

  // Fonction privée pour peupler le cache, évite la duplication de code
  private populateCache(categoryNames: string[], platformNames: string[]) {
    this.categories = categoryNames.map((name) => ({
      id: name.toLowerCase().replace(/\s+/g, '-'),
      name: name,
      aliases: generateAliases(name),
    }));

    this.platforms = platformNames.map((name) => ({
      id: name,
      name: name,
      aliases: [name.toLowerCase()],
    }));

    this.isInitialized = true;
    this.lastCacheTime = Date.now();
    console.log(
      `[EntityResolver] Cache populated with ${this.categories.length} categories and ${this.platforms.length} platforms.`,
    );
  }

  public resolveCategory(alias: string): string | null {
    if (!alias) return null;
    const searchTerm = alias.toLowerCase().trim();
    const found = this.categories.find((cat) => cat.aliases.includes(searchTerm));
    return found ? found.name : null;
  }

  public resolvePlatform(alias: string): string | null {
    if (!alias) return null;
    const searchTerm = alias.toLowerCase().trim();
    const found = this.platforms.find(
      (plat) => plat.aliases.includes(searchTerm) || plat.name.toLowerCase().includes(searchTerm),
    );
    return found ? found.name : null;
  }
}

export const entityResolver = EntityResolver.getInstance();
