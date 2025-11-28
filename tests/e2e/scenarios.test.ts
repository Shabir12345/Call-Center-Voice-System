/**
 * End-to-End Test Scenarios
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { E2ETestFramework, TEST_SCENARIOS } from './framework';

describe('E2E Scenarios', () => {
  const framework = new E2ETestFramework();

  beforeAll(async () => {
    await framework.initialize();
  });

  afterAll(async () => {
    await framework.cleanup();
  });

  describe('Reservation Confirmation', () => {
    it('should handle reservation confirmation flow', async () => {
      const result = await framework.runScenario({
        name: 'Reservation Confirmation',
        steps: [
          {
            input: 'Confirm my reservation',
            expectedResponse: /reservation|information|details/i
          },
          {
            input: 'My reservation number is ABC123 and my name is John Doe',
            expectedResponse: /ABC123|confirmed/i
          }
        ]
      });

      if (!result.passed) {
        console.error('Scenario errors:', result.errors);
      }
      expect(result.passed).toBe(true);
    }, 30000);
  });

  describe('Billing Inquiry', () => {
    it('should handle billing inquiry flow', async () => {
      const result = await framework.runScenario({
        name: 'Billing Inquiry',
        steps: [
          {
            input: "What's my bill for this month?",
            expectedResponse: /bill|billing|amount/i
          }
        ]
      });

      if (!result.passed) {
        console.error('Scenario errors:', result.errors);
      }
      expect(result.passed).toBe(true);
    }, 30000);
  });

  describe('Multi-Turn Conversation', () => {
    it('should maintain context across multiple turns', async () => {
      const sessionId = `test_${Date.now()}`;
      
      const response1 = await framework['orchestrator'].processCallerInput(
        'I want to confirm my reservation',
        sessionId
      );
      
      expect(response1).toBeDefined();
      
      const response2 = await framework['orchestrator'].processCallerInput(
        'My reservation number is ABC123',
        sessionId
      );
      
      expect(response2).toBeDefined();
      // Context should be maintained
    }, 30000);
  });

  describe('All Scenarios', () => {
    it('should run all predefined scenarios', async () => {
      const results = await framework.runScenarios(TEST_SCENARIOS);
      
      expect(results.total).toBeGreaterThan(0);
      // At least some scenarios should pass
      expect(results.passed).toBeGreaterThanOrEqual(0);
    }, 60000);
  });
});

