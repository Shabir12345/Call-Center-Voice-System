/**
 * Call Quality Scorer
 * 
 * Automatically scores call quality based on multiple factors.
 */

import { SentimentScore } from '../types';
import { SentimentHistory } from './sentimentAnalyzer';

export interface QualityFactors {
  resolutionSuccess: boolean;
  sentimentTrend: SentimentHistory | null;
  handleTime: number; // in milliseconds
  agentPoliteness?: number; // 0-1 score
  firstCallResolution?: boolean;
  customerSatisfaction?: number; // 0-1 score
  escalationRequired?: boolean;
}

export interface QualityScore {
  overall: number; // 0-100
  factors: {
    resolution: number;
    sentiment: number;
    efficiency: number;
    professionalism: number;
  };
  breakdown: {
    resolutionWeight: number;
    sentimentWeight: number;
    efficiencyWeight: number;
    professionalismWeight: number;
  };
}

export class CallQualityScorer {
  private weights = {
    resolution: 0.35,
    sentiment: 0.25,
    efficiency: 0.20,
    professionalism: 0.20
  };

  /**
   * Score call quality
   */
  scoreCallQuality(factors: QualityFactors): QualityScore {
    // Resolution score (0-100)
    let resolutionScore = factors.resolutionSuccess ? 100 : 0;
    if (factors.firstCallResolution) {
      resolutionScore = Math.min(100, resolutionScore + 20);
    }
    if (factors.escalationRequired) {
      resolutionScore = Math.max(0, resolutionScore - 30);
    }

    // Sentiment score (0-100)
    let sentimentScore = 50; // Default neutral
    if (factors.sentimentTrend) {
      const avgSentiment = factors.sentimentTrend.averageScore;
      // Convert -1 to 1 range to 0-100
      sentimentScore = ((avgSentiment + 1) / 2) * 100;
      
      // Bonus for improving trend
      if (factors.sentimentTrend.trend === 'improving') {
        sentimentScore = Math.min(100, sentimentScore + 10);
      }
      // Penalty for declining trend
      if (factors.sentimentTrend.trend === 'declining') {
        sentimentScore = Math.max(0, sentimentScore - 15);
      }
    }

    // Efficiency score (0-100)
    // Optimal handle time: 2-5 minutes (120000-300000 ms)
    const optimalMin = 120000;
    const optimalMax = 300000;
    let efficiencyScore = 100;
    
    if (factors.handleTime < optimalMin) {
      // Too fast might indicate rushed service
      efficiencyScore = 70 + (factors.handleTime / optimalMin) * 30;
    } else if (factors.handleTime > optimalMax) {
      // Too slow
      const excess = factors.handleTime - optimalMax;
      const maxPenalty = 300000; // 5 more minutes = 0 score
      efficiencyScore = Math.max(0, 100 - (excess / maxPenalty) * 100);
    }

    // Professionalism score (0-100)
    let professionalismScore = 70; // Default
    if (factors.agentPoliteness !== undefined) {
      professionalismScore = factors.agentPoliteness * 100;
    }
    if (factors.customerSatisfaction !== undefined) {
      professionalismScore = (professionalismScore + factors.customerSatisfaction * 100) / 2;
    }

    // Calculate weighted overall score
    const overall = 
      resolutionScore * this.weights.resolution +
      sentimentScore * this.weights.sentiment +
      efficiencyScore * this.weights.efficiency +
      professionalismScore * this.weights.professionalism;

    return {
      overall: Math.round(overall),
      factors: {
        resolution: Math.round(resolutionScore),
        sentiment: Math.round(sentimentScore),
        efficiency: Math.round(efficiencyScore),
        professionalism: Math.round(professionalismScore)
      },
      breakdown: {
        resolutionWeight: this.weights.resolution,
        sentimentWeight: this.weights.sentiment,
        efficiencyWeight: this.weights.efficiency,
        professionalismWeight: this.weights.professionalism
      }
    };
  }

  /**
   * Get quality category
   */
  getQualityCategory(score: number): 'excellent' | 'good' | 'fair' | 'poor' {
    if (score >= 90) return 'excellent';
    if (score >= 75) return 'good';
    if (score >= 60) return 'fair';
    return 'poor';
  }

  /**
   * Get recommendations for improvement
   */
  getRecommendations(score: QualityScore): string[] {
    const recommendations: string[] = [];

    if (score.factors.resolution < 70) {
      recommendations.push('Focus on improving issue resolution rate. Ensure agents have proper training and resources.');
    }

    if (score.factors.sentiment < 60) {
      recommendations.push('Work on improving customer sentiment. Consider empathy training and proactive problem-solving.');
    }

    if (score.factors.efficiency < 60) {
      recommendations.push('Optimize call handling time. Balance thoroughness with efficiency.');
    }

    if (score.factors.professionalism < 70) {
      recommendations.push('Enhance agent professionalism. Review communication style and customer interaction quality.');
    }

    return recommendations;
  }

  /**
   * Set custom weights
   */
  setWeights(weights: Partial<typeof this.weights>): void {
    this.weights = { ...this.weights, ...weights };
    
    // Normalize weights to sum to 1
    const total = Object.values(this.weights).reduce((sum, w) => sum + w, 0);
    Object.keys(this.weights).forEach(key => {
      (this.weights as any)[key] = (this.weights as any)[key] / total;
    });
  }
}

