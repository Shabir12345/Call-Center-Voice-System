/**
 * Twilio phone provider implementation
 */

import twilio, { twiml } from 'twilio';
import { IPhoneProvider } from './phoneProvider.js';
import { IncomingCallEvent, CallResponse, CallMetadata, CallStatus, PhoneProvider } from '../types/callTypes.js';

export class TwilioProvider implements IPhoneProvider {
  private client: twilio.Twilio;
  private accountSid: string;
  private authToken: string;
  private webhookSecret?: string;

  constructor(accountSid: string, authToken: string, webhookSecret?: string) {
    this.accountSid = accountSid;
    this.authToken = authToken;
    this.webhookSecret = webhookSecret;
    this.client = twilio(accountSid, authToken);
  }

  getProviderType(): PhoneProvider {
    return 'twilio';
  }

  parseWebhookPayload(body: any, headers?: Record<string, string>): IncomingCallEvent {
    return {
      provider: 'twilio',
      callSid: body.CallSid || body.call_sid || '',
      from: body.From || body.from || '',
      to: body.To || body.to || '',
      callStatus: this.mapTwilioStatus(body.CallStatus || body.call_status || 'ringing'),
      timestamp: new Date(),
      metadata: {
        ...body,
        headers,
      },
    };
  }

  validateWebhook(body: any, headers: Record<string, string>, signature: string): boolean {
    if (!this.webhookSecret) {
      // If no secret is configured, skip validation (not recommended for production)
      return true;
    }

    const twilioSignature = headers['x-twilio-signature'];
    if (!twilioSignature) {
      return false;
    }

    // Twilio validation logic would go here
    // For now, we'll do basic signature comparison
    try {
      return twilio.validateRequest(
        this.authToken,
        twilioSignature,
        this.webhookSecret,
        body
      );
    } catch (error) {
      console.error('Twilio webhook validation error:', error);
      return false;
    }
  }

  generateCallResponse(response: CallResponse): string {
    const twimlResponse = new twiml.VoiceResponse();

    if (response.status === 'answered') {
      if (response.twiml) {
        // Return custom TwiML if provided
        return response.twiml;
      }

      // Default: Say greeting and start gathering input
      twimlResponse.say({
        voice: 'alice',
        language: 'en-US',
      }, response.message || 'Hello, how can I help you today?');

      // Start gathering speech input
      const gather = twimlResponse.gather({
        input: ['speech'],
        action: '/webhooks/twilio/transcription',
        method: 'POST',
        speechTimeout: 'auto',
        language: 'en-US',
      });

      // Fallback if no speech detected
      twimlResponse.say('I did not receive any input. Goodbye.');
    } else if (response.status === 'voicemail') {
      twimlResponse.say('Please leave a message after the beep.');
      twimlResponse.record({
        action: '/webhooks/twilio/recording',
        method: 'POST',
      });
    } else {
      twimlResponse.say('Goodbye.');
      twimlResponse.hangup();
    }

    return twimlResponse.toString();
  }

  extractCallMetadata(body: any, headers?: Record<string, string>): CallMetadata {
    return {
      callerId: body.From || body.from || '',
      callerName: body.CallerName || body.caller_name || undefined,
      calledNumber: body.To || body.to || '',
      timestamp: new Date(),
      provider: 'twilio',
      callSid: body.CallSid || body.call_sid || '',
      direction: body.Direction === 'inbound' ? 'inbound' : 'outbound',
      recordingUrl: body.RecordingUrl || undefined,
      duration: body.Duration ? parseInt(body.Duration, 10) : undefined,
    };
  }

  async startTranscription(callSid: string): Promise<void> {
    try {
      // Start transcription using Twilio's Transcription API
      await this.client.calls(callSid).recordings.create({
        recordingStatusCallback: `${process.env.WEBHOOK_BASE_URL}/webhooks/twilio/transcription`,
        recordingStatusCallbackMethod: 'POST',
      });
    } catch (error) {
      console.error(`Error starting transcription for call ${callSid}:`, error);
      throw error;
    }
  }

  async sendTTSResponse(callSid: string, text: string): Promise<void> {
    try {
      // Update the call with new TwiML containing the TTS response
      const twimlResponse = new twiml.VoiceResponse();
      twimlResponse.say({
        voice: 'alice',
        language: 'en-US',
      }, text);

      await this.client.calls(callSid).update({
        twiml: twimlResponse.toString(),
      });
    } catch (error) {
      console.error(`Error sending TTS response for call ${callSid}:`, error);
      throw error;
    }
  }

  private mapTwilioStatus(status: string): CallStatus {
    const statusMap: Record<string, CallStatus> = {
      'ringing': 'ringing',
      'in-progress': 'in-progress',
      'completed': 'completed',
      'busy': 'busy',
      'failed': 'failed',
      'no-answer': 'no-answer',
      'canceled': 'canceled',
    };

    return statusMap[status.toLowerCase()] || 'ringing';
  }
}

