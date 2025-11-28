/**
 * Call Handler Service
 * 
 * Main service for processing incoming call webhooks and managing call sessions
 */

import { IncomingCallEvent, CallSession, CallStatus, TranscriptionSegment, ConversationMessage } from '../types/callTypes.js';
import { IPhoneProvider } from './phoneProvider.js';
import { TwilioProvider } from './twilioProvider.js';
import { TelnyxProvider } from './telnyxProvider.js';
import { loadPhoneProviderConfig } from '../config/phoneProviders.js';

export class CallHandler {
  private activeSessions: Map<string, CallSession> = new Map();
  private providers: Map<string, IPhoneProvider> = new Map();
  private providerConfig: ReturnType<typeof loadPhoneProviderConfig>;

  constructor() {
    this.providerConfig = loadPhoneProviderConfig();
    this.initializeProviders();
  }

  /**
   * Initialize phone providers based on configuration
   */
  private initializeProviders(): void {
    if (this.providerConfig.twilio) {
      const twilioProvider = new TwilioProvider(
        this.providerConfig.twilio.accountSid,
        this.providerConfig.twilio.authToken,
        this.providerConfig.webhookSecret
      );
      this.providers.set('twilio', twilioProvider);
    }

    if (this.providerConfig.telnyx) {
      const telnyxProvider = new TelnyxProvider(
        this.providerConfig.telnyx.apiKey,
        this.providerConfig.webhookSecret
      );
      this.providers.set('telnyx', telnyxProvider);
    }
  }

  /**
   * Get provider instance
   */
  getProvider(provider: string): IPhoneProvider | undefined {
    return this.providers.get(provider);
  }

  /**
   * Handle incoming call webhook
   */
  async handleIncomingCall(
    provider: string,
    body: any,
    headers: Record<string, string>
  ): Promise<{ event: IncomingCallEvent; session: CallSession }> {
    const phoneProvider = this.getProvider(provider);
    if (!phoneProvider) {
      throw new Error(`Provider ${provider} not configured`);
    }

    // Parse webhook payload
    const event = phoneProvider.parseWebhookPayload(body, headers);

    // Create or retrieve call session
    const session = await this.createOrGetSession(event);

    // Log incoming call
    console.log(`Incoming call from ${event.from} to ${event.to} via ${provider}`);

    return { event, session };
  }

  /**
   * Handle call status update
   */
  async handleCallStatusUpdate(
    provider: string,
    body: any,
    headers: Record<string, string>
  ): Promise<CallSession | null> {
    const phoneProvider = this.getProvider(provider);
    if (!phoneProvider) {
      throw new Error(`Provider ${provider} not configured`);
    }

    const event = phoneProvider.parseWebhookPayload(body, headers);
    const session = this.activeSessions.get(event.callSid);

    if (!session) {
      console.warn(`Call status update for unknown call: ${event.callSid}`);
      return null;
    }

    // Update session status
    session.status = event.callStatus;
    
    if (event.callStatus === 'completed' || event.callStatus === 'failed' || event.callStatus === 'canceled') {
      session.endTime = new Date();
      // Cleanup session after a delay
      setTimeout(() => this.cleanupSession(event.callSid), 300000); // 5 minutes
    }

    return session;
  }

  /**
   * Handle transcription segment
   */
  async handleTranscription(
    provider: string,
    body: any,
    headers: Record<string, string>
  ): Promise<TranscriptionSegment | null> {
    const phoneProvider = this.getProvider(provider);
    if (!phoneProvider) {
      throw new Error(`Provider ${provider} not configured`);
    }

    // Extract transcription data from webhook
    let transcription: TranscriptionSegment;

    if (provider === 'twilio') {
      transcription = {
        text: body.TranscriptionText || body.transcription_text || '',
        timestamp: new Date(),
        isFinal: body.TranscriptionStatus === 'completed',
        confidence: body.Confidence ? parseFloat(body.Confidence) : undefined,
      };
    } else if (provider === 'telnyx') {
      const data = body.data || body;
      transcription = {
        text: data.text || '',
        timestamp: new Date(data.occurred_at || Date.now()),
        isFinal: data.status === 'completed',
        confidence: data.confidence ? parseFloat(data.confidence) : undefined,
      };
    } else {
      throw new Error(`Transcription not supported for provider: ${provider}`);
    }

    // Add to session
    const callSid = provider === 'twilio' 
      ? body.CallSid || body.call_sid 
      : body.data?.call_control_id || body.call_control_id;
    
    const session = this.activeSessions.get(callSid);
    if (session && transcription.text) {
      session.transcriptionSegments.push(transcription);

      // Add to conversation history if final
      if (transcription.isFinal) {
        session.conversationHistory.push({
          role: 'caller',
          content: transcription.text,
          timestamp: transcription.timestamp,
        });
      }
    }

    return transcription;
  }

  /**
   * Create or get call session
   */
  private async createOrGetSession(event: IncomingCallEvent): Promise<CallSession> {
    let session = this.activeSessions.get(event.callSid);

    if (!session) {
      session = {
        sessionId: event.callSid,
        callSid: event.callSid,
        provider: event.provider,
        callerNumber: event.from,
        calledNumber: event.to,
        status: event.callStatus,
        startTime: event.timestamp,
        transcriptionSegments: [],
        conversationHistory: [],
        metadata: event.metadata,
      };

      this.activeSessions.set(event.callSid, session);
    }

    return session;
  }

  /**
   * Get active session by call SID
   */
  getSession(callSid: string): CallSession | undefined {
    return this.activeSessions.get(callSid);
  }

  /**
   * Add agent response to conversation history
   */
  addAgentResponse(callSid: string, response: string): void {
    const session = this.activeSessions.get(callSid);
    if (session) {
      session.conversationHistory.push({
        role: 'agent',
        content: response,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Cleanup session
   */
  private cleanupSession(callSid: string): void {
    this.activeSessions.delete(callSid);
    console.log(`Cleaned up session for call ${callSid}`);
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): CallSession[] {
    return Array.from(this.activeSessions.values());
  }
}

