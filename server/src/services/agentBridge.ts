/**
 * Agent Bridge Service
 * 
 * Bridges phone calls to the AI agent system (SystemOrchestrator)
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { SystemOrchestrator, SystemConfig } from '../../../utils/systemOrchestrator.js';
import { CallSession, TranscriptionSegment } from '../types/callTypes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Since we're in a server environment, we need to handle imports carefully
// For now, we'll use a singleton pattern and lazy initialization

export class AgentBridge {
  private orchestrator: SystemOrchestrator | null = null;
  private initialized: boolean = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    // Lazy initialization
  }

  /**
   * Initialize the agent bridge with SystemOrchestrator
   */
  async initialize(config?: SystemConfig): Promise<void> {
    if (this.initialized) {
      return;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      try {
        // Use provided config or default
        const systemConfig: SystemConfig = config || {
          masterAgent: {
            agentId: 'phone_call_master',
            systemPrompt: 'You are a helpful AI assistant handling phone calls. Be conversational and natural.',
            intents: ['general_inquiry', 'support', 'information'],
            voiceSettings: {
              speed: 1.0,
              tone: 'professional',
              language: 'en',
            },
            guardrails: {
              bannedPhrases: [],
              fallbackResponse: "I'm sorry, I didn't catch that. Could you repeat?",
            },
          },
          logging: {
            level: 'info',
            maxLogs: 10000,
          },
          stateManagement: {
            storageType: 'session',
          },
        };

        // Dynamically import SystemOrchestrator
        // Note: This assumes the utils are available in the parent directory
        // In production, you may need to adjust this path based on your build structure
        const systemOrchestratorModule = await import('../../../utils/systemOrchestrator.js');
        const SystemOrchestrator = systemOrchestratorModule.SystemOrchestrator;
        
        this.orchestrator = new SystemOrchestrator(systemConfig);
        await this.orchestrator.initialize();
        this.initialized = true;

        console.log('Agent Bridge initialized successfully');
      } catch (error) {
        console.error('Failed to initialize Agent Bridge:', error);
        throw error;
      }
    })();

    return this.initPromise;
  }

  /**
   * Process transcribed text from a call through the AI agent
   */
  async processTranscription(
    transcription: TranscriptionSegment,
    session: CallSession
  ): Promise<string | null> {
    if (!transcription.isFinal || !transcription.text.trim()) {
      return null;
    }

    if (!this.initialized || !this.orchestrator) {
      await this.initialize();
      if (!this.orchestrator) {
        throw new Error('Failed to initialize orchestrator');
      }
    }

    try {
      // Use call SID as session ID
      const sessionId = session.callSid;
      
      // Use caller number as user ID for personalization
      const userId = session.callerNumber;

      // Process through orchestrator
      const response = await this.orchestrator.processCallerInput(
        transcription.text,
        sessionId,
        userId
      );

      // Add agent response to session history
      session.conversationHistory.push({
        role: 'agent',
        content: response,
        timestamp: new Date(),
      });

      return response;
    } catch (error) {
      console.error(`Error processing transcription for session ${session.callSid}:`, error);
      return "I'm sorry, I'm having trouble processing that. Could you try again?";
    }
  }

  /**
   * Process caller input directly (for testing or manual input)
   */
  async processCallerInput(
    input: string,
    sessionId: string,
    userId?: string
  ): Promise<string> {
    if (!this.initialized || !this.orchestrator) {
      await this.initialize();
      if (!this.orchestrator) {
        throw new Error('Failed to initialize orchestrator');
      }
    }

    return await this.orchestrator.processCallerInput(input, sessionId, userId);
  }

  /**
   * Get orchestrator instance (for advanced usage)
   */
  getOrchestrator(): SystemOrchestrator | null {
    return this.orchestrator;
  }

  /**
   * Check if bridge is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Shutdown the agent bridge
   */
  async shutdown(): Promise<void> {
    if (this.orchestrator) {
      await this.orchestrator.shutdown();
      this.orchestrator = null;
      this.initialized = false;
    }
  }
}

// Singleton instance
let agentBridgeInstance: AgentBridge | null = null;

export function getAgentBridge(): AgentBridge {
  if (!agentBridgeInstance) {
    agentBridgeInstance = new AgentBridge();
  }
  return agentBridgeInstance;
}

