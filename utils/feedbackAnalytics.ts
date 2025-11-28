/**
 * Feedback Analytics
 * 
 * Provides advanced analytics and insights from feedback data.
 */

import { FeedbackCollector, FeedbackAnalytics } from './feedbackCollector';

export class FeedbackAnalyticsEngine {
  private collector: FeedbackCollector;

  constructor(collector: FeedbackCollector) {
    this.collector = collector;
  }

  /**
   * Calculate Net Promoter Score (NPS)
   */
  calculateNPS(analytics: FeedbackAnalytics): number {
    const { detractors, passives, promoters } = analytics.npsCategories;
    const total = detractors + passives + promoters;
    
    if (total === 0) return 0;
    
    const promoterPercentage = (promoters / total) * 100;
    const detractorPercentage = (detractors / total) * 100;
    
    return Math.round(promoterPercentage - detractorPercentage);
  }

  /**
   * Get feedback trends over time
   */
  getTrends(days: number = 30): Array<{
    date: string;
    averageRating: number;
    averageNPS: number;
    count: number;
  }> {
    const now = Date.now();
    const startTime = now - (days * 24 * 60 * 60 * 1000);
    
    const analytics = this.collector.getAnalytics({
      start: startTime,
      end: now
    });

    // Group by day (simplified - in production, would group actual data)
    const trends: Array<{ date: string; averageRating: number; averageNPS: number; count: number }> = [];
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now - (i * 24 * 60 * 60 * 1000));
      trends.push({
        date: date.toISOString().split('T')[0],
        averageRating: analytics.averageRating,
        averageNPS: analytics.averageNPS,
        count: analytics.totalFeedback / days // Simplified
      });
    }

    return trends;
  }

  /**
   * Get improvement recommendations
   */
  getRecommendations(analytics: FeedbackAnalytics): string[] {
    const recommendations: string[] = [];

    if (analytics.averageRating < 3) {
      recommendations.push('Average rating is below 3. Consider reviewing agent training and response quality.');
    }

    if (analytics.npsCategories.detractors > analytics.npsCategories.promoters) {
      recommendations.push('More detractors than promoters. Focus on improving customer satisfaction.');
    }

    if (analytics.sentiment.negative > analytics.sentiment.positive) {
      recommendations.push('Negative sentiment exceeds positive. Review common issues and address root causes.');
    }

    const topNegativeTag = analytics.commonTags.find(tag => 
      ['bug', 'error', 'broken', 'slow', 'confusing'].some(neg => tag.tag.toLowerCase().includes(neg))
    );
    if (topNegativeTag) {
      recommendations.push(`Address issues related to "${topNegativeTag.tag}" - mentioned ${topNegativeTag.count} times.`);
    }

    return recommendations;
  }
}

