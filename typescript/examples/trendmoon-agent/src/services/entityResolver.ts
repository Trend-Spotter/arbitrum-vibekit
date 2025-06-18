import { VibkitError } from 'arbitrum-vibekit-core';

interface CanonicalEntity {
    id: string;
    name: string;
    aliases: string[];
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

            this.categories = categoriesRes.content || [];
            this.platforms = platformsRes.content || [];
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
            plat.name.toLowerCase() === searchTerm || plat.aliases.includes(searchTerm)
        );
        return found ? found.name : null;
    }
}

export const entityResolver = EntityResolver.getInstance();