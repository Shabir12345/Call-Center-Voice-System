/**
 * Sentiment Analyzer
 * 
 * Analyzes caller sentiment during conversations using LLM-based analysis.
 * Tracks sentiment trends and triggers alerts when sentiment drops.
 */

import { SentimentScore } from '../types';
import { GoogleGenAI } from '@google/genai';

export interface SentimentAnalysisResult {
  score: SentimentScore;
  trend: 'improving' | 'stable' | 'declining';
  alert?: {
    level: 'warning' | 'critical';
    message: string;
  };
}

export interface SentimentHistory {
  scores: SentimentScore[];
  averageScore: number;
  trend: 'improving' | 'stable' | 'declining';
}

export class SentimentAnalyzer {
  private history: Map<string, SentimentScore[]> = new Map(); // sessionId -> scores
  private aiClient: GoogleGenAI | null = null;
  private apiKey?: string;
  private alertThreshold: number = -0.3; // Alert when average sentiment drops below this

  constructor(apiKey?: string) {
    if (apiKey) {
      this.apiKey = apiKey;
      this.aiClient = new GoogleGenAI({ apiKey });
    }
  }

  /**
   * Analyze sentiment of a message
   */
  async analyzeSentiment(
    text: string,
    sessionId: string,
    context?: string[]
  ): Promise<SentimentAnalysisResult> {
    const score = await this.getSentimentScore(text, context);
    
    // Add to history
    if (!this.history.has(sessionId)) {
      this.history.set(sessionId, []);
    }
    const sessionHistory = this.history.get(sessionId)!;
    sessionHistory.push(score);

    // Keep only last 20 scores per session
    if (sessionHistory.length > 20) {
      sessionHistory.shift();
    }

    // Calculate trend
    const trend = this.calculateTrend(sessionHistory);
    
    // Check for alerts
    const averageScore = this.calculateAverage(sessionHistory);
    let alert: { level: 'warning' | 'critical'; message: string } | undefined;

    if (averageScore < this.alertThreshold) {
      alert = {
        level: averageScore < -0.6 ? 'critical' : 'warning',
        message: averageScore < -0.6
          ? 'Critical: Caller sentiment is very negative. Immediate intervention may be needed.'
          : 'Warning: Caller sentiment is declining. Consider proactive assistance.'
      };
    }

    return {
      score,
      trend,
      alert
    };
  }

  /**
   * Get sentiment score using LLM
   */
  private async getSentimentScore(text: string, context?: string[]): Promise<SentimentScore> {
    // If no API key, use simple keyword-based analysis
    if (!this.aiClient || !this.apiKey) {
      return this.simpleSentimentAnalysis(text);
    }

    try {
      const model = this.aiClient.models.generateContent({
        model: 'gemini-2.0-flash-exp',
        contents: [{
          role: 'user',
          parts: [{
            text: `Analyze the sentiment of this customer message. Consider the context if provided.

${context && context.length > 0 ? `Context:\n${context.join('\n')}\n\n` : ''}Message: "${text}"

Respond with a JSON object containing:
- score: a number between -1 (very negative) and 1 (very positive)
- label: one of "positive", "neutral", or "negative"
- confidence: a number between 0 and 1 indicating confidence in the analysis

Only respond with valid JSON, no other text.`
          }]
        }]
      });

      const response = await model.response;
      const responseText = response.text();
      
      // Try to parse JSON from response
      let jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          score: Math.max(-1, Math.min(1, parsed.score || 0)),
          label: parsed.label || 'neutral',
          confidence: Math.max(0, Math.min(1, parsed.confidence || 0.5)),
          timestamp: Date.now()
        };
      }
    } catch (error) {
      console.warn('LLM sentiment analysis failed, falling back to simple analysis:', error);
    }

    // Fallback to simple analysis
    return this.simpleSentimentAnalysis(text);
  }

  /**
   * Simple keyword-based sentiment analysis (fallback)
   */
  private simpleSentimentAnalysis(text: string): SentimentScore {
    const lowerText = text.toLowerCase();
    
    const positiveWords = ['good', 'great', 'excellent', 'thanks', 'thank you', 'helpful', 'perfect', 'love', 'amazing', 'wonderful', 'happy', 'satisfied'];
    const negativeWords = ['bad', 'terrible', 'awful', 'horrible', 'frustrated', 'angry', 'disappointed', 'hate', 'worst', 'useless', 'broken', 'wrong', 'error', 'problem'];
    
    let positiveCount = 0;
    let negativeCount = 0;
    
    positiveWords.forEach(word => {
      if (lowerText.includes(word)) positiveCount++;
    });
    
    negativeWords.forEach(word => {
      if (lowerText.includes(word)) negativeCount++;
    });
    
    let score = 0;
    let label: 'positive' | 'neutral' | 'negative' = 'neutral';
    
    if (positiveCount > negativeCount) {
      score = Math.min(0.8, 0.3 + (positiveCount * 0.1));
      label = 'positive';
    } else if (negativeCount > positiveCount) {
      score = Math.max(-0.8, -0.3 - (negativeCount * 0.1));
      label = 'negative';
    }
    
    return {
      score,
      label,
      confidence: Math.abs(score) > 0.3 ? 0.7 : 0.5,
      timestamp: Date.now()
    };
  }

  /**
   * Calculate sentiment trend
   */
  private calculateTrend(scores: SentimentScore[]): 'improving' | 'stable' | 'declining' {
    if (scores.length < 3) return 'stable';
    
    const recent = scores.slice(-5);
    const older = scores.slice(-10, -5);
    
    if (older.length === 0) return 'stable';
    
    const recentAvg = this.calculateAverage(recent);
    const olderAvg = this.calculateAverage(older);
    
    const diff = recentAvg - olderAvg;
    
    if (diff > 0.1) return 'improving';
    if (diff < -0.1) return 'declining';
    return 'stable';
  }

  /**
   * Calculate average sentiment score
   */
  private calculateAverage(scores: SentimentScore[]): number {
    if (scores.length === 0) return 0;
    const sum = scores.reduce((acc, s) => acc + s.score, 0);
    return sum / scores.length;
  }

  /**
   * Get sentiment history for a session
   */
  getSentimentHistory(sessionId: string): SentimentHistory | null {
    const scores = this.history.get(sessionId);
    if (!scores || scores.length === 0) return null;
    
    return {
      scores,
      averageScore: this.calculateAverage(scores),
      trend: this.calculateTrend(scores)
    };
  }

  /**
   * Clear history for a session
   */
  clearSession(sessionId: string): void {
    this.history.delete(sessionId);
  }

  /**
   * Set alert threshold
   */
  setAlertThreshold(threshold: number): void {
    this.alertThreshold = Math.max(-1, Math.min(0, threshold));
  }
}

