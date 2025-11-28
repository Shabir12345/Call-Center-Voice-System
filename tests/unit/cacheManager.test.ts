/**
 * Unit tests for Cache Manager
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CacheManager, CacheManagerFactory } from '../../utils/cacheManager';

describe('CacheManager', () => {
  let cache: CacheManager<string>;

  beforeEach(() => {
    cache = new CacheManager({ maxSize: 10 });
  });

  describe('Basic Operations', () => {
    it('should set and get values', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    it('should return null for non-existent keys', () => {
      expect(cache.get('nonexistent')).toBeNull();
    });

    it('should check if key exists', () => {
      cache.set('key1', 'value1');
      expect(cache.has('key1')).toBe(true);
      expect(cache.has('nonexistent')).toBe(false);
    });

    it('should delete entries', () => {
      cache.set('key1', 'value1');
      cache.delete('key1');
      expect(cache.get('key1')).toBeNull();
    });

    it('should clear all entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.clear();
      expect(cache.size()).toBe(0);
    });
  });

  describe('TTL', () => {
    it('should expire entries after TTL', async () => {
      cache.set('key1', 'value1', 100); // 100ms TTL
      expect(cache.get('key1')).toBe('value1');
      
      await new Promise(resolve => setTimeout(resolve, 150));
      expect(cache.get('key1')).toBeNull();
    });
  });

  describe('Eviction', () => {
    it('should evict entries when max size reached', () => {
      const smallCache = new CacheManager({ maxSize: 2, evictionPolicy: 'lru' });
      
      smallCache.set('key1', 'value1');
      smallCache.set('key2', 'value2');
      smallCache.set('key3', 'value3'); // Should evict key1
      
      expect(smallCache.get('key1')).toBeNull();
      expect(smallCache.get('key2')).toBe('value2');
      expect(smallCache.get('key3')).toBe('value3');
    });
  });

  describe('getOrSet', () => {
    it('should return cached value if exists', async () => {
      cache.set('key1', 'cached');
      const value = await cache.getOrSet('key1', async () => 'new');
      expect(value).toBe('cached');
    });

    it('should call factory if not cached', async () => {
      const factory = async () => 'new_value';
      const value = await cache.getOrSet('key1', factory);
      expect(value).toBe('new_value');
      expect(cache.get('key1')).toBe('new_value');
    });
  });

  describe('Statistics', () => {
    it('should track hits and misses', () => {
      cache.set('key1', 'value1');
      cache.get('key1'); // hit
      cache.get('key2'); // miss
      
      const stats = cache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
    });
  });
});

describe('CacheManagerFactory', () => {
  it('should create and retrieve named caches', () => {
    const cache1 = CacheManagerFactory.getCache('cache1');
    const cache2 = CacheManagerFactory.getCache('cache1');
    
    expect(cache1).toBe(cache2);
  });

  it('should clear specific cache', () => {
    const cache = CacheManagerFactory.getCache('test');
    cache.set('key', 'value');
    CacheManagerFactory.clearCache('test');
    expect(cache.get('key')).toBeNull();
  });
});

