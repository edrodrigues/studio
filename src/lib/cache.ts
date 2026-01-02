import crypto from 'crypto';

interface CacheEntry<T> {
    value: T;
    expiry: number;
}

const cache = new Map<string, CacheEntry<any>>();

// Default TTL: 1 hour
const DEFAULT_TTL = 60 * 60 * 1000;

export function getCacheKey(prefix: string, data: any): string {
    const hash = crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
    return `${prefix}:${hash}`;
}

export function getFromCache<T>(key: string): T | null {
    const entry = cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiry) {
        cache.delete(key);
        return null;
    }

    return entry.value;
}

export function setInCache<T>(key: string, value: T, ttl: number = DEFAULT_TTL): void {
    cache.set(key, {
        value,
        expiry: Date.now() + ttl,
    });
}

export async function withCache<T>(
    prefix: string,
    keyData: any,
    fn: () => Promise<T>,
    ttl: number = DEFAULT_TTL
): Promise<T> {
    const key = getCacheKey(prefix, keyData);
    const cached = getFromCache<T>(key);

    if (cached) {
        console.log(`[Cache] Hit for ${prefix}`);
        return cached;
    }

    console.log(`[Cache] Miss for ${prefix}, executing function...`);
    const result = await fn();
    setInCache(key, result, ttl);
    return result;
}
