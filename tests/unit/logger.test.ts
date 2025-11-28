/**
 * Unit tests for Logger
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CentralLogger } from '../../utils/logger';

describe('CentralLogger', () => {
  let logger: CentralLogger;

  beforeEach(() => {
    logger = new CentralLogger('in-memory', { logLevel: 'debug' });
  });

  describe('Logging', () => {
    it('should create log entries', async () => {
      await logger.info('Test message', {}, 'session_123');
      
      const logs = await logger.queryLogs({ sessionId: 'session_123' });
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].message).toBe('Test message');
      expect(logs[0].level).toBe('info');
    });

    it('should respect log levels', async () => {
      const debugLogger = new CentralLogger('in-memory', { logLevel: 'error' });
      
      await debugLogger.debug('Debug message');
      await debugLogger.info('Info message');
      await debugLogger.warn('Warn message');
      await debugLogger.error('Error message', new Error('Test error'));
      
      const logs = await debugLogger.queryLogs({});
      // Only error should be logged
      expect(logs.length).toBe(1);
      expect(logs[0].level).toBe('error');
    });

    it('should query logs with filters', async () => {
      await logger.info('Message 1', {}, 'session_1');
      await logger.info('Message 2', {}, 'session_2');
      await logger.error('Error message', new Error('Test'), {}, 'session_1');
      
      const session1Logs = await logger.queryLogs({ sessionId: 'session_1' });
      expect(session1Logs.length).toBe(2);
      
      const errorLogs = await logger.queryLogs({ level: 'error' });
      expect(errorLogs.length).toBe(1);
      expect(errorLogs[0].level).toBe('error');
    });
  });

  describe('Agent Message Logging', () => {
    it('should log agent messages', async () => {
      const message = {
        id: 'msg_1',
        from: 'master',
        to: 'sub',
        type: 'REQUEST' as const,
        content: { task: 'test' },
        context: {
          threadId: 'thread_1',
          sessionId: 'session_1',
          conversationHistory: [],
          metadata: {}
        },
        timestamp: Date.now()
      };

      await logger.logAgentMessage(message, 'sent');
      
      const logs = await logger.queryLogs({ type: 'agent_to_agent' });
      expect(logs.length).toBeGreaterThan(0);
    });
  });
});

