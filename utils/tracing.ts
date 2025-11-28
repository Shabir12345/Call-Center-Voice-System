/**
 * Distributed Tracing
 * 
 * Implements request correlation IDs and distributed tracing
 * for tracking requests across multiple agents.
 */

import { CentralLogger } from './logger';

/**
 * Trace span
 */
export interface TraceSpan {
  spanId: string;
  traceId: string;
  parentSpanId?: string;
  operation: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  tags: Record<string, any>;
  logs: Array<{ timestamp: number; message: string; data?: any }>;
}

/**
 * Trace context
 */
export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  baggage?: Record<string, string>;
}

/**
 * Tracer
 */
export class Tracer {
  private logger: CentralLogger;
  private activeSpans: Map<string, TraceSpan> = new Map();
  private traceHistory: TraceSpan[] = [];
  private maxHistorySize: number = 1000;

  constructor(logger: CentralLogger) {
    this.logger = logger;
  }

  /**
   * Start a new span
   */
  startSpan(
    operation: string,
    parentContext?: TraceContext,
    tags?: Record<string, any>
  ): TraceContext {
    const traceId = parentContext?.traceId || this.generateId();
    const spanId = this.generateId();
    const parentSpanId = parentContext?.spanId;

    const span: TraceSpan = {
      spanId,
      traceId,
      parentSpanId,
      operation,
      startTime: Date.now(),
      tags: tags || {},
      logs: []
    };

    this.activeSpans.set(spanId, span);

    return {
      traceId,
      spanId,
      parentSpanId,
      baggage: parentContext?.baggage
    };
  }

  /**
   * End a span
   */
  endSpan(spanId: string, tags?: Record<string, any>): TraceSpan | null {
    const span = this.activeSpans.get(spanId);
    if (!span) {
      return null;
    }

    span.endTime = Date.now();
    span.duration = span.endTime - span.startTime;

    if (tags) {
      span.tags = { ...span.tags, ...tags };
    }

    this.activeSpans.delete(spanId);
    this.traceHistory.push(span);

    // Trim history
    if (this.traceHistory.length > this.maxHistorySize) {
      this.traceHistory = this.traceHistory.slice(-this.maxHistorySize);
    }

    // Log span completion
    this.logger.debug(`Span completed: ${span.operation}`, {
      spanId: span.spanId,
      traceId: span.traceId,
      duration: span.duration,
      tags: span.tags
    });

    return span;
  }

  /**
   * Add log to span
   */
  addSpanLog(spanId: string, message: string, data?: any): void {
    const span = this.activeSpans.get(spanId);
    if (span) {
      span.logs.push({
        timestamp: Date.now(),
        message,
        data
      });
    }
  }

  /**
   * Add tag to span
   */
  addSpanTag(spanId: string, key: string, value: any): void {
    const span = this.activeSpans.get(spanId);
    if (span) {
      span.tags[key] = value;
    }
  }

  /**
   * Get trace by trace ID
   */
  getTrace(traceId: string): TraceSpan[] {
    return this.traceHistory.filter(span => span.traceId === traceId);
  }

  /**
   * Get span by span ID
   */
  getSpan(spanId: string): TraceSpan | null {
    return this.activeSpans.get(spanId) || 
           this.traceHistory.find(s => s.spanId === spanId) ||
           null;
  }

  /**
   * Get all traces
   */
  getAllTraces(): TraceSpan[] {
    return [...this.traceHistory];
  }

  /**
   * Get recent traces (active + completed, sorted by start time)
   */
  getRecentTraces(limit: number = 50): TraceSpan[] {
    const allTraces: TraceSpan[] = [
      ...Array.from(this.activeSpans.values()),
      ...this.traceHistory
    ];
    
    // Sort by start time (most recent first)
    return allTraces
      .sort((a, b) => b.startTime - a.startTime)
      .slice(0, limit);
  }

  /**
   * Get active spans
   */
  getActiveSpans(): TraceSpan[] {
    return Array.from(this.activeSpans.values());
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Extract trace context from headers (for distributed tracing)
   */
  extractContext(headers: Record<string, string>): TraceContext | null {
    const traceId = headers['x-trace-id'];
    const spanId = headers['x-span-id'];
    const parentSpanId = headers['x-parent-span-id'];

    if (traceId && spanId) {
      return {
        traceId,
        spanId,
        parentSpanId,
        baggage: this.parseBaggage(headers['x-baggage'])
      };
    }

    return null;
  }

  /**
   * Inject trace context into headers
   */
  injectContext(context: TraceContext, headers: Record<string, string>): void {
    headers['x-trace-id'] = context.traceId;
    headers['x-span-id'] = context.spanId;
    if (context.parentSpanId) {
      headers['x-parent-span-id'] = context.parentSpanId;
    }
    if (context.baggage) {
      headers['x-baggage'] = this.serializeBaggage(context.baggage);
    }
  }

  /**
   * Parse baggage string
   */
  private parseBaggage(baggage?: string): Record<string, string> | undefined {
    if (!baggage) return undefined;

    const result: Record<string, string> = {};
    const pairs = baggage.split(',');
    for (const pair of pairs) {
      const [key, value] = pair.split('=');
      if (key && value) {
        result[decodeURIComponent(key.trim())] = decodeURIComponent(value.trim());
      }
    }
    return result;
  }

  /**
   * Serialize baggage to string
   */
  private serializeBaggage(baggage: Record<string, string>): string {
    return Object.entries(baggage)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join(',');
  }
}

/**
 * Request correlation ID generator
 */
export class CorrelationIdGenerator {
  /**
   * Generate correlation ID
   */
  static generate(): string {
    return `corr_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Extract correlation ID from context
   */
  static extract(context: any): string | null {
    if (context?.correlationId) {
      return context.correlationId;
    }
    if (context?.metadata?.correlationId) {
      return context.metadata.correlationId;
    }
    return null;
  }

  /**
   * Add correlation ID to context
   */
  static add(context: any, correlationId?: string): void {
    const id = correlationId || this.generate();
    
    if (!context.metadata) {
      context.metadata = {};
    }
    
    context.metadata.correlationId = id;
    context.correlationId = id;
  }
}

