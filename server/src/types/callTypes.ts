/**
 * Type definitions for incoming call handling
 */

export type PhoneProvider = 'twilio' | 'telnyx' | 'both';

export interface IncomingCallEvent {
  provider: PhoneProvider;
  callSid: string;
  from: string;
  to: string;
  callStatus: CallStatus;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export type CallStatus = 
  | 'ringing' 
  | 'in-progress' 
  | 'completed' 
  | 'busy' 
  | 'failed' 
  | 'no-answer' 
  | 'canceled';

export interface CallSession {
  sessionId: string;
  callSid: string;
  provider: PhoneProvider;
  callerNumber: string;
  calledNumber: string;
  status: CallStatus;
  startTime: Date;
  endTime?: Date;
  transcriptionSegments: TranscriptionSegment[];
  conversationHistory: ConversationMessage[];
  metadata?: Record<string, any>;
}

export interface TranscriptionSegment {
  text: string;
  timestamp: Date;
  isFinal: boolean;
  confidence?: number;
}

export interface ConversationMessage {
  role: 'caller' | 'agent';
  content: string;
  timestamp: Date;
}

export interface CallMetadata {
  callerId: string;
  callerName?: string;
  calledNumber: string;
  timestamp: Date;
  provider: PhoneProvider;
  callSid: string;
  direction?: 'inbound' | 'outbound';
  recordingUrl?: string;
  duration?: number;
}

export interface PhoneProviderConfig {
  provider: PhoneProvider;
  enabled: boolean;
  accountSid?: string;
  authToken?: string;
  apiKey?: string;
  phoneNumber: string;
  webhookUrl: string;
  webhookSecret?: string;
}

export interface CallResponse {
  status: 'answered' | 'rejected' | 'voicemail';
  twiml?: string; // For Twilio
  telnyxResponse?: any; // For Telnyx
  message?: string;
}

export interface VoiceProcessingOptions {
  enableTranscription: boolean;
  enableTTS: boolean;
  language?: string;
  sampleRate?: number;
}

