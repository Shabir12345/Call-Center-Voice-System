/**
 * Call handler service tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CallHandler } from '../services/callHandler.js';

describe('CallHandler', () => {
  let callHandler: CallHandler;

  beforeEach(() => {
    // Set up test environment variables
    process.env.PHONE_PROVIDER = 'twilio';
    process.env.TWILIO_ACCOUNT_SID = 'test-sid';
    process.env.TWILIO_AUTH_TOKEN = 'test-token';
    process.env.TWILIO_PHONE_NUMBER = '+1234567890';
    process.env.WEBHOOK_BASE_URL = 'http://localhost:3001';

    callHandler = new CallHandler();
  });

  describe('handleIncomingCall', () => {
    it('should create a new call session', async () => {
      const result = await callHandler.handleIncomingCall(
        'twilio',
        {
          CallSid: 'test-call-123',
          From: '+1234567890',
          To: '+0987654321',
          CallStatus: 'ringing',
        },
        {}
      );

      expect(result.event.callSid).toBe('test-call-123');
      expect(result.session.callerNumber).toBe('+1234567890');
      expect(result.session.calledNumber).toBe('+0987654321');
    });

    it('should retrieve existing session for same call', async () => {
      await callHandler.handleIncomingCall(
        'twilio',
        {
          CallSid: 'test-call-123',
          From: '+1234567890',
          To: '+0987654321',
          CallStatus: 'ringing',
        },
        {}
      );

      const session = callHandler.getSession('test-call-123');
      expect(session).toBeDefined();
      expect(session?.callSid).toBe('test-call-123');
    });
  });

  describe('handleCallStatusUpdate', () => {
    it('should update session status', async () => {
      // Create a session first
      await callHandler.handleIncomingCall(
        'twilio',
        {
          CallSid: 'test-call-123',
          From: '+1234567890',
          To: '+0987654321',
          CallStatus: 'ringing',
        },
        {}
      );

      // Update status
      const updated = await callHandler.handleCallStatusUpdate(
        'twilio',
        {
          CallSid: 'test-call-123',
          CallStatus: 'completed',
        },
        {}
      );

      expect(updated?.status).toBe('completed');
      expect(updated?.endTime).toBeDefined();
    });
  });

  describe('handleTranscription', () => {
    it('should add transcription to session', async () => {
      // Create a session first
      await callHandler.handleIncomingCall(
        'twilio',
        {
          CallSid: 'test-call-123',
          From: '+1234567890',
          To: '+0987654321',
          CallStatus: 'ringing',
        },
        {}
      );

      // Add transcription
      const transcription = await callHandler.handleTranscription(
        'twilio',
        {
          CallSid: 'test-call-123',
          TranscriptionText: 'Hello, this is a test',
          TranscriptionStatus: 'completed',
        },
        {}
      );

      expect(transcription).toBeDefined();
      expect(transcription?.text).toBe('Hello, this is a test');
      expect(transcription?.isFinal).toBe(true);

      // Check session has transcription
      const session = callHandler.getSession('test-call-123');
      expect(session?.transcriptionSegments.length).toBeGreaterThan(0);
      expect(session?.conversationHistory.length).toBeGreaterThan(0);
    });
  });
});

