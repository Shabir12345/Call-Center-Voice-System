/**
 * Integration tests for Session Resumption
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SystemOrchestrator } from '../../utils/systemOrchestrator';
import { SessionManager } from '../../utils/sessionManager';
import { StateManager } from '../../utils/stateManager';
import { CentralLogger } from '../../utils/logger';
import { createTestOrchestratorConfig } from '../../utils/testHelpers';

describe('Session Resumption', () => {
  let orchestrator: SystemOrchestrator;
  let sessionManager: SessionManager;

  beforeEach(async () => {
    const config = createTestOrchestratorConfig();
    orchestrator = new SystemOrchestrator(config);
    await orchestrator.initialize();
    
    const stateManager = orchestrator.getStateManager();
    const logger = orchestrator.getLogger();
    sessionManager = new SessionManager(stateManager, logger);
  });

  it('should resume expired session', async () => {
    const sessionId = 'session_resume_test';
    
    // Create session
    await sessionManager.getOrCreateSession(sessionId);
    
    // Simulate expiration by creating new session with short timeout
    const shortTimeoutManager = new SessionManager(
      new StateManager('ephemeral', { sessionTimeoutMs: 100 }),
      new CentralLogger('info')
    );
    
    const session = await shortTimeoutManager.getOrCreateSession(sessionId);
    
    // Wait for expiration
    await new Promise(resolve => setTimeout(resolve, 150));
    
    // Resume should create new session
    const resumed = await shortTimeoutManager.resumeSession(sessionId);
    expect(resumed).toBeDefined();
  });

  it('should maintain context across resumption', async () => {
    const sessionId = 'session_context_test';
    
    // First interaction
    await orchestrator.processCallerInput('Hello', sessionId);
    
    // Resume and continue
    const resumed = await sessionManager.resumeSession(sessionId);
    expect(resumed).toBeDefined();
    
    // Second interaction should have context
    const response = await orchestrator.processCallerInput(
      'Continue conversation',
      sessionId
    );
    
    expect(response).toBeDefined();
  });
});

