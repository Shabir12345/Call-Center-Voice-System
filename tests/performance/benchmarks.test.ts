/**
 * Performance Benchmark Tests
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PerformanceBenchmark } from './benchmarks';

describe('Performance Benchmarks', () => {
  const benchmark = new PerformanceBenchmark();

  beforeAll(async () => {
    await benchmark.initialize();
  });

  afterAll(async () => {
    await benchmark.cleanup();
  });

  describe('Latency', () => {
    it('should measure request latency', async () => {
      const result = await benchmark.benchmarkLatency('Test input', 10);
      
      expect(result.iterations).toBe(10);
      expect(result.averageTime).toBeGreaterThan(0);
      expect(result.minTime).toBeGreaterThanOrEqual(0);
      expect(result.maxTime).toBeGreaterThanOrEqual(result.minTime);
    });

    it('should meet latency requirements', async () => {
      const result = await benchmark.benchmarkLatency('Test input', 20);
      
      // Average latency should be under 5 seconds
      expect(result.averageTime).toBeLessThan(5000);
      // P95 should be under 10 seconds
      expect(result.p95).toBeLessThan(10000);
    });
  });

  describe('Throughput', () => {
    it('should measure throughput', async () => {
      const result = await benchmark.benchmarkThroughput('Test input', 2000, 3);
      
      expect(result.throughput).toBeGreaterThan(0);
      expect(result.iterations).toBeGreaterThan(0);
    });
  });

  describe('Concurrent Sessions', () => {
    it('should handle concurrent sessions', async () => {
      const result = await benchmark.benchmarkConcurrentSessions(10, 2);
      
      expect(result.iterations).toBe(20);
      expect(result.errorRate).toBeLessThan(10); // Less than 10% error rate
    });
  });
});

