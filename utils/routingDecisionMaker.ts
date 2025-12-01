/**
 * Routing Decision Maker
 * 
 * Orchestrates connection selection with threshold-based logic, safe defaults,
 * and clarify-intent connections when no candidate scores high enough.
 */

import {
  RoutingDecision,
  ConnectionScore,
  ConversationState,
  CandidateConnection,
  ConnectionContextCard,
} from '../types';
import { ConnectionRouter } from './connectionRouter';
import { ConnectionScorer } from './connectionScorer';

export interface RoutingOptions {
  scoreThreshold?: number; // Minimum score to accept (default: 0.6)
  clarificationThreshold?: number; // Score below which to use clarification (default: 0.5)
  maxClarifications?: number; // Max clarification questions before fallback (default: 3)
  fallbackNodeId?: string; // Node ID for fallback when all else fails
  defaultSafeNodeId?: string; // Default safe node for confusion fallback
}

export interface ClarificationTemplate {
  id: string;
  template: string;
  useCase: string;
}

/**
 * Routing Decision Maker class
 */
export class RoutingDecisionMaker {
  private router: ConnectionRouter;
  private scorer: ConnectionScorer;
  private options: Required<RoutingOptions>;

  constructor(
    router: ConnectionRouter,
    scorer: ConnectionScorer,
    options: RoutingOptions = {}
  ) {
    this.router = router;
    this.scorer = scorer;
    this.options = {
      scoreThreshold: options.scoreThreshold ?? 0.6,
      clarificationThreshold: options.clarificationThreshold ?? 0.5,
      maxClarifications: options.maxClarifications ?? 3,
      fallbackNodeId: options.fallbackNodeId,
      defaultSafeNodeId: options.defaultSafeNodeId,
    };
  }

  /**
   * Make a routing decision
   */
  async makeRoutingDecision(
    currentNodeId: string,
    edges: any[], // Edge[] from reactflow
    callerUtterance: string,
    conversationState: ConversationState,
    conversationHistory: string[] = []
  ): Promise<RoutingDecision> {
    // Get candidate connections
    const candidates = await this.router.getCandidateConnections(
      currentNodeId,
      edges,
      conversationState
    );

    if (candidates.length === 0) {
      // No candidates - use fallback
      return this.createFallbackDecision(
        currentNodeId,
        edges,
        'No candidate connections available'
      );
    }

    // Score candidates
    const scores = await this.scorer.scoreConnections(
      candidates,
      callerUtterance,
      conversationState,
      conversationHistory
    );

    // Get top score
    const topScore = scores[0];

    // Check if we need clarification
    if (topScore.score < this.options.clarificationThreshold) {
      // Check if we've exceeded max clarifications
      if (conversationState.clarificationCount >= this.options.maxClarifications) {
        // Use safe default
        return this.createSafeDefaultDecision(
          currentNodeId,
          edges,
          `Exceeded max clarifications (${this.options.maxClarifications})`
        );
      }

      // Use clarification connection
      return this.createClarificationDecision(
        currentNodeId,
        edges,
        topScore,
        candidates,
        scores
      );
    }

    // Check if top score meets threshold
    if (topScore.score < this.options.scoreThreshold) {
      // Score is below threshold but above clarification threshold
      // Still use it but mark as low confidence
      return this.createLowConfidenceDecision(
        topScore,
        candidates,
        scores
      );
    }

    // High confidence decision
    const chosenCandidate = candidates.find(c => c.connectionId === topScore.connectionId);
    if (!chosenCandidate) {
      return this.createFallbackDecision(
        currentNodeId,
        edges,
        'Chosen candidate not found'
      );
    }

    // Check if confirmation is required
    const requiresConfirmation = chosenCandidate.contextCard.requiresConfirmation ||
      chosenCandidate.contextCard.riskLevel === 'high';

    return {
      chosenConnectionId: topScore.connectionId,
      chosenContextCardId: topScore.contextCardId,
      score: topScore.score,
      reason: topScore.reason,
      candidates: scores,
      usedFallback: false,
      requiredConfirmation: requiresConfirmation,
      timestamp: Date.now(),
    };
  }

  /**
   * Create a clarification decision
   */
  private async createClarificationDecision(
    currentNodeId: string,
    edges: any[],
    topScore: ConnectionScore,
    candidates: CandidateConnection[],
    allScores: ConnectionScore[]
  ): Promise<RoutingDecision> {
    // Try to find a clarification connection
    const clarificationCandidate = await this.router.getFallbackConnection(
      currentNodeId,
      edges,
      this.options.defaultSafeNodeId
    );

    if (clarificationCandidate) {
      return {
        chosenConnectionId: clarificationCandidate.connectionId,
        chosenContextCardId: clarificationCandidate.contextCard.id,
        score: 0.5, // Neutral score for clarification
        reason: `Low confidence (${topScore.score.toFixed(2)}) - asking for clarification. Top candidate: ${topScore.reason}`,
        candidates: allScores,
        usedFallback: true,
        requiredConfirmation: false,
        timestamp: Date.now(),
      };
    }

    // No clarification connection - use safe default
    return this.createSafeDefaultDecision(
      currentNodeId,
      edges,
      `Low confidence (${topScore.score.toFixed(2)}) and no clarification connection available`
    );
  }

  /**
   * Create a low confidence decision (score between clarification and threshold)
   */
  private createLowConfidenceDecision(
    topScore: ConnectionScore,
    candidates: CandidateConnection[],
    allScores: ConnectionScore[]
  ): RoutingDecision {
    const chosenCandidate = candidates.find(c => c.connectionId === topScore.connectionId);
    
    return {
      chosenConnectionId: topScore.connectionId,
      chosenContextCardId: topScore.contextCardId,
      score: topScore.score,
      reason: `Low confidence selection: ${topScore.reason}`,
      candidates: allScores,
      usedFallback: false,
      requiredConfirmation: chosenCandidate?.contextCard.requiresConfirmation || false,
      timestamp: Date.now(),
    };
  }

  /**
   * Create a safe default decision
   */
  private async createSafeDefaultDecision(
    currentNodeId: string,
    edges: any[],
    reason: string
  ): Promise<RoutingDecision> {
    const safeDefault = await this.router.getFallbackConnection(
      currentNodeId,
      edges,
      this.options.defaultSafeNodeId || this.options.fallbackNodeId
    );

    if (safeDefault) {
      return {
        chosenConnectionId: safeDefault.connectionId,
        chosenContextCardId: safeDefault.contextCard.id,
        score: 0.3, // Low score for fallback
        reason: `Safe default: ${reason}`,
        candidates: [],
        usedFallback: true,
        requiredConfirmation: false,
        timestamp: Date.now(),
      };
    }

    // Ultimate fallback - return error decision
    return {
      chosenConnectionId: '',
      chosenContextCardId: '',
      score: 0,
      reason: `No safe default available: ${reason}`,
      candidates: [],
      usedFallback: true,
      requiredConfirmation: false,
      timestamp: Date.now(),
    };
  }

  /**
   * Create a fallback decision
   */
  private async createFallbackDecision(
    currentNodeId: string,
    edges: any[],
    reason: string
  ): Promise<RoutingDecision> {
    return this.createSafeDefaultDecision(currentNodeId, edges, reason);
  }

  /**
   * Generate clarification question based on top candidates
   */
  generateClarificationQuestion(
    topCandidates: ConnectionScore[],
    candidates: CandidateConnection[]
  ): string {
    if (topCandidates.length === 0) {
      return "I want to make sure I help you correctly. Could you tell me more about what you're looking for?";
    }

    // Get top 2-3 candidates
    const topN = topCandidates.slice(0, Math.min(3, topCandidates.length));
    const candidateNames = topN.map(score => {
      const candidate = candidates.find(c => c.connectionId === score.connectionId);
      return candidate?.contextCard.name || 'this option';
    });

    if (candidateNames.length === 1) {
      return `Just to confirm, are you trying to ${candidateNames[0].toLowerCase()}?`;
    } else if (candidateNames.length === 2) {
      return `It sounds like you might be calling about ${candidateNames[0]} or ${candidateNames[1]}. Which is closer to what you want?`;
    } else {
      const last = candidateNames.pop();
      return `It sounds like you might be calling about ${candidateNames.join(', ')}, or ${last}. Which is closest to what you need?`;
    }
  }

  /**
   * Check if a decision requires confirmation
   */
  requiresConfirmation(decision: RoutingDecision, candidates: CandidateConnection[]): boolean {
    if (decision.requiredConfirmation) {
      return true;
    }

    const chosenCandidate = candidates.find(c => c.connectionId === decision.chosenConnectionId);
    if (!chosenCandidate) {
      return false;
    }

    return chosenCandidate.contextCard.requiresConfirmation ||
      chosenCandidate.contextCard.riskLevel === 'high';
  }
}

