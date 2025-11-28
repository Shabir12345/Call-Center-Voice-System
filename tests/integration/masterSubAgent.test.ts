/**
 * Integration tests for Master-Sub-Agent communication
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SystemOrchestrator } from '../../utils/systemOrchestrator';
import { ReservationAgentModule } from '../../utils/subAgents/reservationAgent';
import { CentralLogger } from '../../utils/logger';
import { createTestOrchestratorConfig } from '../../utils/testHelpers';

describe('Master-Sub-Agent Integration', () => {
  let orchestrator: SystemOrchestrator;
  let logger: CentralLogger;

  beforeEach(async () => {
    const config = createTestOrchestratorConfig();
    orchestrator = new SystemOrchestrator(config);
    logger = orchestrator.getLogger();
    await orchestrator.initialize();
    
    // Register sub-agents for integration tests
    await orchestrator.registerSubAgent(
      {
        agentId: 'reservation_agent',
        specialty: 'reservations',
        systemPrompt: 'Handle reservations.',
        model: 'pro'
      },
      ReservationAgentModule
    );
  });

  it('should process caller input through master agent', async () => {
    const response = await orchestrator.processCallerInput(
      'Confirm my reservation',
      'session_123'
    );

    expect(response).toBeDefined();
    expect(typeof response).toBe('string');
  }, 15000);

  it('should handle multi-turn conversations', async () => {
    const sessionId = 'session_456';
    
    const response1 = await orchestrator.processCallerInput(
      'I want to confirm my reservation',
      sessionId
    );
    
    expect(response1).toBeDefined();
    
    // Follow-up message
    const response2 = await orchestrator.processCallerInput(
      'My reservation number is ABC123',
      sessionId
    );
    
    expect(response2).toBeDefined();
  }, 15000);

  it('should maintain session context across messages', async () => {
    const sessionId = 'session_789';
    
    await orchestrator.processCallerInput('Hello', sessionId);
    const stats = orchestrator.getStatistics();
    
    expect(stats.sessions).toBeGreaterThan(0);
  });
});

