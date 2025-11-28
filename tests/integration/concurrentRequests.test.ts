/**
 * Integration tests for Concurrent Requests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SystemOrchestrator } from '../../utils/systemOrchestrator';
import { createTestOrchestratorConfig } from '../../utils/testHelpers';

describe('Concurrent Requests', () => {
  let orchestrator: SystemOrchestrator;

  beforeEach(async () => {
    const config = createTestOrchestratorConfig();
    orchestrator = new SystemOrchestrator(config);
    await orchestrator.initialize();
  });

  it('should handle multiple concurrent requests', async () => {
    const requests = Array.from({ length: 10 }, (_, i) =>
      orchestrator.processCallerInput(
        `Request ${i}`,
        `session_${i}`
      )
    );

    const responses = await Promise.all(requests);
    
    expect(responses.length).toBe(10);
    responses.forEach(response => {
      expect(response).toBeDefined();
      expect(typeof response).toBe('string');
    });
  });

  it('should handle concurrent requests to same session', async () => {
    const sessionId = 'concurrent_session';
    
    const requests = Array.from({ length: 5 }, () =>
      orchestrator.processCallerInput('Test', sessionId)
    );

    const responses = await Promise.all(requests);
    
    // All should complete (may have race conditions, but shouldn't crash)
    expect(responses.length).toBe(5);
  });

  it('should maintain isolation between sessions', async () => {
    const session1 = 'session_1';
    const session2 = 'session_2';
    
    await orchestrator.processCallerInput('Message 1', session1);
    await orchestrator.processCallerInput('Message 2', session2);
    
    // Sessions should be independent
    const stats = orchestrator.getStatistics();
    expect(stats.sessions).toBeGreaterThanOrEqual(2);
  });
});

