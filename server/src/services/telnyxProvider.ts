/**
 * Telnyx phone provider implementation
 */

import Telnyx from '@telnyx/telnyx-node';
import { IPhoneProvider } from './phoneProvider.js';
import { IncomingCallEvent, CallResponse, CallMetadata, CallStatus, PhoneProvider } from '../types/callTypes.js';

export class TelnyxProvider implements IPhoneProvider {
  private client: Telnyx;
  private apiKey: string;
  private webhookSecret?: string;

  constructor(apiKey: string, webhookSecret?: string) {
    this.apiKey = apiKey;
    this.webhookSecret = webhookSecret;
    this.client = new Telnyx(apiKey);
  }

  getProviderType(): PhoneProvider {
    return 'telnyx';
  }

  parseWebhookPayload(body: any, headers?: Record<string, string>): IncomingCallEvent {
    const data = body.data || body;

    return {
      provider: 'telnyx',
      callSid: data.call_control_id || data.call_control_session_id || '',
      from: data.from || data.caller_id_number || '',
      to: data.to || data.destination_number || '',
      callStatus: this.mapTelnyxStatus(data.event_type || data.status || 'call.initiated'),
      timestamp: new Date(data.occurred_at || Date.now()),
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

    const telnyxSignature = headers['telnyx-signature-ed25519'];
    const telnyxTimestamp = headers['telnyx-timestamp'];

    if (!telnyxSignature || !telnyxTimestamp) {
      return false;
    }

    // Telnyx webhook validation would go here
    // For now, we'll do basic signature comparison
    try {
      // Telnyx uses Ed25519 signatures for webhook validation
      // This is a simplified check - production should use proper Ed25519 verification
      return telnyxSignature === signature;
    } catch (error) {
      console.error('Telnyx webhook validation error:', error);
      return false;
    }
  }

  generateCallResponse(response: CallResponse): any {
    // Telnyx uses Call Control API responses
    if (response.status === 'answered') {
      return {
        commands: [
          {
            command: 'answer',
          },
          {
            command: 'speak',
            payload: response.message || 'Hello, how can I help you today?',
            voice: 'female',
            language: 'en-US',
          },
          {
            command: 'start_transcription',
            transcription_track: 'inbound_track',
          },
        ],
      };
    } else if (response.status === 'rejected') {
      return {
        commands: [
          {
            command: 'hangup',
          },
        ],
      };
    }

    return {
      commands: [
        {
          command: 'hangup',
        },
      ],
    };
  }

  extractCallMetadata(body: any, headers?: Record<string, string>): CallMetadata {
    const data = body.data || body;

    return {
      callerId: data.from || data.caller_id_number || '',
      callerName: data.caller_name || undefined,
      calledNumber: data.to || data.destination_number || '',
      timestamp: new Date(data.occurred_at || Date.now()),
      provider: 'telnyx',
      callSid: data.call_control_id || data.call_control_session_id || '',
      direction: data.direction === 'inbound' ? 'inbound' : 'outbound',
      recordingUrl: data.recording_url || undefined,
      duration: data.duration ? parseInt(data.duration, 10) : undefined,
    };
  }

  async startTranscription(callSid: string): Promise<void> {
    try {
      // Start transcription using Telnyx Call Control API
      await this.client.calls.update(callSid, {
        commands: [
          {
            command: 'start_transcription',
            transcription_track: 'inbound_track',
          },
        ],
      });
    } catch (error) {
      console.error(`Error starting transcription for call ${callSid}:`, error);
      throw error;
    }
  }

  async sendTTSResponse(callSid: string, text: string): Promise<void> {
    try {
      // Send TTS response using Telnyx Call Control API
      await this.client.calls.update(callSid, {
        commands: [
          {
            command: 'speak',
            payload: text,
            voice: 'female',
            language: 'en-US',
          },
        ],
      });
    } catch (error) {
      console.error(`Error sending TTS response for call ${callSid}:`, error);
      throw error;
    }
  }

  private mapTelnyxStatus(status: string): CallStatus {
    // Telnyx event types: call.initiated, call.answered, call.hangup, etc.
    if (status.includes('initiated') || status.includes('ringing')) {
      return 'ringing';
    }
    if (status.includes('answered') || status.includes('in-progress')) {
      return 'in-progress';
    }
    if (status.includes('completed') || status.includes('hangup')) {
      return 'completed';
    }
    if (status.includes('busy')) {
      return 'busy';
    }
    if (status.includes('failed')) {
      return 'failed';
    }
    if (status.includes('no-answer')) {
      return 'no-answer';
    }
    if (status.includes('canceled')) {
      return 'canceled';
    }

    return 'ringing';
  }
}

