/**
 * Performance Benchmarks
 * 
 * Benchmarks for testing system performance under various conditions
 */

import { SystemOrchestrator } from '../../utils/systemOrchestrator';
import { PerformanceMonitor } from '../../utils/performanceMonitor';
import { CentralLogger } from '../../utils/logger';
import { createTestOrchestratorConfig } from '../../utils/testHelpers';

/**
 * Benchmark result
 */
export interface BenchmarkResult {
  name: string;
  iterations: number;
  totalTime: number;
  averageTime: number;
  minTime: number;
  maxTime: number;
  p50: number;
  p95: number;
  p99: number;
  throughput: number; // requests per second
  errors: number;
  errorRate: number;
}

/**
 * Performance Benchmark Suite
 */
export class PerformanceBenchmark {
  private orchestrator: SystemOrchestrator;
  private monitor: PerformanceMonitor;
  private logger: CentralLogger;

  constructor() {
    const config = createTestOrchestratorConfig();
    this.orchestrator = new SystemOrchestrator(config);
    this.logger = new CentralLogger('info');
    this.monitor = new PerformanceMonitor(this.logger);
  }

  /**
   * Initialize benchmark environment
   */
  async initialize(): Promise<void> {
    await this.orchestrator.initialize();
  }

  /**
   * Benchmark single request latency
   */
  async benchmarkLatency(
    input: string,
    iterations: number = 100
  ): Promise<BenchmarkResult> {
    const times: number[] = [];
    let errors = 0;

    for (let i = 0; i < iterations; i++) {
      const startTime = Date.now();
      const requestId = this.monitor.startRequest();
      
      try {
        await this.orchestrator.processCallerInput(
          input,
          `session_${i}`
        );
        this.monitor.endRequest(requestId, true);
      } catch (error) {
        errors++;
        this.monitor.endRequest(requestId, false);
      }
      
      const endTime = Date.now();
      times.push(endTime - startTime);
    }

    return this.calculateResults('Latency Benchmark', times, iterations, errors);
  }

  /**
   * Benchmark throughput
   */
  async benchmarkThroughput(
    input: string,
    durationMs: number = 10000,
    concurrency: number = 10
  ): Promise<BenchmarkResult> {
    const times: number[] = [];
    let requestCount = 0;
    let errors = 0;
    const startTime = Date.now();
    const endTime = startTime + durationMs;

    const workers: Promise<void>[] = [];

    for (let i = 0; i < concurrency; i++) {
      workers.push(
        (async () => {
          while (Date.now() < endTime) {
            const reqStart = Date.now();
            const requestId = this.monitor.startRequest();
            
            try {
              await this.orchestrator.processCallerInput(
                input,
                `session_${requestCount++}`
              );
              this.monitor.endRequest(requestId, true);
            } catch (error) {
              errors++;
              this.monitor.endRequest(requestId, false);
            }
            
            const reqEnd = Date.now();
            times.push(reqEnd - reqStart);
          }
        })()
      );
    }

    await Promise.all(workers);

    const totalTime = Date.now() - startTime;
    const iterations = requestCount;

    return this.calculateResults('Throughput Benchmark', times, iterations, errors, totalTime);
  }

  /**
   * Benchmark concurrent sessions
   */
  async benchmarkConcurrentSessions(
    numSessions: number = 100,
    messagesPerSession: number = 5
  ): Promise<BenchmarkResult> {
    const times: number[] = [];
    let errors = 0;

    const sessions = Array.from({ length: numSessions }, (_, i) => `session_${i}`);

    const startTime = Date.now();

    await Promise.all(
      sessions.map(async (sessionId) => {
        for (let i = 0; i < messagesPerSession; i++) {
          const reqStart = Date.now();
          const requestId = this.monitor.startRequest();
          
          try {
            await this.orchestrator.processCallerInput(
              `Message ${i}`,
              sessionId
            );
            this.monitor.endRequest(requestId, true);
          } catch (error) {
            errors++;
            this.monitor.endRequest(requestId, false);
          }
          
          const reqEnd = Date.now();
          times.push(reqEnd - reqStart);
        }
      })
    );

    const totalTime = Date.now() - startTime;
    const iterations = numSessions * messagesPerSession;

    return this.calculateResults('Concurrent Sessions Benchmark', times, iterations, errors, totalTime);
  }

  /**
   * Calculate benchmark results
   */
  private calculateResults(
    name: string,
    times: number[],
    iterations: number,
    errors: number,
    totalTime?: number
  ): BenchmarkResult {
    const sorted = [...times].sort((a, b) => a - b);
    const total = totalTime || sorted.reduce((a, b) => a + b, 0);

    return {
      name,
      iterations,
      totalTime: total,
      averageTime: sorted.reduce((a, b) => a + b, 0) / sorted.length,
      minTime: sorted[0] || 0,
      maxTime: sorted[sorted.length - 1] || 0,
      p50: this.percentile(sorted, 50),
      p95: this.percentile(sorted, 95),
      p99: this.percentile(sorted, 99),
      throughput: (iterations / (total / 1000)),
      errors,
      errorRate: (errors / iterations) * 100
    };
  }

  /**
   * Calculate percentile
   */
  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)] || 0;
  }

  /**
   * Run all benchmarks
   */
  async runAllBenchmarks(): Promise<BenchmarkResult[]> {
    const results: BenchmarkResult[] = [];

    console.log('Running latency benchmark...');
    results.push(await this.benchmarkLatency('Test input', 50));

    console.log('Running throughput benchmark...');
    results.push(await this.benchmarkThroughput('Test input', 5000, 5));

    console.log('Running concurrent sessions benchmark...');
    results.push(await this.benchmarkConcurrentSessions(20, 3));

    return results;
  }

  /**
   * Cleanup
   */
  async cleanup(): Promise<void> {
    await this.orchestrator.shutdown();
  }
}

