import { VibkitError } from 'arbitrum-vibekit-core';
import * as console from "node:console";

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

    const textBeforeParentheses = name.split('(')[0].trim();
    if (textBeforeParentheses && textBeforeParentheses.toLowerCase() !== lowerCaseName) {
        aliases.add(textBeforeParentheses.toLowerCase());
    }

    return Array.from(aliases);
}

class EntityResolver {
    private static instance: EntityResolver;

    private categories: CanonicalEntity[] = [];
    private platforms: CanonicalEntity[] = [];
    private isInitialized = false;

    private constructor() {}

    public static getInstance(): EntityResolver {
        if (!EntityResolver.instance) {
            EntityResolver.instance = new EntityResolver();
        }
        return EntityResolver.instance;
    }

    public async initialize(mcpClient: any) {
        if (this.isInitialized) return;

        console.log('[EntityResolver] Initializing cache...');
        try {
            const [categoriesRes, platformsRes] = await Promise.all([
                mcpClient.callTool({ name: 'getAllCategories', arguments: {} }),
                mcpClient.callTool({ name: 'getPlatforms', arguments: {} }),
            ]);

            if (categoriesRes && categoriesRes.content && categoriesRes.content.length > 0) {
                const categoriesJsonString = categoriesRes.content[0].text;
                const categoryNames: string[] = JSON.parse(categoriesJsonString);

                this.categories = categoryNames.map(name => ({
                    id: name.toLowerCase().replace(/\s+/g, '-'),
                    name: name,
                    aliases: generateAliases(name)
                }));
            }

            if (platformsRes && platformsRes.content && platformsRes.content.length > 0) {
                const platformsJsonString = platformsRes.content[0].text;
                const platformNames: string[] = JSON.parse(platformsJsonString);

                this.platforms = platformNames.map(name => ({
                    id: name,
                    name: name,
                    aliases: [name.toLowerCase()]
                }));
            }

            //console.log('[EntityResolver] Cache initialized for Categories.', this.categories);
            //console.log('[EntityResolver] Cache initialized for Platforms.', this.platforms);

            this.isInitialized = true;
            console.log(`[EntityResolver] Cache initialized with ${this.categories.length} categories and ${this.platforms.length} platforms.`);
        } catch (error) {
            console.error('[EntityResolver] Failed to initialize cache:', error);
            this.isInitialized = false;
        }
    }

    public resolveCategory(alias: string): string | null {
        if (!alias) return null;
        const searchTerm = alias.toLowerCase().trim();
        const found = this.categories.find(cat =>
            cat.name.toLowerCase() === searchTerm || cat.aliases.includes(searchTerm)
        );
        return found ? found.name : null;
    }

    public resolvePlatform(alias: string): string | null {
        if (!alias) return null;
        const searchTerm = alias.toLowerCase().trim();
        const found = this.platforms.find(plat =>
            plat.name.toLowerCase() === searchTerm || plat.aliases.includes(searchTerm) || plat.name.toLowerCase().includes(searchTerm)
        );

        return found ? found.name.toLowerCase() : null;
    }
}

export const entityResolver = EntityResolver.getInstance();