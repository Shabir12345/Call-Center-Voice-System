/**
 * Session Manager
 * 
 * High-level session management with automatic cleanup,
 * session recovery, and activity tracking.
 */

import { StateManager, Session } from './stateManager';
import { CentralLogger } from './logger';

/**
 * Session activity tracking
 */
export interface SessionActivity {
  sessionId: string;
  lastActivity: number;
  messageCount: number;
  activeDuration: number;
}

/**
 * Session Manager
 */
export class SessionManager {
  private stateManager: StateManager;
  private logger: CentralLogger;
  private activityTracker: Map<string, SessionActivity> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private cleanupIntervalMs: number = 5 * 60 * 1000; // 5 minutes

  constructor(stateManager: StateManager, logger: CentralLogger) {
    this.stateManager = stateManager;
    this.logger = logger;
    this.startCleanupInterval();
  }

  /**
   * Get or create session with activity tracking
   */
  async getOrCreateSession(sessionId: string, callerId?: string): Promise<Session> {
    const session = await this.stateManager.getOrCreateSession(sessionId, callerId);
    
    // Track activity
    this.updateActivity(sessionId);
    
    return session;
  }

  /**
   * Update session activity
   */
  updateActivity(sessionId: string): void {
    const now = Date.now();
    const activity = this.activityTracker.get(sessionId);

    if (activity) {
      activity.lastActivity = now;
      activity.messageCount++;
    } else {
      this.activityTracker.set(sessionId, {
        sessionId,
        lastActivity: now,
        messageCount: 1,
        activeDuration: 0
      });
    }
  }

  /**
   * Get session activity
   */
  getActivity(sessionId: string): SessionActivity | null {
    return this.activityTracker.get(sessionId) || null;
  }

  /**
   * Get all active sessions
   */
  async getActiveSessions(): Promise<Session[]> {
    const sessions = await this.stateManager.getActiveSessions();
    
    // Filter out expired and update activity
    const active: Session[] = [];
    for (const session of sessions) {
      if (!session.isExpired()) {
        const activity = this.activityTracker.get(session.id);
        if (activity) {
          activity.activeDuration = Date.now() - (session.createdAt || Date.now());
        }
        active.push(session);
      }
    }

    return active;
  }

  /**
   * Cleanup expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    const sessions = await this.stateManager.getActiveSessions();
    let cleaned = 0;

    for (const session of sessions) {
      if (session.isExpired()) {
        await this.stateManager.deleteSession(session.id);
        this.activityTracker.delete(session.id);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.info(`Cleaned up ${cleaned} expired sessions`);
    }

    return cleaned;
  }

  /**
   * Start automatic cleanup interval
   */
  private startCleanupInterval(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions().catch(error => {
        this.logger.error('Error during session cleanup', error);
      });
    }, this.cleanupIntervalMs);
  }

  /**
   * Stop cleanup interval
   */
  stopCleanupInterval(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Get session statistics
   */
  getStatistics(): {
    totalSessions: number;
    activeSessions: number;
    expiredSessions: number;
    averageMessageCount: number;
    averageDuration: number;
  } {
    const activities = Array.from(this.activityTracker.values());
    const active = activities.filter(a => {
      const session = this.stateManager.getSession(a.sessionId);
      return session && !session.isExpired();
    });

    const totalMessages = activities.reduce((sum, a) => sum + a.messageCount, 0);
    const totalDuration = activities.reduce((sum, a) => sum + a.activeDuration, 0);

    return {
      totalSessions: activities.length,
      activeSessions: active.length,
      expiredSessions: activities.length - active.length,
      averageMessageCount: activities.length > 0 ? totalMessages / activities.length : 0,
      averageDuration: activities.length > 0 ? totalDuration / activities.length : 0
    };
  }

  /**
   * Resume session after disconnection
   */
  async resumeSession(sessionId: string): Promise<Session | null> {
    const session = await this.stateManager.getSession(sessionId);
    
    if (!session) {
      return null;
    }

    if (session.isExpired()) {
      this.logger.info(`Session ${sessionId} expired, creating new session`);
      return await this.getOrCreateSession(sessionId);
    }

    // Update activity
    this.updateActivity(sessionId);
    
    // Extend session
    session.extend();
    await this.stateManager.updateSession(sessionId, session);

    return session;
  }

  /**
   * End session explicitly
   */
  async endSession(sessionId: string): Promise<void> {
    await this.stateManager.deleteSession(sessionId);
    this.activityTracker.delete(sessionId);
    this.logger.info(`Session ${sessionId} ended`);
  }
}

