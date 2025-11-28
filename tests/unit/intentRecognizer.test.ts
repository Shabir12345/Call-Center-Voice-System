/**
 * Unit tests for IntentRecognizer
 */

import { describe, it, expect } from 'vitest';
import { IntentRecognizer } from '../../utils/intentRecognizer';
import { ConversationContext } from '../../types';

const mockContext: ConversationContext = {
  threadId: 'thread_1',
  sessionId: 'session_1',
  conversationHistory: [],
  metadata: {}
};

describe('IntentRecognizer (pattern mode)', () => {
  // IMPORTANT: no API key → uses pattern matching, no live LLM calls
  const recognizer = new IntentRecognizer();

  it('should detect confirm_reservation intent', async () => {
    const result = await recognizer.parse('Can you confirm my reservation?', mockContext);
    expect(result.intent).toBe('confirm_reservation');
    expect(result.task).toBe('confirm_reservation');
    expect(result.confidence).toBeGreaterThan(0.3);
  });

  it('should detect get_billing_info intent', async () => {
    const result = await recognizer.parse("What's my bill for this month?", mockContext);
    expect(result.intent).toBe('get_billing_info');
    expect(result.task).toBe('get_billing_info');
  });

  it('should extract reservation number and date', async () => {
    const input = 'Please confirm reservation ABC123 on 2025-12-01';
    const result = await recognizer.parse(input, mockContext);
    expect(result.extractedEntities?.reservation_number).toBe('ABC123');
    expect(result.extractedEntities?.date).toBe('2025-12-01');
  });

  it('should return unknown for unrelated text', async () => {
    const result = await recognizer.parse('Blah blah something random', mockContext);
    expect(result.intent).toBe('unknown');
  });
});


