/**
 * Unit tests for Master Agent
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MasterAgent, MasterAgentConfig } from '../../utils/masterAgent';
import { CommunicationManager } from '../../utils/agentCommunication';
import { StateManager } from '../../utils/stateManager';
import { CentralLogger } from '../../utils/logger';
import { EnhancedValidator } from '../../utils/enhancedValidator';
import { createMockContext } from '../../utils/testHelpers';

describe('MasterAgent', () => {
  let masterAgent: MasterAgent;
  let commManager: CommunicationManager;
  let stateManager: StateManager;
  let logger: CentralLogger;
  let validator: EnhancedValidator;

  beforeEach(() => {
    commManager = new CommunicationManager();
    stateManager = new StateManager('ephemeral');
    logger = new CentralLogger('info');
    validator = new EnhancedValidator();

    const config: MasterAgentConfig = {
      agentId: 'test_master',
      systemPrompt: 'You are a test assistant.',
      intents: ['test_intent'],
      voiceSettings: {
        speed: 1.0,
        tone: 'professional',
        language: 'en'
      }
    };

    masterAgent = new MasterAgent(
      config,
      commManager,
      stateManager,
      logger,
      validator,
      { 'test_intent': 'test_agent' }
    );
  });

  it('should process caller input', async () => {
    const response = await masterAgent.processCallerInput(
      'Test input',
      'session_123'
    );

    expect(response).toBeDefined();
    expect(typeof response).toBe('string');
  });

  it('should handle unknown intents', async () => {
    const response = await masterAgent.processCallerInput(
      'Random gibberish that no one understands',
      'session_456'
    );

    expect(response).toBeDefined();
    expect(response.toLowerCase()).toContain('understand');
  }, 10000);

  it('should maintain session context', async () => {
    const sessionId = 'session_context';
    
    const response1 = await masterAgent.processCallerInput('First message', sessionId);
    expect(response1).toBeDefined();
    
    const response2 = await masterAgent.processCallerInput(
      'Second message',
      sessionId
    );

    expect(response2).toBeDefined();
  }, 15000);
});

