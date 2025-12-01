/**
 * Intent Extractor
 * 
 * Enhanced intent extraction layer that converts caller utterances into
 * CallerIntent objects and manages ConversationState for routing decisions.
 */

import { CallerIntent, ConversationState, IntentHistoryEntry } from '../types';
import { IntentRecognizer, IntentRecognitionResult } from './intentRecognizer';
import { ConversationContext } from '../types';

export interface IntentExtractionOptions {
  extractEveryNTurns?: number; // Extract intent every N turns (default: 1)
  minConfidence?: number; // Minimum confidence to accept intent (default: 0.3)
  trackHistory?: boolean; // Whether to track intent history (default: true)
  maxHistorySize?: number; // Maximum intent history entries (default: 10)
}

/**
 * Intent Extractor class
 */
export class IntentExtractor {
  private intentRecognizer: IntentRecognizer;
  private options: Required<IntentExtractionOptions>;
  private conversationTurn: number = 0;

  constructor(
    intentRecognizer: IntentRecognizer,
    options: IntentExtractionOptions = {}
  ) {
    this.intentRecognizer = intentRecognizer;
    this.options = {
      extractEveryNTurns: options.extractEveryNTurns ?? 1,
      minConfidence: options.minConfidence ?? 0.3,
      trackHistory: options.trackHistory ?? true,
      maxHistorySize: options.maxHistorySize ?? 10,
    };
  }

  /**
   * Extract intent from caller utterance and update conversation state
   */
  async extractIntent(
    callerUtterance: string,
    context: ConversationContext,
    currentState?: ConversationState
  ): Promise<{ intent: CallerIntent; state: ConversationState }> {
    this.conversationTurn++;

    // Check if we should extract intent this turn
    if (this.conversationTurn % this.options.extractEveryNTurns !== 0 && currentState?.currentIntent) {
      // Reuse current intent but update entities if needed
      const updatedIntent = await this.updateEntities(callerUtterance, currentState.currentIntent, context);
      const updatedState = this.updateState(currentState, updatedIntent);
      return { intent: updatedIntent, state: updatedState };
    }

    // Extract new intent
    const recognitionResult = await this.intentRecognizer.parse(callerUtterance, context);

    // Determine urgency based on keywords and context
    const urgency = this.determineUrgency(callerUtterance, recognitionResult);

    // Build CallerIntent
    const intent: CallerIntent = {
      intentLabel: recognitionResult.intent,
      confidence: recognitionResult.confidence,
      entities: recognitionResult.extractedEntities || {},
      urgency,
      extractedAt: Date.now(),
    };

    // Filter out low-confidence intents
    if (intent.confidence < this.options.minConfidence) {
      // Use a default "general_inquiry" intent with low confidence
      intent.intentLabel = 'general_inquiry';
      intent.confidence = 0.5;
    }

    // Update conversation state
    const state = this.updateState(currentState, intent);

    return { intent, state };
  }

  /**
   * Update entities in existing intent without re-extracting
   */
  private async updateEntities(
    utterance: string,
    currentIntent: CallerIntent,
    context: ConversationContext
  ): Promise<CallerIntent> {
    // Try to extract new entities from the utterance
    const recognitionResult = await this.intentRecognizer.parse(utterance, context);
    
    // Merge new entities with existing ones
    const mergedEntities = {
      ...currentIntent.entities,
      ...(recognitionResult.extractedEntities || {}),
    };

    return {
      ...currentIntent,
      entities: mergedEntities,
      extractedAt: Date.now(), // Update timestamp
    };
  }

  /**
   * Determine urgency level from utterance and recognition result
   */
  private determineUrgency(
    utterance: string,
    recognitionResult: IntentRecognitionResult
  ): 'low' | 'medium' | 'high' {
    const lowerUtterance = utterance.toLowerCase();

    // High urgency indicators
    const highUrgencyKeywords = [
      'urgent', 'emergency', 'asap', 'immediately', 'right now',
      'critical', 'important', 'broken', 'down', 'not working',
      'cancel', 'refund', 'complaint', 'angry', 'frustrated'
    ];

    // Medium urgency indicators
    const mediumUrgencyKeywords = [
      'soon', 'today', 'quickly', 'need', 'want', 'help'
    ];

    // Check for high urgency
    if (highUrgencyKeywords.some(keyword => lowerUtterance.includes(keyword))) {
      return 'high';
    }

    // Check for medium urgency
    if (mediumUrgencyKeywords.some(keyword => lowerUtterance.includes(keyword))) {
      return 'medium';
    }

    // Check intent type for urgency
    if (recognitionResult.intent.includes('cancel') || 
        recognitionResult.intent.includes('emergency') ||
        recognitionResult.intent.includes('critical')) {
      return 'high';
    }

    return 'low';
  }

  /**
   * Update conversation state with new intent
   */
  private updateState(
    currentState: ConversationState | undefined,
    intent: CallerIntent
  ): ConversationState {
    const state: ConversationState = currentState || {
      intentHistory: [],
      knownEntities: {},
      flags: {},
      connectionHistory: [],
      clarificationCount: 0,
    };

    // Update current intent
    state.currentIntent = intent;

    // Merge entities into known entities
    state.knownEntities = {
      ...state.knownEntities,
      ...intent.entities,
    };

    // Add to intent history if tracking
    if (this.options.trackHistory) {
      const historyEntry: IntentHistoryEntry = {
        intent,
        timestamp: Date.now(),
        conversationTurn: this.conversationTurn,
      };

      state.intentHistory.push(historyEntry);

      // Limit history size
      if (state.intentHistory.length > this.options.maxHistorySize) {
        state.intentHistory = state.intentHistory.slice(-this.options.maxHistorySize);
      }
    }

    // Update flags based on intent and entities
    this.updateFlags(state, intent);

    return state;
  }

  /**
   * Update state flags based on intent and entities
   */
  private updateFlags(state: ConversationState, intent: CallerIntent): void {
    // Set urgency flag
    if (intent.urgency === 'high') {
      state.flags.highUrgency = true;
    }

    // Set authenticated flag if we have customer ID
    if (intent.entities.customerId || intent.entities.accountNumber) {
      state.flags.authenticated = true;
    }

    // Set VIP flag if detected
    if (intent.entities.isVIP || intent.entities.membershipLevel === 'premium') {
      state.flags.isVIP = true;
    }

    // Set anger/frustration flag
    if (intent.entities.sentiment === 'negative' || 
        intent.intentLabel.includes('complaint') ||
        intent.intentLabel.includes('cancel')) {
      state.flags.highAnger = true;
    }
  }

  /**
   * Get the most recent intent from state
   */
  getCurrentIntent(state: ConversationState | undefined): CallerIntent | undefined {
    return state?.currentIntent;
  }

  /**
   * Get intent history from state
   */
  getIntentHistory(state: ConversationState | undefined): IntentHistoryEntry[] {
    return state?.intentHistory || [];
  }

  /**
   * Reset conversation turn counter (for new conversation)
   */
  reset(): void {
    this.conversationTurn = 0;
  }

  /**
   * Get conversation turn number
   */
  getConversationTurn(): number {
    return this.conversationTurn;
  }
}

