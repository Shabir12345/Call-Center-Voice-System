/**
 * Abstract phone provider interface
 */

import { IncomingCallEvent, CallResponse, CallMetadata, PhoneProvider as ProviderType } from '../types/callTypes.js';

export interface IPhoneProvider {
  /**
   * Get the provider type
   */
  getProviderType(): ProviderType;

  /**
   * Parse incoming webhook payload
   */
  parseWebhookPayload(body: any, headers?: Record<string, string>): IncomingCallEvent;

  /**
   * Validate webhook authenticity
   */
  validateWebhook(body: any, headers: Record<string, string>, signature: string): boolean;

  /**
   * Generate call response (TwiML for Twilio, etc.)
   */
  generateCallResponse(response: CallResponse): string | any;

  /**
   * Extract call metadata from webhook
   */
  extractCallMetadata(body: any, headers?: Record<string, string>): CallMetadata;

  /**
   * Start transcription for a call
   */
  startTranscription(callSid: string): Promise<void>;

  /**
   * Send text-to-speech response
   */
  sendTTSResponse(callSid: string, text: string): Promise<void>;
}

