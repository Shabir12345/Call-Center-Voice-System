/**
 * Feedback Collector
 * 
 * Collects and manages customer feedback after calls.
 */

export type FeedbackRating = 1 | 2 | 3 | 4 | 5;
export type NPSRating = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export interface Feedback {
  id: string;
  sessionId: string;
  timestamp: number;
  rating?: FeedbackRating;
  npsRating?: NPSRating;
  comment?: string;
  tags?: string[];
  metadata?: {
    agentId?: string;
    agentName?: string;
    callDuration?: number;
    resolutionStatus?: 'resolved' | 'unresolved' | 'escalated';
  };
}

export interface FeedbackAnalytics {
  totalFeedback: number;
  averageRating: number;
  averageNPS: number;
  npsCategories: {
    detractors: number; // 0-6
    passives: number; // 7-8
    promoters: number; // 9-10
  };
  ratingDistribution: Record<FeedbackRating, number>;
  commonTags: Array<{ tag: string; count: number }>;
  sentiment: {
    positive: number;
    neutral: number;
    negative: number;
  };
}

export class FeedbackCollector {
  private feedbacks: Map<string, Feedback> = new Map();

  /**
   * Submit feedback
   */
  submitFeedback(feedback: Omit<Feedback, 'id' | 'timestamp'>): Feedback {
    const newFeedback: Feedback = {
      ...feedback,
      id: `feedback_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      timestamp: Date.now()
    };

    this.feedbacks.set(newFeedback.id, newFeedback);
    this.storeFeedback(newFeedback);

    return newFeedback;
  }

  /**
   * Get feedback by ID
   */
  getFeedback(feedbackId: string): Feedback | null {
    return this.feedbacks.get(feedbackId) || null;
  }

  /**
   * Get feedbacks for a session
   */
  getSessionFeedbacks(sessionId: string): Feedback[] {
    return Array.from(this.feedbacks.values()).filter(f => f.sessionId === sessionId);
  }

  /**
   * Get all feedbacks
   */
  getAllFeedbacks(limit?: number): Feedback[] {
    const all = Array.from(this.feedbacks.values());
    all.sort((a, b) => b.timestamp - a.timestamp);
    return limit ? all.slice(0, limit) : all;
  }

  /**
   * Get analytics
   */
  getAnalytics(dateRange?: { start: number; end: number }): FeedbackAnalytics {
    let feedbacks = Array.from(this.feedbacks.values());

    // Filter by date range if provided
    if (dateRange) {
      feedbacks = feedbacks.filter(f => 
        f.timestamp >= dateRange.start && f.timestamp <= dateRange.end
      );
    }

    const total = feedbacks.length;
    const ratings = feedbacks.filter(f => f.rating).map(f => f.rating!);
    const npsRatings = feedbacks.filter(f => f.npsRating !== undefined).map(f => f.npsRating!);

    // Calculate averages
    const averageRating = ratings.length > 0
      ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length
      : 0;

    const averageNPS = npsRatings.length > 0
      ? npsRatings.reduce((sum, r) => sum + r, 0) / npsRatings.length
      : 0;

    // NPS categories
    const npsCategories = {
      detractors: npsRatings.filter(r => r <= 6).length,
      passives: npsRatings.filter(r => r >= 7 && r <= 8).length,
      promoters: npsRatings.filter(r => r >= 9).length
    };

    // Rating distribution
    const ratingDistribution: Record<FeedbackRating, number> = {
      1: 0, 2: 0, 3: 0, 4: 0, 5: 0
    };
    ratings.forEach(r => {
      ratingDistribution[r as FeedbackRating]++;
    });

    // Common tags
    const tagCounts: Map<string, number> = new Map();
    feedbacks.forEach(f => {
      f.tags?.forEach(tag => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      });
    });
    const commonTags = Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Sentiment (simple keyword-based)
    let positive = 0;
    let negative = 0;
    let neutral = 0;

    feedbacks.forEach(f => {
      if (f.comment) {
        const lower = f.comment.toLowerCase();
        if (lower.match(/\b(good|great|excellent|happy|satisfied|love|amazing)\b/)) {
          positive++;
        } else if (lower.match(/\b(bad|terrible|awful|hate|disappointed|frustrated)\b/)) {
          negative++;
        } else {
          neutral++;
        }
      } else {
        neutral++;
      }
    });

    return {
      totalFeedback: total,
      averageRating,
      averageNPS,
      npsCategories,
      ratingDistribution,
      commonTags,
      sentiment: {
        positive,
        neutral,
        negative
      }
    };
  }

  /**
   * Store feedback in IndexedDB
   */
  private async storeFeedback(feedback: Feedback): Promise<void> {
    try {
      const db = await this.openDatabase();
      const transaction = db.transaction(['feedbacks'], 'readwrite');
      const store = transaction.objectStore('feedbacks');
      await store.put(feedback);
    } catch (error) {
      console.error('Error storing feedback:', error);
    }
  }

  /**
   * Open IndexedDB
   */
  private async openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('FeedbackDB', 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('feedbacks')) {
          const store = db.createObjectStore('feedbacks', { keyPath: 'id' });
          store.createIndex('sessionId', 'sessionId', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }
}

