/**
 * Test Helpers
 * 
 * Utility functions and mocks for testing the Master-Sub-Agent architecture.
 */

import { AgentMessage, ConversationContext } from '../types';
import { createMessage } from './communicationProtocols';

/**
 * Create a mock conversation context
 */
export function createMockContext(overrides?: Partial<ConversationContext>): ConversationContext {
  return {
    threadId: `thread_${Date.now()}`,
    sessionId: `session_${Date.now()}`,
    callerId: 'test_caller_123',
    conversationHistory: [],
    metadata: {},
    ...overrides
  };
}

/**
 * Create a mock agent message
 */
export function createMockMessage(
  from: string,
  to: string,
  type: 'INFORM' | 'QUERY' | 'REQUEST' | 'CONFIRM' | 'CLARIFY',
  content: any,
  overrides?: Partial<AgentMessage>
): AgentMessage {
  const context = createMockContext();
  return {
    ...createMessage(from, to, type, content, context),
    ...overrides
  };
}

/**
 * Create a mock session
 */
export function createMockSession(overrides?: any) {
  return {
    id: `session_${Date.now()}`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    expiresAt: Date.now() + 30 * 60 * 1000,
    callerId: 'test_caller',
    currentThreadId: `thread_${Date.now()}`,
    history: [],
    context: createMockContext(),
    metadata: {
      userPreferences: {},
      accessLevel: 'standard',
      language: 'en',
      timezone: 'UTC'
    },
    pendingRequests: new Map(),
    isExpired: () => false,
    extend: () => {},
    addHistoryEntry: () => {},
    getRecentHistory: () => [],
    updateContext: () => {},
    updateMetadata: () => {},
    ...overrides
  };
}

/**
 * Wait for async operation with timeout
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeoutMs: number = 5000,
  intervalMs: number = 100
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const result = await condition();
    if (result) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  throw new Error(`Condition not met within ${timeoutMs}ms`);
}

/**
 * Mock sub-agent response
 */
export function createMockSubAgentResponse(
  status: 'success' | 'needs_info' | 'error' | 'partial',
  data?: any,
  error?: any,
  required?: any[]
) {
  return {
    status,
    data,
    error,
    required,
    requestId: `req_${Date.now()}`,
    timestamp: Date.now()
  };
}

/**
 * Create a test orchestrator with minimal config
 */
export function createTestOrchestratorConfig() {
  return {
    masterAgent: {
      agentId: 'test_master',
      systemPrompt: 'You are a test assistant.',
      intents: ['test_intent'],
      voiceSettings: {
        speed: 1.0,
        tone: 'professional',
        language: 'en'
      }
    },
    subAgents: [],
    logging: {
      level: 'debug' as const,
      maxLogs: 1000
    }
  };
}

/**
 * Assert that a response matches expected structure
 */
export function assertValidResponse(response: any): void {
  if (!response) {
    throw new Error('Response is null or undefined');
  }

  if (typeof response !== 'object') {
    throw new Error('Response must be an object');
  }

  if (!('status' in response)) {
    throw new Error('Response must have a status field');
  }

  const validStatuses = ['success', 'needs_info', 'error', 'partial'];
  if (!validStatuses.includes(response.status)) {
    throw new Error(`Invalid status: ${response.status}. Must be one of: ${validStatuses.join(', ')}`);
  }
}

/**
 * Assert that an error response has required fields
 */
export function assertErrorResponse(response: any): void {
  assertValidResponse(response);
  
  if (response.status !== 'error') {
    throw new Error(`Expected error response, got: ${response.status}`);
  }

  if (!response.error) {
    throw new Error('Error response must have an error field');
  }

  if (!response.error.code || !response.error.message) {
    throw new Error('Error must have code and message fields');
  }
}

/**
 * Assert that a success response has data
 */
export function assertSuccessResponse(response: any): void {
  assertValidResponse(response);
  
  if (response.status !== 'success') {
    throw new Error(`Expected success response, got: ${response.status}`);
  }

  if (!response.data) {
    throw new Error('Success response must have a data field');
  }
}

/**
 * Create a delay for testing timeouts
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Mock performance monitor
 */
export function createMockPerformanceMonitor() {
  return {
    startRequest: () => `req_${Date.now()}`,
    endRequest: () => {},
    getMetrics: () => ({
      timestamp: Date.now(),
      responseTime: {
        average: 100,
        p50: 100,
        p95: 150,
        p99: 200,
        min: 50,
        max: 200
      },
      throughput: {
        requestsPerSecond: 10,
        requestsPerMinute: 600,
        totalRequests: 100
      },
      errorRate: {
        total: 0,
        percentage: 0,
        byType: {}
      },
      agentMetrics: {}
    }),
    reset: () => {},
    getAgentPerformance: () => null,
    isPerformanceDegraded: () => false
  };
}

/**
 * Mock health checker
 */
export function createMockHealthChecker() {
  return {
    checkHealth: async () => ({
      overall: 'healthy' as const,
      timestamp: Date.now(),
      components: [],
      summary: {
        healthy: 0,
        degraded: 0,
        unhealthy: 0
      }
    }),
    startPeriodicChecks: () => {},
    stopPeriodicChecks: () => {},
    getHealthHistory: () => [],
    getLatestHealth: () => null
  };
}

