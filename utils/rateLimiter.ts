/**
 * Rate Limiter for preventing abuse and DoS attacks
 * Implements token bucket algorithm
 */

export interface RateLimitConfig {
  maxRequests: number;      // Maximum requests allowed
  windowMs: number;         // Time window in milliseconds
  burstSize?: number;        // Optional burst allowance
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;      // Seconds to wait before retry
}

/**
 * Token Bucket Rate Limiter
 */
export class RateLimiter {
  private buckets: Map<string, {
    tokens: number;
    lastRefill: number;
    config: RateLimitConfig;
  }> = new Map();

  constructor(private defaultConfig: RateLimitConfig = {
    maxRequests: 100,
    windowMs: 60000, // 1 minute
    burstSize: 10
  }) {}

  /**
   * Check if request is allowed
   * @param identifier - Unique identifier (e.g., user ID, IP, session ID)
   * @param config - Optional custom config for this check
   * @returns Rate limit result
   */
  check(identifier: string, config?: RateLimitConfig): RateLimitResult {
    const limitConfig = config || this.defaultConfig;
    const now = Date.now();
    
    // Get or create bucket for this identifier
    let bucket = this.buckets.get(identifier);
    
    if (!bucket) {
      bucket = {
        tokens: limitConfig.maxRequests,
        lastRefill: now,
        config: limitConfig
      };
      this.buckets.set(identifier, bucket);
    }
    
    // Refill tokens based on time elapsed
    const timeElapsed = now - bucket.lastRefill;
    const tokensToAdd = Math.floor((timeElapsed / limitConfig.windowMs) * limitConfig.maxRequests);
    
    if (tokensToAdd > 0) {
      bucket.tokens = Math.min(
        limitConfig.maxRequests + (limitConfig.burstSize || 0),
        bucket.tokens + tokensToAdd
      );
      bucket.lastRefill = now;
    }
    
    // Check if request is allowed
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      const resetTime = bucket.lastRefill + limitConfig.windowMs;
      
      return {
        allowed: true,
        remaining: Math.floor(bucket.tokens),
        resetTime
      };
    } else {
      // Calculate retry after time
      const tokensNeeded = 1 - bucket.tokens;
      const timeToRefill = (tokensNeeded / limitConfig.maxRequests) * limitConfig.windowMs;
      const retryAfter = Math.ceil(timeToRefill / 1000);
      
      return {
        allowed: false,
        remaining: 0,
        resetTime: bucket.lastRefill + limitConfig.windowMs,
        retryAfter
      };
    }
  }

  /**
   * Reset rate limit for an identifier
   */
  reset(identifier: string): void {
    this.buckets.delete(identifier);
  }

  /**
   * Get current status for an identifier
   */
  getStatus(identifier: string): RateLimitResult | null {
    const bucket = this.buckets.get(identifier);
    if (!bucket) {
      return null;
    }
    
    const now = Date.now();
    const timeElapsed = now - bucket.lastRefill;
    const tokensToAdd = Math.floor((timeElapsed / bucket.config.windowMs) * bucket.config.maxRequests);
    const currentTokens = Math.min(
      bucket.config.maxRequests + (bucket.config.burstSize || 0),
      bucket.tokens + tokensToAdd
    );
    
    return {
      allowed: currentTokens >= 1,
      remaining: Math.floor(currentTokens),
      resetTime: bucket.lastRefill + bucket.config.windowMs
    };
  }

  /**
   * Clean up old buckets (call periodically)
   */
  cleanup(maxAge: number = 3600000): void {
    const now = Date.now();
    for (const [identifier, bucket] of this.buckets.entries()) {
      if (now - bucket.lastRefill > maxAge) {
        this.buckets.delete(identifier);
      }
    }
  }
}

/**
 * Global rate limiter instance
 */
export const globalRateLimiter = new RateLimiter({
  maxRequests: 100,      // 100 requests
  windowMs: 60000,      // per minute
  burstSize: 10         // allow 10 extra as burst
});

/**
 * Rate limit decorator for async functions
 */
export function withRateLimit<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  identifier: string | ((...args: Parameters<T>) => string),
  config?: RateLimitConfig
): T {
  return (async (...args: Parameters<T>) => {
    const id = typeof identifier === 'function' ? identifier(...args) : identifier;
    const result = globalRateLimiter.check(id, config);
    
    if (!result.allowed) {
      throw new RateLimitError(
        `Rate limit exceeded. Try again in ${result.retryAfter} seconds.`,
        result
      );
    }
    
    return fn(...args);
  }) as T;
}

/**
 * Rate limit error
 */
export class RateLimitError extends Error {
  constructor(
    message: string,
    public readonly rateLimitResult: RateLimitResult
  ) {
    super(message);
    this.name = 'RateLimitError';
  }
}

/**
 * Cleanup old rate limit buckets periodically
 */
if (typeof window !== 'undefined') {
  // Cleanup every hour
  setInterval(() => {
    globalRateLimiter.cleanup(3600000);
  }, 3600000);
}

