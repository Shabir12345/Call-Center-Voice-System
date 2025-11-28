/**
 * End-to-End Test Framework
 * 
 * Framework for testing complete user flows and scenarios
 */

import { SystemOrchestrator } from '../../utils/systemOrchestrator';
import { createTestOrchestratorConfig } from '../../utils/testHelpers';
import { ReservationAgentModule } from '../../utils/subAgents/reservationAgent';
import { BillingAgentModule } from '../../utils/subAgents/billingAgent';

/**
 * E2E Test Scenario
 */
export interface E2EScenario {
  name: string;
  steps: Array<{
    input: string;
    expectedResponse?: string | RegExp;
    expectedIntent?: string;
    validate?: (response: string) => boolean;
  }>;
  setup?: () => Promise<void>;
  teardown?: () => Promise<void>;
}

/**
 * E2E Test Framework
 */
export class E2ETestFramework {
  private orchestrator: SystemOrchestrator;

  constructor() {
    const config = createTestOrchestratorConfig();
    this.orchestrator = new SystemOrchestrator(config);
  }

  /**
   * Initialize framework
   */
  async initialize(): Promise<void> {
    await this.orchestrator.initialize();
    
    // Register test agents
    await this.orchestrator.registerSubAgent(
      {
        agentId: 'reservation_agent',
        specialty: 'reservations',
        systemPrompt: 'Handle reservations.',
        model: 'pro'
      },
      ReservationAgentModule
    );

    await this.orchestrator.registerSubAgent(
      {
        agentId: 'billing_agent',
        specialty: 'billing',
        systemPrompt: 'Handle billing.',
        model: 'flash'
      },
      BillingAgentModule
    );
  }

  /**
   * Run a test scenario
   */
  async runScenario(scenario: E2EScenario): Promise<{
    passed: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];
    const sessionId = `test_session_${Date.now()}`;

    try {
      // Setup
      if (scenario.setup) {
        await scenario.setup();
      }

      // Run steps
      for (let i = 0; i < scenario.steps.length; i++) {
        const step = scenario.steps[i];
        
        try {
          const response = await Promise.race([
            this.orchestrator.processCallerInput(
              step.input,
              sessionId
            ),
            new Promise<string>((_, reject) => 
              setTimeout(() => reject(new Error('Request timeout after 10 seconds')), 10000)
            )
          ]);

          // Validate response
          if (step.expectedResponse) {
            if (typeof step.expectedResponse === 'string') {
              if (!response.includes(step.expectedResponse)) {
                errors.push(`Step ${i + 1}: Expected response to contain "${step.expectedResponse}", got: "${response}"`);
              }
            } else {
              if (!step.expectedResponse.test(response)) {
                errors.push(`Step ${i + 1}: Response did not match pattern. Got: "${response.substring(0, 200)}"`);
              }
            }
          }

          if (step.validate && !step.validate(response)) {
            errors.push(`Step ${i + 1}: Custom validation failed`);
          }
        } catch (error: any) {
          errors.push(`Step ${i + 1}: ${error.message}`);
        }
      }

      // Teardown
      if (scenario.teardown) {
        await scenario.teardown();
      }

      return {
        passed: errors.length === 0,
        errors
      };
    } catch (error: any) {
      return {
        passed: false,
        errors: [`Scenario failed: ${error.message}`]
      };
    }
  }

  /**
   * Run multiple scenarios
   */
  async runScenarios(scenarios: E2EScenario[]): Promise<{
    total: number;
    passed: number;
    failed: number;
    results: Array<{ scenario: string; passed: boolean; errors: string[] }>;
  }> {
    const results: Array<{ scenario: string; passed: boolean; errors: string[] }> = [];

    for (const scenario of scenarios) {
      const result = await this.runScenario(scenario);
      results.push({
        scenario: scenario.name,
        passed: result.passed,
        errors: result.errors
      });
    }

    return {
      total: scenarios.length,
      passed: results.filter(r => r.passed).length,
      failed: results.filter(r => !r.passed).length,
      results
    };
  }

  /**
   * Cleanup
   */
  async cleanup(): Promise<void> {
    await this.orchestrator.shutdown();
  }
}

/**
 * Predefined test scenarios
 */
export const TEST_SCENARIOS: E2EScenario[] = [
  {
    name: 'Reservation Confirmation Flow',
    steps: [
      {
        input: 'Confirm my reservation',
        expectedResponse: /reservation|information|details/i
      },
      {
        input: 'My reservation number is ABC123',
        expectedResponse: /ABC123|confirmed/i
      }
    ]
  },
  {
    name: 'Billing Inquiry Flow',
    steps: [
      {
        input: "What's my bill?",
        expectedResponse: /bill|billing|amount/i
      }
    ]
  }
];

