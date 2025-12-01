/**
 * Confirmation Handler
 * 
 * Handles confirmation flows for high-risk connections and actions
 * that require explicit user confirmation before execution.
 */

import { ConnectionContextCard, RoutingDecision, ConversationState } from '../types';

export interface ConfirmationRequest {
  connectionId: string;
  contextCardId: string;
  message: string;
  riskLevel: 'low' | 'medium' | 'high';
  timestamp: number;
}

export interface ConfirmationResult {
  confirmed: boolean;
  timestamp: number;
  userResponse?: string;
}

/**
 * Confirmation Handler class
 */
export class ConfirmationHandler {
  private pendingConfirmations: Map<string, ConfirmationRequest> = new Map();

  /**
   * Check if a routing decision requires confirmation
   */
  requiresConfirmation(decision: RoutingDecision, contextCard: ConnectionContextCard): boolean {
    return decision.requiredConfirmation ||
      contextCard.requiresConfirmation ||
      contextCard.riskLevel === 'high';
  }

  /**
   * Generate confirmation message for a connection
   */
  generateConfirmationMessage(
    contextCard: ConnectionContextCard,
    callerIntent?: string
  ): string {
    const baseMessage = contextCard.systemPromptAdditions?.includes('confirmation')
      ? contextCard.systemPromptAdditions
      : `I want to make sure I understand correctly. `;

    if (contextCard.riskLevel === 'high') {
      return `${baseMessage}You're asking me to ${contextCard.purpose.toLowerCase()}. This is an important action that ${contextCard.riskNotes || 'may have significant consequences'}. Is that correct?`;
    }

    if (contextCard.requiresConfirmation) {
      return `${baseMessage}You want me to ${contextCard.purpose.toLowerCase()}. Is that right?`;
    }

    // Default confirmation
    return `Just to confirm, you want me to ${contextCard.purpose.toLowerCase()}?`;
  }

  /**
   * Create a confirmation request
   */
  createConfirmationRequest(
    decision: RoutingDecision,
    contextCard: ConnectionContextCard
  ): ConfirmationRequest {
    const requestId = `confirm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const request: ConfirmationRequest = {
      connectionId: decision.chosenConnectionId,
      contextCardId: decision.chosenContextCardId,
      message: this.generateConfirmationMessage(contextCard),
      riskLevel: contextCard.riskLevel,
      timestamp: Date.now(),
    };

    this.pendingConfirmations.set(requestId, request);
    return request;
  }

  /**
   * Process confirmation response from caller
   */
  processConfirmationResponse(
    userResponse: string,
    requestId?: string
  ): ConfirmationResult {
    const lowerResponse = userResponse.toLowerCase().trim();
    
    // Check for positive confirmation
    const positiveIndicators = [
      'yes', 'yeah', 'yep', 'correct', 'right', 'that\'s right',
      'sure', 'ok', 'okay', 'go ahead', 'proceed', 'do it',
      'confirm', 'confirmed', 'affirmative'
    ];

    // Check for negative confirmation
    const negativeIndicators = [
      'no', 'nope', 'wrong', 'incorrect', 'stop', 'cancel',
      'don\'t', 'do not', 'wait', 'hold on'
    ];

    const confirmed = positiveIndicators.some(indicator => 
      lowerResponse.includes(indicator)
    ) && !negativeIndicators.some(indicator => 
      lowerResponse.includes(indicator)
    );

    if (requestId) {
      this.pendingConfirmations.delete(requestId);
    }

    return {
      confirmed,
      timestamp: Date.now(),
      userResponse,
    };
  }

  /**
   * Check if a response is a confirmation
   */
  isConfirmationResponse(response: string): boolean {
    const lowerResponse = response.toLowerCase().trim();
    const confirmationKeywords = [
      'yes', 'no', 'confirm', 'correct', 'right', 'wrong',
      'yeah', 'nope', 'sure', 'ok', 'okay'
    ];
    
    return confirmationKeywords.some(keyword => lowerResponse.includes(keyword));
  }

  /**
   * Get pending confirmation for a connection
   */
  getPendingConfirmation(connectionId: string): ConfirmationRequest | undefined {
    for (const request of this.pendingConfirmations.values()) {
      if (request.connectionId === connectionId) {
        return request;
      }
    }
    return undefined;
  }

  /**
   * Clear pending confirmations
   */
  clearPendingConfirmations(): void {
    this.pendingConfirmations.clear();
  }

  /**
   * Clear old pending confirmations (older than timeout)
   */
  clearOldConfirmations(timeoutMs: number = 60000): void {
    const now = Date.now();
    for (const [id, request] of this.pendingConfirmations.entries()) {
      if (now - request.timestamp > timeoutMs) {
        this.pendingConfirmations.delete(id);
      }
    }
  }
}

