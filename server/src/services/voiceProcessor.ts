/**
 * Voice Processor Service
 * 
 * Handles voice processing: transcription and text-to-speech
 */

import { CallSession, TranscriptionSegment } from '../types/callTypes.js';
import { IPhoneProvider } from './phoneProvider.js';
import { AgentBridge } from './agentBridge.js';
import { CallHandler } from './callHandler.js';

export interface VoiceProcessingResult {
  responseText: string;
  shouldSendTTS: boolean;
}

export class VoiceProcessor {
  private agentBridge: AgentBridge;
  private callHandler: CallHandler;

  constructor(agentBridge: AgentBridge, callHandler: CallHandler) {
    this.agentBridge = agentBridge;
    this.callHandler = callHandler;
  }

  /**
   * Process a transcription segment and get AI response
   */
  async processTranscriptionSegment(
    transcription: TranscriptionSegment,
    callSid: string,
    provider: IPhoneProvider
  ): Promise<VoiceProcessingResult | null> {
    // Get call session
    const session = this.callHandler.getSession(callSid);
    if (!session) {
      console.warn(`No session found for call ${callSid}`);
      return null;
    }

    // Only process final transcriptions
    if (!transcription.isFinal || !transcription.text.trim()) {
      return null;
    }

    try {
      // Process through AI agent
      const responseText = await this.agentBridge.processTranscription(transcription, session);
      
      if (!responseText) {
        return null;
      }

      // Add agent response to call handler
      this.callHandler.addAgentResponse(callSid, responseText);

      return {
        responseText,
        shouldSendTTS: true,
      };
    } catch (error) {
      console.error(`Error processing transcription for call ${callSid}:`, error);
      return {
        responseText: "I'm sorry, I'm having trouble processing that. Could you try again?",
        shouldSendTTS: true,
      };
    }
  }

  /**
   * Send AI response as text-to-speech through phone provider
   */
  async sendResponse(
    callSid: string,
    responseText: string,
    provider: IPhoneProvider
  ): Promise<void> {
    try {
      await provider.sendTTSResponse(callSid, responseText);
    } catch (error) {
      console.error(`Error sending TTS response for call ${callSid}:`, error);
      throw error;
    }
  }

  /**
   * Start transcription for a call
   */
  async startTranscription(
    callSid: string,
    provider: IPhoneProvider
  ): Promise<void> {
    try {
      await provider.startTranscription(callSid);
    } catch (error) {
      console.error(`Error starting transcription for call ${callSid}:`, error);
      throw error;
    }
  }

  /**
   * Process complete transcription flow
   * Handles transcription → AI processing → TTS response
   */
  async processCompleteFlow(
    transcription: TranscriptionSegment,
    callSid: string,
    provider: IPhoneProvider
  ): Promise<void> {
    // Process transcription and get response
    const result = await this.processTranscriptionSegment(transcription, callSid, provider);
    
    if (result && result.shouldSendTTS) {
      // Send TTS response
      await this.sendResponse(callSid, result.responseText, provider);
    }
  }
}

