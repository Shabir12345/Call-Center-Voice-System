/**
 * Webhook endpoint tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import callsRouter from '../routes/calls.js';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/webhooks', callsRouter);

describe('Webhook Endpoints', () => {
  beforeEach(() => {
    // Set up test environment variables
    process.env.GEMINI_API_KEY = 'test-api-key';
    process.env.PHONE_PROVIDER = 'twilio';
    process.env.TWILIO_ACCOUNT_SID = 'test-sid';
    process.env.TWILIO_AUTH_TOKEN = 'test-token';
    process.env.TWILIO_PHONE_NUMBER = '+1234567890';
  });

  describe('Twilio Webhooks', () => {
    it('should handle incoming call webhook', async () => {
      const response = await request(app)
        .post('/webhooks/twilio/incoming')
        .send({
          CallSid: 'test-call-123',
          From: '+1234567890',
          To: '+0987654321',
          CallStatus: 'ringing',
        })
        .expect(200);

      expect(response.headers['content-type']).toMatch(/text\/xml/);
      expect(response.text).toContain('<?xml');
    });

    it('should handle call status webhook', async () => {
      const response = await request(app)
        .post('/webhooks/twilio/status')
        .send({
          CallSid: 'test-call-123',
          CallStatus: 'completed',
        })
        .expect(200);

      expect(response.body.status).toBe('ok');
    });

    it('should handle transcription webhook', async () => {
      const response = await request(app)
        .post('/webhooks/twilio/transcription')
        .send({
          CallSid: 'test-call-123',
          TranscriptionText: 'Hello, this is a test',
          TranscriptionStatus: 'completed',
        })
        .expect(200);

      expect(response.body.status).toBe('ok');
    });
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.status).toBe('ok');
      expect(response.body.timestamp).toBeDefined();
    });
  });
});

