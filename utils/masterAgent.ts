/**
 * Master Agent
 * 
 * Central coordinator that interfaces with callers and orchestrates sub-agents.
 * Handles intent recognition, routing, context management, and response formatting.
 */

import { AgentMessage, ConversationContext, MessageType } from '../types';
import { CommunicationManager } from './agentCommunication';
import { StateManager, Session, HistoryEntry } from './stateManager';
import { CentralLogger } from './logger';
import { EnhancedValidator } from './enhancedValidator';
import { createMessage } from './communicationProtocols';
import { masterToSubAgentInputSchema, getTaskSchema } from './schemas';

/**
 * Intent recognition result
 */
export interface IntentResult {
  intent: string;
  task: string;
  parameters: Record<string, any>;
  confidence: number;
  extractedEntities?: Record<string, any>;
}

/**
 * Master Agent configuration
 */
export interface MasterAgentConfig {
  agentId: string;
  systemPrompt: string;
  voiceSettings?: {
    speed?: number;
    tone?: string;
    language?: string;
  };
  intents: string[];
  guardrails?: {
    bannedPhrases?: string[];
    fallbackResponse?: string;
  };
  bidirectionalEnabled?: boolean;
  communicationTimeout?: number;
  // Optional callbacks for visual feedback
  onSystemMessage?: (message: string) => void;
  onAgentActive?: (agentId: string) => void;
  onEdgeAnimate?: (source: string, target: string) => void;
}

/**
 * Master Agent class
 */
export class MasterAgent {
  private config: MasterAgentConfig;
  private communicationManager: CommunicationManager;
  private stateManager: StateManager;
  private logger: CentralLogger;
  private validator: EnhancedValidator;
  private intentToAgentMap: Map<string, string> = new Map();

  constructor(
    config: MasterAgentConfig,
    communicationManager: CommunicationManager,
    stateManager: StateManager,
    logger: CentralLogger
  ) {
    this.config = config;
    this.communicationManager = communicationManager;
    this.stateManager = stateManager;
    this.logger = logger;
    this.validator = new EnhancedValidator();

    // Register master agent with communication manager
    this.communicationManager.registerAgent(
      config.agentId,
      this.handleIncomingMessage.bind(this)
    );

    // Set up intent-to-agent mapping
    this.setupIntentMapping();
  }

  /**
   * Process caller input - main entry point
   */
  async processCallerInput(
    callerInput: string,
    sessionId: string
  ): Promise<string> {
    try {
      // 1. Create or retrieve session
      const session = await this.stateManager.getOrCreateSession(sessionId);

      // 2. Log caller input
      this.logger.log({
        type: 'caller_to_agent',
        from: 'caller',
        to: this.config.agentId,
        message: callerInput,
        sessionId,
        metadata: {
          timestamp: Date.now()
        }
      });

      // Add to history
      await this.stateManager.addToHistory(sessionId, {
        role: 'caller',
        content: callerInput,
        timestamp: Date.now()
      });

      // 3. Parse and extract intent
      const intentResult = await this.parseIntent(callerInput, session);

      // 4. Check session memory for relevant data before querying sub-agents
      const memoryCheck = this.checkSessionMemory(intentResult, session);
      if (memoryCheck.found) {
        // Use data from memory instead of querying sub-agent
        this.logger.log({
          type: 'memory_hit',
          from: this.config.agentId,
          message: `Using data from session memory for intent: ${intentResult.intent}`,
          sessionId,
          metadata: {
            memoryKey: memoryCheck.memoryKey,
            intent: intentResult.intent
          }
        });
        return this.formatResponseFromMemory(memoryCheck.data, intentResult, session);
      }

      // 5. Apply guardrails
      const guardrailCheck = this.checkGuardrails(callerInput);
      if (!guardrailCheck.allowed) {
        return guardrailCheck.response || this.config.guardrails?.fallbackResponse || 
          "I'm sorry, I can't help with that. Is there something else I can assist you with?";
      }

      // 6. Determine target sub-agent
      const targetAgent = this.determineAgent(intentResult.intent);
      
      // Emit system message when consulting sub-agent
      if (targetAgent && this.config.onSystemMessage) {
        // Try to get agent name from registry or config
        const agentName = targetAgent; // Could be enhanced to get actual name
        this.config.onSystemMessage(`🔵 Consulting ${agentName}...`);
      }
      
      // Emit visual feedback
      if (targetAgent) {
        if (this.config.onAgentActive) {
          this.config.onAgentActive(targetAgent);
        }
        if (this.config.onEdgeAnimate && this.config.agentId) {
          this.config.onEdgeAnimate(this.config.agentId, targetAgent);
        }
      }
      
      if (!targetAgent) {
        // For new sessions with unknown intent, combine greeting with clarification
        if (session.history.length === 1 && this.shouldGreetFirst()) {
          const greeting = this.generateGreeting(session);
          const clarification = "I'm sorry, I don't quite understand what you're asking for. Could you please rephrase your request?";
          const combined = `${greeting} ${clarification}`;
          await this.stateManager.addToHistory(sessionId, {
            role: 'agent',
            content: combined,
            timestamp: Date.now()
          });
          return combined;
        }
        return "I'm sorry, I don't quite understand what you're asking for. Could you please rephrase your request?";
      }

      // Don't greet if we have a valid request to process - just process it

      // 6. Build structured input
      const structuredInput = this.buildStructuredInput(intentResult, session);

      // 7. Validate input
      const validation = this.validator.validateInput(
        structuredInput,
        getTaskSchema(intentResult.task)
      );

      if (!validation.isValid) {
        this.logger.error('Input validation failed', validation.error);
        return "I'm having trouble understanding your request. Could you provide more details?";
      }

      // 8. Send to sub-agent via communication manager
      const response = await this.communicationManager.sendAndWait(
        createMessage(
          this.config.agentId,
          targetAgent,
          'REQUEST',
          structuredInput,
          session.context,
          {
            priority: 'normal',
            timeout: this.config.communicationTimeout || 30000
          }
        ),
        this.config.communicationTimeout || 30000
      );

      // 9. Process sub-agent response
      const formattedResponse = await this.processSubAgentResponse(
        response,
        session,
        intentResult
      );

      // 10. Store important data in session memory if response was successful
      if (response.status === 'success' && response.data) {
        await this.storeInSessionMemory(response.data, intentResult, sessionId);
      }

      // 11. Log agent response
      this.logger.log({
        type: 'agent_to_caller',
        from: this.config.agentId,
        to: 'caller',
        message: formattedResponse,
        sessionId,
        metadata: {
          intent: intentResult.intent,
          task: intentResult.task
        }
      });

      // Add to history
      await this.stateManager.addToHistory(sessionId, {
        role: 'agent',
        content: formattedResponse,
        timestamp: Date.now()
      });

      return formattedResponse;

    } catch (error: any) {
      this.logger.error('Error processing caller input', error, {
        sessionId,
        input: callerInput
      });

      return this.handleError(error, sessionId);
    }
  }

  /**
   * Parse intent from caller input
   */
  private async parseIntent(
    input: string,
    session: Session
  ): Promise<IntentResult> {
    // Simple keyword-based intent recognition
    // In production, this would use NLP/ML models
    
    const lowerInput = input.toLowerCase();
    const extractedParams = this.extractReservationParameters(input, session);

    // Check if this looks like a continuation of a reservation confirmation
    // (has reservation number but no explicit reservation keyword)
    if (extractedParams.reservation_number && !lowerInput.includes('reservation') && !lowerInput.includes('booking')) {
      // Check recent history - if there's any conversation, assume continuation
      // This handles cases where user provides reservation details after being asked
      const recentHistory = session.getRecentHistory(5);
      if (recentHistory.length > 0) {
        // Check if previous caller message mentioned reservation/confirm
        const previousCallerMessages = recentHistory.filter(e => e.role === 'caller');
        const hadReservationIntent = previousCallerMessages.some(e => {
          const content = e.content.toLowerCase();
          return content.includes('reservation') || content.includes('confirm');
        });
        
        // If user previously mentioned reservation/confirm, treat this as a continuation
        // Only check for reservation intent to avoid false positives
        if (hadReservationIntent) {
          return {
            intent: 'confirm_reservation',
            task: 'confirm_reservation',
            parameters: extractedParams,
            confidence: 0.85
          };
        }
      }
    }

    // Check for reservation-related intents
    if (lowerInput.includes('reservation') || lowerInput.includes('booking')) {
      if (lowerInput.includes('confirm') || lowerInput.includes('check')) {
        return {
          intent: 'confirm_reservation',
          task: 'confirm_reservation',
          parameters: extractedParams,
          confidence: 0.9
        };
      }
      // Check for follow-up questions about reservation details (room type, dates, price)
      if (lowerInput.includes('room') && (lowerInput.includes('what kind') || lowerInput.includes('type') || lowerInput.includes('which'))) {
        return {
          intent: 'view_reservation_details',
          task: 'view_reservation_details',
          parameters: {},
          confidence: 0.85
        };
      }
      if ((lowerInput.includes('date') || lowerInput.includes('when') || lowerInput.includes('check-in') || lowerInput.includes('check-out')) && 
          (lowerInput.includes('my') || lowerInput.includes('the') || lowerInput.includes('reservation'))) {
        return {
          intent: 'view_reservation_details',
          task: 'view_reservation_details',
          parameters: {},
          confidence: 0.85
        };
      }
      if ((lowerInput.includes('price') || lowerInput.includes('cost') || lowerInput.includes('amount') || lowerInput.includes('total')) && 
          (lowerInput.includes('my') || lowerInput.includes('the') || lowerInput.includes('reservation'))) {
        return {
          intent: 'view_reservation_details',
          task: 'view_reservation_details',
          parameters: {},
          confidence: 0.85
        };
      }
      if (lowerInput.includes('cancel')) {
        return {
          intent: 'cancel_reservation',
          task: 'cancel_reservation',
          parameters: {},
          confidence: 0.9
        };
      }
      if (lowerInput.includes('modify') || lowerInput.includes('change')) {
        return {
          intent: 'modify_reservation',
          task: 'modify_reservation',
          parameters: {},
          confidence: 0.9
        };
      }
    }

    // Check for billing-related intents
    if (lowerInput.includes('bill') || lowerInput.includes('invoice') || lowerInput.includes('payment')) {
      return {
        intent: 'get_billing_info',
        task: 'get_billing_info',
        parameters: this.extractBillingParameters(input),
        confidence: 0.85
      };
    }

    // Check for support-related intents
    if (lowerInput.includes('help') || lowerInput.includes('support') || lowerInput.includes('issue')) {
      return {
        intent: 'create_support_ticket',
        task: 'create_support_ticket',
        parameters: {
          issue_type: 'other',
          description: input,
          severity: 'medium'
        },
        confidence: 0.8
      };
    }

    // Default fallback
    return {
      intent: 'general_inquiry',
      task: 'general_inquiry',
      parameters: { query: input },
      confidence: 0.5
    };
  }

  /**
   * Extract reservation parameters from input
   * Enhanced to also check conversation history for missing parameters
   */
  private extractReservationParameters(input: string, session?: Session): Record<string, any> {
    const params: Record<string, any> = {};

    // Try to extract reservation number (6-character alphanumeric)
    const reservationMatch = input.match(/\b([A-Z0-9]{6})\b/i);
    if (reservationMatch) {
      params.reservation_number = reservationMatch[1].toUpperCase();
    }

    // Try to extract name (simple heuristic)
    // This is a basic implementation - production would use NER
    const namePatterns = [
      /(?:name is|I'm|I am|called|my name is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i,
      /(?:reservation for|under)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i,
      /(?:and my name is|and the name is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i,
      /(?:it's|it is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i
    ];

    for (const pattern of namePatterns) {
      const match = input.match(pattern);
      if (match) {
        params.full_name = match[1];
        break;
      }
    }

    // If we have a session, check conversation history for missing parameters
    if (session) {
      const recentHistory = session.getRecentHistory(10);
      
      // Look for reservation number in previous messages if not found in current input
      if (!params.reservation_number) {
        for (const entry of recentHistory) {
          if (entry.role === 'caller') {
            const histReservationMatch = entry.content.match(/\b([A-Z0-9]{6})\b/i);
            if (histReservationMatch) {
              params.reservation_number = histReservationMatch[1].toUpperCase();
              break;
            }
          }
        }
      }

      // Look for name in previous messages if not found in current input
      if (!params.full_name) {
        for (const entry of recentHistory) {
          if (entry.role === 'caller') {
            for (const pattern of namePatterns) {
              const match = entry.content.match(pattern);
              if (match) {
                params.full_name = match[1];
                break;
              }
            }
            if (params.full_name) break;
          }
        }
      }
    }

    return params;
  }

  /**
   * Extract billing parameters from input
   */
  private extractBillingParameters(input: string): Record<string, any> {
    const params: Record<string, any> = {};

    // Try to extract month (YYYY-MM or month name)
    const monthMatch = input.match(/(\d{4}-\d{2})|(january|february|march|april|may|june|july|august|september|october|november|december)/i);
    if (monthMatch) {
      // Convert month name to YYYY-MM if needed
      // For now, just store as-is
      params.month = monthMatch[0];
    }

    return params;
  }

  /**
   * Check guardrails
   */
  private checkGuardrails(input: string): { allowed: boolean; response?: string } {
    if (!this.config.guardrails) {
      return { allowed: true };
    }

    const lowerInput = input.toLowerCase();

    // Check banned phrases
    if (this.config.guardrails.bannedPhrases) {
      for (const phrase of this.config.guardrails.bannedPhrases) {
        if (lowerInput.includes(phrase.toLowerCase())) {
          return {
            allowed: false,
            response: this.config.guardrails.fallbackResponse
          };
        }
      }
    }

    return { allowed: true };
  }

  /**
   * Determine target sub-agent based on intent
   */
  private determineAgent(intent: string): string | null {
    return this.intentToAgentMap.get(intent) || null;
  }

  /**
   * Set up intent-to-agent mapping
   */
  private setupIntentMapping(): void {
    // Default mappings - can be configured
    this.intentToAgentMap.set('confirm_reservation', 'reservation_agent');
    this.intentToAgentMap.set('cancel_reservation', 'reservation_agent');
    this.intentToAgentMap.set('modify_reservation', 'reservation_agent');
    this.intentToAgentMap.set('get_billing_info', 'billing_agent');
    this.intentToAgentMap.set('create_support_ticket', 'support_agent');
    // Note: view_reservation_details is handled via memory, not routed to sub-agent
  }

  /**
   * Register intent-to-agent mapping
   */
  registerIntentMapping(intent: string, agentId: string): void {
    this.intentToAgentMap.set(intent, agentId);
  }

  /**
   * Build structured input for sub-agent
   */
  private buildStructuredInput(
    intentResult: IntentResult,
    session: Session
  ): any {
    return {
      task: intentResult.task,
      parameters: intentResult.parameters,
      context: {
        threadId: session.current_thread_id,
        sessionId: session.id,
        callerId: session.caller_id,
        conversationHistory: session.getRecentHistory(5).map(h => ({
          role: h.role,
          content: h.content,
          timestamp: h.timestamp
        })),
        metadata: {
          ...session.metadata,
          confidence: intentResult.confidence
        }
      },
      requestId: `req_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      timestamp: Date.now(),
      priority: 'normal'
    };
  }

  /**
   * Process sub-agent response
   */
  private async processSubAgentResponse(
    response: any,
    session: Session,
    intentResult?: IntentResult
  ): Promise<string> {
    // Validate response structure
    if (!response || typeof response !== 'object') {
      return "I'm having trouble processing the response. Please try again.";
    }

    const status = response.status;

    if (status === 'success') {
      return this.formatSuccessMessage(response.data, session);
    } else if (status === 'needs_info') {
      if (response.clarification) {
        return this.formatClarificationQuestion(response.clarification);
      } else {
        return this.formatInfoRequest(response.required);
      }
    } else if (status === 'error') {
      return this.formatErrorMessage(response.error);
    } else if (status === 'partial') {
      return this.formatPartialMessage(response.data, response.metadata);
    }

    return "I'm not sure how to respond to that. Can you rephrase?";
  }

  /**
   * Format success message for caller
   */
  private formatSuccessMessage(data: any, session: Session): string {
    // Simple formatting - can be enhanced with templates
    if (data.reservation) {
      const res = data.reservation;
      return `Great! I've confirmed your reservation. You have a ${res.room_type || 'room'} reserved for ${res.date || 'your dates'}. ` +
        `Your reservation number is ${res.number}. Is there anything else I can help you with?`;
    }

    // Handle direct reservation data (from memory or direct response)
    if (data.reservation_number || data.room_type) {
      const res = data;
      let message = '';
      if (res.room_type) {
        message += `You have a ${res.room_type} reserved. `;
      }
      if (res.check_in && res.check_out) {
        const checkIn = new Date(res.check_in).toLocaleDateString();
        const checkOut = new Date(res.check_out).toLocaleDateString();
        message += `Check-in is on ${checkIn} and check-out is on ${checkOut}. `;
      }
      if (res.total_amount) {
        message += `The total amount is ${res.currency || '$'}${res.total_amount}. `;
      }
      message += "Is there anything else you'd like to know?";
      return message;
    }

    if (data.billing) {
      const bill = data.billing;
      return `Your bill for ${bill.month || 'this month'} is $${bill.total_amount || 'N/A'}. ` +
        `The payment is due by ${bill.due_date || 'the due date'}. Would you like me to help you make a payment?`;
    }

    // Generic success message
    return "I've successfully processed your request. Is there anything else I can help you with?";
  }

  /**
   * Format clarification question
   */
  private formatClarificationQuestion(clarification: any): string {
    let message = clarification.question || "I need a bit more information.";

    if (clarification.options && clarification.options.length > 0) {
      message += " Here are your options:\n";
      clarification.options.forEach((opt: any, index: number) => {
        message += `${index + 1}. ${opt.label || opt.value}\n`;
      });
    }

    return message;
  }

  /**
   * Format information request
   */
  private formatInfoRequest(required: any[]): string {
    if (!required || required.length === 0) {
      return "I need some additional information to help you.";
    }

    let message = "I'll need a bit more information to help you. ";
    const fields = required.map((req: any) => req.description || req.field).join(', ');
    message += `Please provide: ${fields}.`;

    return message;
  }

  /**
   * Format error message
   */
  private formatErrorMessage(error: any): string {
    if (!error) {
      return "I encountered an error processing your request. Please try again.";
    }

    const userFriendlyMessages: Record<string, string> = {
      'RESERVATION_NOT_FOUND': "I couldn't find a reservation with those details. Please verify your reservation number and name.",
      'EXTERNAL_API_FAILURE': "I'm having trouble accessing the system right now. Please try again in a moment.",
      'MISSING_REQUIRED_DATA': "I need more information to process your request.",
      'UNAUTHORIZED': "I don't have permission to access that information.",
      'TIMEOUT_ERROR': "The request took too long to process. Please try again."
    };

    const errorCode = error.code || 'UNKNOWN_ERROR';
    const defaultMessage = error.message || "I encountered an error. Please try again.";

    return userFriendlyMessages[errorCode] || defaultMessage;
  }

  /**
   * Format partial message
   */
  private formatPartialMessage(data: any, metadata?: any): string {
    let message = "I have some information for you, though it may not be complete. ";

    if (metadata?.note) {
      message += metadata.note + " ";
    }

    // Format the partial data
    message += this.formatSuccessMessage(data, {} as Session);

    return message;
  }

  /**
   * Handle incoming messages (for bidirectional communication)
   */
  private async handleIncomingMessage(message: AgentMessage): Promise<any> {
    // Handle messages from sub-agents (e.g., clarification requests)
    this.logger.log({
      type: 'agent_to_agent',
      from: message.from,
      to: message.to,
      message: JSON.stringify(message.content),
      metadata: {
        messageId: message.id,
        threadId: message.context.threadId,
        type: message.type
      }
    });

    // For now, just acknowledge
    return { acknowledged: true };
  }

  /**
   * Handle errors
   */
  private handleError(error: any, sessionId: string): string {
    if (error.message?.includes('timeout')) {
      return "I'm sorry, the request took too long. Please try again.";
    }

    if (error.message?.includes('not found') || error.message?.includes('No handler')) {
      return "I'm sorry, I'm not able to handle that request right now. Please try something else.";
    }

    return "I'm sorry, I encountered an error. Please try again or rephrase your request.";
  }

  /**
   * Resume session after disconnection
   */
  async resumeSession(sessionId: string): Promise<string | null> {
    const session = await this.stateManager.getSession(sessionId);
    if (!session) {
      return null;
    }

    if (session.isExpired()) {
      return "Your previous session has expired. How can I help you today?";
    }

    const lastEntry = session.history[session.history.length - 1];
    if (lastEntry && lastEntry.role === 'agent') {
      return `Welcome back! I see you were in the process of: "${lastEntry.content.substring(0, 100)}...". Would you like to continue?`;
    }

    return "Welcome back! How can I help you today?";
  }

  /**
   * Check if should greet first
   */
  private shouldGreetFirst(): boolean {
    // Check if greeting is enabled in config
    // This would typically come from RouterNodeData.speaksFirst
    return true; // Default to true
  }

  /**
   * Generate greeting message
   */
  private generateGreeting(session: Session): string {
    // Apply voice settings and user preferences
    const tone = this.config.voiceSettings?.tone || 'professional';
    const language = session.metadata.language || this.config.voiceSettings?.language || 'en';

    // Default greeting based on tone
    const greetings: Record<string, string> = {
      welcoming: "Welcome! I'm here to help you today. How can I assist you?",
      professional: "Hello, how can I help you today?",
      friendly: "Hi there! What can I do for you?",
      efficient: "Hello, how can I assist you?"
    };

    return greetings[tone] || greetings.professional;
  }

  /**
   * Apply voice settings to response
   */
  private applyVoiceSettings(response: string): string {
    if (!this.config.voiceSettings) {
      return response;
    }

    // Adjust response based on voice settings
    // Speed is handled at the TTS level, not in text
    // Tone affects word choice (already handled in formatting methods)
    
    return response;
  }

  /**
   * Apply user preferences to context
   */
  private applyUserPreferences(session: Session): void {
    // User preferences are already in session.metadata
    // This method can be used to apply them to responses
    if (session.metadata.userPreferences) {
      const prefs = session.metadata.userPreferences;
      
      // Apply communication style
      if (prefs.communication?.style === 'concise') {
        // Responses should be shorter
      } else if (prefs.communication?.style === 'detailed') {
        // Responses should be more detailed
      }
    }
  }

  /**
   * Check session memory for relevant data based on intent
   */
  private checkSessionMemory(
    intentResult: IntentResult,
    session: Session
  ): { found: boolean; data?: any; memoryKey?: string } {
    const intent = intentResult.intent;
    const memory = session.sessionMemory;

    // Map intents to memory keys
    const intentToMemoryKey: Record<string, string[]> = {
      'confirm_reservation': ['reservation', 'reservation_data'],
      'view_reservation_details': ['reservation', 'reservation_data'],
      'cancel_reservation': ['reservation', 'reservation_data'],
      'modify_reservation': ['reservation', 'reservation_data'],
      'get_billing_info': ['billing', 'billing_data'],
      'create_support_ticket': ['support', 'support_data']
    };

    const possibleKeys = intentToMemoryKey[intent] || [];
    
    // Check each possible key
    for (const key of possibleKeys) {
      if (session.hasInMemory(key)) {
        const data = session.getFromMemory(key);
        if (data && (typeof data === 'object' ? Object.keys(data).length > 0 : true)) {
          return {
            found: true,
            data,
            memoryKey: key
          };
        }
      }
    }

    // Also check for reservation_number in parameters and look for matching reservation
    if (intentResult.parameters?.reservation_number) {
      const reservationNumber = intentResult.parameters.reservation_number;
      
      // Check if we have a reservation stored with this number
      if (session.hasInMemory('reservation')) {
        const reservation = session.getFromMemory('reservation');
        if (reservation && 
            (reservation.reservation_number === reservationNumber || 
             reservation.number === reservationNumber)) {
          return {
            found: true,
            data: reservation,
            memoryKey: 'reservation'
          };
        }
      }
    }

    return { found: false };
  }

  /**
   * Store data in session memory after successful sub-agent response
   */
  private async storeInSessionMemory(
    data: any,
    intentResult: IntentResult,
    sessionId: string
  ): Promise<void> {
    if (!data) return;

    const intent = intentResult.intent;
    const session = await this.stateManager.getOrCreateSession(sessionId);

    // Determine memory key based on intent and data structure
    let memoryKey: string;
    let valueToStore: any;

    if (intent.includes('reservation')) {
      memoryKey = 'reservation';
      // Store reservation data with timestamp
      valueToStore = {
        ...data.reservation || data,
        retrievedAt: Date.now(),
        intent: intent
      };
    } else if (intent.includes('billing')) {
      memoryKey = 'billing';
      valueToStore = {
        ...data.billing || data,
        retrievedAt: Date.now(),
        intent: intent
      };
    } else if (intent.includes('support')) {
      memoryKey = 'support';
      valueToStore = {
        ...data.support || data,
        retrievedAt: Date.now(),
        intent: intent
      };
    } else {
      // Generic storage for other intents
      memoryKey = `${intent}_data`;
      valueToStore = {
        ...data,
        retrievedAt: Date.now(),
        intent: intent
      };
    }

    // Store in session memory
    await this.stateManager.storeInSessionMemory(sessionId, memoryKey, valueToStore);

    this.logger.log({
      type: 'memory_stored',
      from: this.config.agentId,
      message: `Stored data in session memory for intent: ${intent}`,
      sessionId,
      metadata: {
        memoryKey,
        intent: intent
      }
    });
  }

  /**
   * Format response from memory data
   */
  private formatResponseFromMemory(
    memoryData: any,
    intentResult: IntentResult,
    session: Session
  ): string {
    const intent = intentResult.intent;

    // Use the same formatting logic as formatSuccessMessage
    if (intent.includes('reservation') || memoryData.reservation_number || memoryData.room_type) {
      const res = memoryData.reservation || memoryData;
      let message = '';

      if (intent === 'view_reservation_details') {
        // Detailed view of reservation
        if (res.room_type) {
          message += `You have a ${res.room_type} reserved. `;
        }
        if (res.check_in && res.check_out) {
          const checkIn = new Date(res.check_in).toLocaleDateString();
          const checkOut = new Date(res.check_out).toLocaleDateString();
          message += `Check-in is on ${checkIn} and check-out is on ${checkOut}. `;
        }
        if (res.total_amount) {
          message += `The total amount is ${res.currency || '$'}${res.total_amount}. `;
        }
        if (res.reservation_number || res.number) {
          message += `Your reservation number is ${res.reservation_number || res.number}. `;
        }
        message += "Is there anything else you'd like to know?";
      } else {
        // Confirmation or other reservation intents
        message = this.formatSuccessMessage(memoryData, session);
      }

      return message;
    }

    if (intent.includes('billing') || memoryData.billing) {
      const bill = memoryData.billing || memoryData;
      return `Your bill for ${bill.month || 'this month'} is $${bill.total_amount || 'N/A'}. ` +
        `The payment is due by ${bill.due_date || 'the due date'}. Would you like me to help you make a payment?`;
    }

    // Generic response
    return "I have that information. Is there anything else I can help you with?";
  }
}

