import { VibkitError } from 'arbitrum-vibekit-core';
import * as fs from 'fs/promises';
import * as path from 'path';

interface CanonicalEntity { id: string; name: string; aliases: string[]; }

function generateAliases(name: string): string[] {
    const aliases = new Set<string>();
    const lowerCaseName = name.toLowerCase();

    aliases.add(lowerCaseName);

    const acronymMatch = name.match(/\(([^)]+)\)/);
    if (acronymMatch && acronymMatch[1]) {
        aliases.add(acronymMatch[1].toLowerCase());
    }

    const textBeforeParentheses = name.split('(')[0].trim();
    if (textBeforeParentheses && textBeforeParentheses.toLowerCase() !== lowerCaseName) {
        aliases.add(textBeforeParentheses.toLowerCase());
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
                    console.warn('[EntityResolver] Failed to load from disk cache, will try to refresh.', e.message);
                }
            }
        }

        try {
            console.log('[EntityResolver] No valid cache found. Fetching from MCP server...');
            const [categoriesRes, platformsRes] = await Promise.all([
                mcpClient.callTool({ name: 'getAllCategories', arguments: {} }),
                mcpClient.callTool({ name: 'getPlatforms', arguments: {} }),
            ]);

            const categoryNames = JSON.parse(categoriesRes.content[0].text);
            const platformNames = JSON.parse(platformsRes.content[0].text);

            this.populateMemoryCache(categoryNames, platformNames);
            await this.writeCacheToDisk(categoryNames, platformNames);
            console.log('[EntityResolver] Successfully refreshed cache from server.');

        } catch (error) {
            console.warn('[EntityResolver] MCP fetch failed. Falling back to static JSON files.', error.message);
            try {
                await this.loadCacheFromDisk(null, true);
                console.log(`[EntityResolver] Successfully loaded cache from static fallback files.`);
            } catch (fallbackError) {
                console.error('[EntityResolver] CRITICAL: Failed to load from MCP and fallback.', fallbackError);
            }
        }
    }

    private populateMemoryCache(categoryNames: string[], platformNames: string[]) {
        this.categories = categoryNames.map(name => ({ id: name.toLowerCase().replace(/\s+/g, '-'), name, aliases: generateAliases(name) }));
        this.platforms = platformNames.map(name => ({ id: name, name, aliases: [name.toLowerCase()] }));
        this.isInitialized = true;
        this.lastMemoryCacheTime = Date.now();
        console.log(`[EntityResolver] Memory cache populated.`);
    }

    private async writeCacheToDisk(categories: string[], platforms: string[]) {
        const timestampUnix = Math.floor(Date.now() / 1000);
        const categoriesFile = path.join(CACHE_DIR, `categories_${timestampUnix}.json`);
        const platformsFile = path.join(CACHE_DIR, `platforms_${timestampUnix}.json`);
        await Promise.all([
            fs.writeFile(categoriesFile, JSON.stringify(categories, null, 2)),
            fs.writeFile(platformsFile, JSON.stringify(platforms, null, 2)),
        ]);
        console.log(`[EntityResolver] Wrote fresh cache to disk with timestamp: ${timestampUnix}`);
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
            return cacheFiles.length > 0 ? cacheFiles[0] : null;
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
        const found = this.categories.find(cat => cat.aliases.includes(searchTerm));
        return found ? found.name : null;
    }

    public resolvePlatform(alias: string): string | null {
        if (!alias) return null;
        const searchTerm = alias.toLowerCase().trim();
        const found = this.platforms.find(plat => plat.aliases.includes(searchTerm) || plat.name.toLowerCase().includes(searchTerm));
        return found ? found.name : null;
    }
}

export const entityResolver = EntityResolver.getInstance();