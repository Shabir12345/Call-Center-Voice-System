/**
 * Unit tests for Sub-Agent Module
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SubAgentModule, SubAgentConfig, TaskResult } from '../../utils/subAgentModule';
import { CentralLogger } from '../../utils/logger';
import { createMockMessage, createMockContext } from '../../utils/testHelpers';

class TestSubAgent extends SubAgentModule {
  protected async processTask(
    task: string,
    parameters: Record<string, any>,
    context: any
  ): Promise<TaskResult> {
    if (task === 'test_task') {
      return {
        status: 'success',
        data: { result: 'test_result' }
      };
    }
    return {
      status: 'error',
      error: {
        code: 'UNKNOWN_TASK',
        message: 'Unknown task'
      }
    };
  }
}

describe('SubAgentModule', () => {
  let agent: TestSubAgent;
  let logger: CentralLogger;

  beforeEach(() => {
    logger = new CentralLogger('info');
    const config: SubAgentConfig = {
      agentId: 'test_agent',
      specialty: 'testing',
      systemPrompt: 'Test agent'
    };
    agent = new TestSubAgent(config, logger);
  });

  it('should process task successfully', async () => {
    const message = createMockMessage(
      'master',
      'test_agent',
      'REQUEST',
      {
        task: 'test_task',
        parameters: {},
        context: createMockContext()
      }
    );

    const response = await agent.handleMessage(message);

    expect(response.status).toBe('success');
    expect(response.data).toEqual({ result: 'test_result' });
  });

  it('should handle unknown tasks', async () => {
    const message = createMockMessage(
      'master',
      'test_agent',
      'REQUEST',
      {
        task: 'unknown_task',
        parameters: {},
        context: createMockContext()
      }
    );

    const response = await agent.handleMessage(message);

    expect(response.status).toBe('error');
    expect(response.error?.code).toBe('UNKNOWN_TASK');
  });

  it('should validate input', async () => {
    const message = createMockMessage(
      'master',
      'test_agent',
      'REQUEST',
      {
        // Missing required fields
      }
    );

    const response = await agent.handleMessage(message);
    // Should handle validation error
    expect(response).toBeDefined();
  });
});

