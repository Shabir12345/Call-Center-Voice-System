/**
 * Connection Scorer
 * 
 * LLM-based scoring of candidate connections using their context cards
 * and the current conversation to select the best connection.
 */

import { 
  ConnectionContextCard, 
  ConnectionScore, 
  ConversationState,
  CallerIntent,
  CandidateConnection
} from '../types';
import { GoogleGenAI } from '@google/genai';

export interface ScoringOptions {
  apiKey: string;
  model?: string; // Default: 'gemini-2.0-flash-exp'
  useRuleBasedBoosts?: boolean; // Apply rule-based boosts (default: true)
  riskPenaltyMultiplier?: number; // Penalty multiplier for high-risk connections (default: 0.8)
  lowRiskBoost?: number; // Boost for low-risk connections (default: 1.1)
}

/**
 * Connection Scorer class
 */
export class ConnectionScorer {
  private genAI: GoogleGenAI;
  private options: Required<Omit<ScoringOptions, 'apiKey'>> & { apiKey: string };

  constructor(options: ScoringOptions) {
    this.options = {
      apiKey: options.apiKey,
      model: options.model || 'gemini-2.0-flash-exp',
      useRuleBasedBoosts: options.useRuleBasedBoosts ?? true,
      riskPenaltyMultiplier: options.riskPenaltyMultiplier ?? 0.8,
      lowRiskBoost: options.lowRiskBoost ?? 1.1,
    };
    this.genAI = new GoogleGenAI({ apiKey: this.options.apiKey });
  }

  /**
   * Score candidate connections
   */
  async scoreConnections(
    candidates: CandidateConnection[],
    callerUtterance: string,
    conversationState: ConversationState,
    conversationHistory: string[] = [] // Recent conversation turns
  ): Promise<ConnectionScore[]> {
    if (candidates.length === 0) {
      return [];
    }

    // Build prompt for LLM scoring
    const prompt = this.buildScoringPrompt(
      candidates,
      callerUtterance,
      conversationState,
      conversationHistory
    );

    try {
      // Get LLM scores
      const llmScores = await this.getLLMScores(prompt, candidates);

      // Apply rule-based boosts if enabled
      const finalScores = this.options.useRuleBasedBoosts
        ? this.applyRuleBasedBoosts(llmScores, candidates)
        : llmScores;

      // Sort by score descending
      finalScores.sort((a, b) => b.score - a.score);

      return finalScores;
    } catch (error) {
      console.error('Error scoring connections:', error);
      
      // Fallback to rule-based scoring only
      return this.fallbackScoring(candidates, conversationState);
    }
  }

  /**
   * Build prompt for LLM scoring
   */
  private buildScoringPrompt(
    candidates: CandidateConnection[],
    callerUtterance: string,
    conversationState: ConversationState,
    conversationHistory: string[]
  ): string {
    const currentIntent = conversationState.currentIntent;
    const intentInfo = currentIntent
      ? `Current Intent: ${currentIntent.intentLabel} (confidence: ${currentIntent.confidence.toFixed(2)})\nEntities: ${JSON.stringify(currentIntent.entities)}\nUrgency: ${currentIntent.urgency}`
      : 'No clear intent detected';

    const historyText = conversationHistory.length > 0
      ? `\nRecent Conversation:\n${conversationHistory.slice(-3).join('\n')}`
      : '';

    const candidatesText = candidates.map((candidate, index) => {
      const card = candidate.contextCard;
      return `
Connection ${index + 1} (ID: ${candidate.connectionId}):
- Name: ${card.name}
- Purpose: ${card.purpose}
- When to use: ${card.whenToUse}
${card.whenNotToUse ? `- When NOT to use: ${card.whenNotToUse}` : ''}
${card.examplePhrases && card.examplePhrases.length > 0 
  ? `- Example phrases: ${card.examplePhrases.join(', ')}` 
  : ''}
${card.usageExamples && card.usageExamples.length > 0
  ? `- Usage examples:\n${card.usageExamples.map(ex => `  * ${ex}`).join('\n')}`
  : ''}
- Risk level: ${card.riskLevel}
- Priority: ${card.priority}
`;
    }).join('\n---\n');

    return `You are a routing assistant helping to choose the best connection for a caller's request.

${intentInfo}
${historyText}

Caller's current utterance: "${callerUtterance}"

Available Connections:
${candidatesText}

For each connection, provide:
1. A score from 0-100 indicating how well this connection matches the caller's intent
2. A brief reason (1-2 sentences) explaining why this score was given

Consider:
- How well the connection's "When to use" description matches the caller's intent
- Whether the connection's "When NOT to use" conditions are violated
- The example phrases and usage examples
- The urgency and entities in the current intent
- The conversation history

Return a JSON array with this format:
[
  {
    "connectionId": "connection_id",
    "score": 85,
    "reason": "This connection matches well because..."
  },
  ...
]

Score guidelines:
- 80-100: Excellent match, connection directly addresses the caller's intent
- 60-79: Good match, connection is relevant but may need some adaptation
- 40-59: Moderate match, connection is somewhat relevant but not ideal
- 20-39: Poor match, connection is only tangentially related
- 0-19: Very poor match, connection does not address the caller's intent

Be strict with scoring - only give high scores (70+) when the connection is clearly the right choice.`;
  }

  /**
   * Get scores from LLM
   */
  private async getLLMScores(
    prompt: string,
    candidates: CandidateConnection[]
  ): Promise<ConnectionScore[]> {
    const model = this.genAI.getGenerativeModel({ model: this.options.model });

    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Parse JSON from response
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('No JSON array found in LLM response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      // Map to ConnectionScore format
      const scores: ConnectionScore[] = [];
      
      for (const item of parsed) {
        const candidate = candidates.find(c => c.connectionId === item.connectionId);
        if (candidate) {
          // Normalize score to 0-1 range
          const normalizedScore = Math.max(0, Math.min(1, item.score / 100));
          
          scores.push({
            connectionId: item.connectionId,
            contextCardId: candidate.contextCard.id,
            score: normalizedScore,
            reason: item.reason || 'No reason provided',
          });
        }
      }

      // Ensure all candidates have scores (fill missing ones with 0)
      for (const candidate of candidates) {
        if (!scores.find(s => s.connectionId === candidate.connectionId)) {
          scores.push({
            connectionId: candidate.connectionId,
            contextCardId: candidate.contextCard.id,
            score: 0,
            reason: 'No score provided by LLM',
          });
        }
      }

      return scores;
    } catch (error) {
      console.error('Error getting LLM scores:', error);
      throw error;
    }
  }

  /**
   * Apply rule-based boosts to scores
   */
  private applyRuleBasedBoosts(
    scores: ConnectionScore[],
    candidates: CandidateConnection[]
  ): ConnectionScore[] {
    return scores.map(score => {
      const candidate = candidates.find(c => c.connectionId === score.connectionId);
      if (!candidate) {
        return score;
      }

      const card = candidate.contextCard;
      let boost = 0;
      let riskPenalty = 0;

      // Low-risk boost
      if (card.riskLevel === 'low' && this.options.useRuleBasedBoosts) {
        boost = score.score * (this.options.lowRiskBoost - 1);
      }

      // High-risk penalty
      if (card.riskLevel === 'high') {
        riskPenalty = score.score * (1 - this.options.riskPenaltyMultiplier);
      }

      // Priority boost (small)
      const priorityBoost = card.priority * 0.01; // Small boost per priority point

      const finalScore = Math.max(0, Math.min(1, 
        score.score + boost - riskPenalty + priorityBoost
      ));

      return {
        ...score,
        score: finalScore,
        metadata: {
          ...score.metadata,
          ruleBasedBoost: boost,
          riskPenalty: riskPenalty,
          priorityBoost: priorityBoost,
        },
      };
    });
  }

  /**
   * Fallback scoring when LLM fails
   */
  private fallbackScoring(
    candidates: CandidateConnection[],
    conversationState: ConversationState
  ): ConnectionScore[] {
    // Simple keyword-based scoring
    const currentIntent = conversationState.currentIntent;
    const intentLabel = currentIntent?.intentLabel || '';
    const utterance = ''; // We don't have the utterance in fallback

    return candidates.map(candidate => {
      const card = candidate.contextCard;
      let score = 0.5; // Default score

      // Check if intent label matches connection name or purpose
      const purposeLower = card.purpose.toLowerCase();
      const nameLower = card.name.toLowerCase();
      const intentLower = intentLabel.toLowerCase();

      if (nameLower.includes(intentLower) || purposeLower.includes(intentLower)) {
        score = 0.7;
      }

      // Check example phrases
      if (card.examplePhrases) {
        for (const phrase of card.examplePhrases) {
          if (intentLower.includes(phrase.toLowerCase())) {
            score = 0.8;
            break;
          }
        }
      }

      // Apply risk penalty
      if (card.riskLevel === 'high') {
        score *= this.options.riskPenaltyMultiplier;
      }

      return {
        connectionId: candidate.connectionId,
        contextCardId: card.id,
        score,
        reason: 'Fallback scoring: basic keyword matching',
        metadata: {
          fallback: true,
        },
      };
    });
  }
}

