/**
 * Cache Manager
 * 
 * Provides caching functionality for frequently accessed data,
 * responses, and computed values. Supports TTL, LRU eviction, and size limits.
 */

import { CentralLogger } from './logger';

/**
 * Cache entry
 */
interface CacheEntry<T> {
  key: string;
  value: T;
  timestamp: number;
  ttl?: number; // Time to live in milliseconds
  accessCount: number;
  lastAccessed: number;
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  maxSize?: number; // Maximum number of entries
  defaultTTL?: number; // Default TTL in milliseconds
  evictionPolicy?: 'lru' | 'fifo' | 'none'; // Least Recently Used, First In First Out
  enableStats?: boolean;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  hitRate: number;
}

/**
 * Cache Manager
 */
export class CacheManager<T = any> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private config: Required<CacheConfig>;
  private logger: CentralLogger;
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0
  };

  constructor(config: CacheConfig = {}, logger?: CentralLogger) {
    this.config = {
      maxSize: config.maxSize || 1000,
      defaultTTL: config.defaultTTL || 60 * 60 * 1000, // 1 hour default
      evictionPolicy: config.evictionPolicy || 'lru',
      enableStats: config.enableStats !== false
    };
    this.logger = logger || new CentralLogger('info');
  }

  /**
   * Get value from cache
   */
  get(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check if expired
    if (entry.ttl && (Date.now() - entry.timestamp) > entry.ttl) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    // Update access info
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    this.stats.hits++;

    return entry.value;
  }

  /**
   * Set value in cache
   */
  set(key: string, value: T, ttl?: number): void {
    // Check if we need to evict
    if (this.cache.size >= this.config.maxSize && !this.cache.has(key)) {
      this.evict();
    }

    const entry: CacheEntry<T> = {
      key,
      value,
      timestamp: Date.now(),
      ttl: ttl || this.config.defaultTTL,
      accessCount: 0,
      lastAccessed: Date.now()
    };

    this.cache.set(key, entry);
  }

  /**
   * Check if key exists and is valid
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    // Check if expired
    if (entry.ttl && (Date.now() - entry.timestamp) > entry.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete entry from cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0, evictions: 0 };
  }

  /**
   * Get or set (if not exists)
   */
  async getOrSet(
    key: string,
    factory: () => Promise<T> | T,
    ttl?: number
  ): Promise<T> {
    const cached = this.get(key);
    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    this.set(key, value, ttl);
    return value;
  }

  /**
   * Evict entries based on policy
   */
  private evict(): void {
    if (this.config.evictionPolicy === 'none') {
      return;
    }

    let entryToEvict: CacheEntry<T> | null = null;
    let entryToEvictKey: string | null = null;

    for (const [key, entry] of this.cache.entries()) {
      // Skip if expired
      if (entry.ttl && (Date.now() - entry.timestamp) > entry.ttl) {
        this.cache.delete(key);
        continue;
      }

      if (!entryToEvict) {
        entryToEvict = entry;
        entryToEvictKey = key;
        continue;
      }

      if (this.config.evictionPolicy === 'lru') {
        // Evict least recently used
        if (entry.lastAccessed < entryToEvict.lastAccessed) {
          entryToEvict = entry;
          entryToEvictKey = key;
        }
      } else if (this.config.evictionPolicy === 'fifo') {
        // Evict first in (oldest timestamp)
        if (entry.timestamp < entryToEvict.timestamp) {
          entryToEvict = entry;
          entryToEvictKey = key;
        }
      }
    }

    if (entryToEvictKey) {
      this.cache.delete(entryToEvictKey);
      this.stats.evictions++;
    }
  }

  /**
   * Clean expired entries
   */
  cleanExpired(): number {
    let cleaned = 0;
    const now = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.ttl && (now - entry.timestamp) > entry.ttl) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      evictions: this.stats.evictions,
      size: this.cache.size,
      hitRate: total > 0 ? (this.stats.hits / total) * 100 : 0
    };
  }

  /**
   * Get all keys
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get all values
   */
  values(): T[] {
    return Array.from(this.cache.values()).map(entry => entry.value);
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Start periodic cleanup
   */
  startPeriodicCleanup(intervalMs: number = 5 * 60 * 1000): NodeJS.Timeout {
    return setInterval(() => {
      const cleaned = this.cleanExpired();
      if (cleaned > 0) {
        this.logger.debug(`Cleaned ${cleaned} expired cache entries`);
      }
    }, intervalMs);
  }
}

/**
 * Cache manager factory for different cache types
 */
export class CacheManagerFactory {
  private static caches: Map<string, CacheManager> = new Map();

  /**
   * Get or create a named cache
   */
  static getCache<T = any>(
    name: string,
    config?: CacheConfig,
    logger?: CentralLogger
  ): CacheManager<T> {
    if (!this.caches.has(name)) {
      this.caches.set(name, new CacheManager<T>(config, logger));
    }
    return this.caches.get(name) as CacheManager<T>;
  }

  /**
   * Clear a specific cache
   */
  static clearCache(name: string): void {
    const cache = this.caches.get(name);
    if (cache) {
      cache.clear();
    }
  }

  /**
   * Clear all caches
   */
  static clearAll(): void {
    for (const cache of this.caches.values()) {
      cache.clear();
    }
  }

  /**
   * Get statistics for all caches
   */
  static getAllStats(): Record<string, CacheStats> {
    const stats: Record<string, CacheStats> = {};
    for (const [name, cache] of this.caches.entries()) {
      stats[name] = cache.getStats();
    }
    return stats;
  }
}

