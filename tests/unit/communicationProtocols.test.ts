/**
 * Unit tests for Communication Protocols
 */

import { describe, it, expect } from 'vitest';
import {
  createMessage,
  createResponse,
  createClarification,
  validateProtocol,
  MESSAGE_TYPES
} from '../../utils/communicationProtocols';
import { createMockContext } from '../../utils/testHelpers';

describe('Communication Protocols', () => {
  describe('createMessage', () => {
    it('should create a valid REQUEST message', () => {
      const context = createMockContext();
      const message = createMessage(
        'master_agent',
        'sub_agent',
        'REQUEST',
        { task: 'test_task', parameters: {} },
        context
      );

      expect(message.from).toBe('master_agent');
      expect(message.to).toBe('sub_agent');
      expect(message.type).toBe('REQUEST');
      expect(message.content).toEqual({ task: 'test_task', parameters: {} });
      expect(message.id).toBeDefined();
      expect(message.timestamp).toBeDefined();
    });

    it('should include correlation ID when provided', () => {
      const context = createMockContext();
      const message = createMessage(
        'master_agent',
        'sub_agent',
        'QUERY',
        { question: 'test' },
        context,
        { correlationId: 'corr_123' }
      );

      expect(message.correlationId).toBe('corr_123');
    });
  });

  describe('createResponse', () => {
    it('should create a valid response message', () => {
      const originalMessage = createMessage(
        'master_agent',
        'sub_agent',
        'REQUEST',
        { task: 'test' },
        createMockContext()
      );

      const response = createResponse(
        originalMessage,
        'sub_agent',
        { status: 'success', data: {} }
      );

      expect(response.from).toBe('sub_agent');
      expect(response.to).toBe('master_agent');
      expect(response.type).toBe('INFORM');
      expect(response.correlationId).toBe(originalMessage.id);
      expect(response.content).toEqual({ status: 'success', data: {} });
    });
  });

  describe('createClarification', () => {
    it('should create a clarification message', () => {
      const originalMessage = createMessage(
        'master_agent',
        'sub_agent',
        'REQUEST',
        { task: 'test' },
        createMockContext()
      );

      const clarification = createClarification(
        originalMessage,
        'sub_agent',
        'What do you mean?'
      );

      expect(clarification.from).toBe('sub_agent');
      expect(clarification.to).toBe('master_agent');
      expect(clarification.type).toBe('CLARIFY');
      expect(clarification.content).toContain('What do you mean?');
    });
  });

  describe('validateProtocol', () => {
    it('should validate a correct message', () => {
      const message = createMessage(
        'master_agent',
        'sub_agent',
        'REQUEST',
        { task: 'test' },
        createMockContext()
      );

      const result = validateProtocol(message);
      expect(result.valid).toBe(true);
    });

    it('should reject message with missing required fields', () => {
      const invalidMessage = {
        from: 'master_agent',
        // Missing other required fields
      } as any;

      const result = validateProtocol(invalidMessage);
      expect(result.valid).toBe(false);
    });
  });

  describe('MESSAGE_TYPES', () => {
    it('should have all required message types', () => {
      expect(MESSAGE_TYPES.INFORM).toBeDefined();
      expect(MESSAGE_TYPES.QUERY).toBeDefined();
      expect(MESSAGE_TYPES.REQUEST).toBeDefined();
      expect(MESSAGE_TYPES.CONFIRM).toBeDefined();
      expect(MESSAGE_TYPES.CLARIFY).toBeDefined();
    });

    it('should have correct properties for each type', () => {
      expect(MESSAGE_TYPES.REQUEST.requiresResponse).toBe(true);
      expect(MESSAGE_TYPES.REQUEST.bidirectional).toBe(true);
      expect(MESSAGE_TYPES.INFORM.requiresResponse).toBe(false);
    });
  });
});

