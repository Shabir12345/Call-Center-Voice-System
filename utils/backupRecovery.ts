/**
 * Backup and Recovery Utilities
 * 
 * Utilities for backing up and recovering system state
 */

import { StateManager, Session } from './stateManager';
import { CentralLogger } from './logger';

/**
 * Backup data
 */
export interface BackupData {
  timestamp: number;
  sessions: Session[];
  metadata: {
    version: string;
    totalSessions: number;
  };
}

/**
 * Backup Manager
 */
export class BackupManager {
  private stateManager: StateManager;
  private logger: CentralLogger;

  constructor(stateManager: StateManager, logger: CentralLogger) {
    this.stateManager = stateManager;
    this.logger = logger;
  }

  /**
   * Create backup
   */
  async createBackup(): Promise<BackupData> {
    const sessions = await this.stateManager.getActiveSessions();

    const backup: BackupData = {
      timestamp: Date.now(),
      sessions: sessions.map(s => ({ ...s })), // Clone sessions
      metadata: {
        version: '1.0',
        totalSessions: sessions.length
      }
    };

    this.logger.info(`Backup created: ${sessions.length} sessions`, {
      timestamp: backup.timestamp
    });

    return backup;
  }

  /**
   * Restore from backup
   */
  async restoreBackup(backup: BackupData): Promise<number> {
    let restored = 0;

    for (const session of backup.sessions) {
      try {
        // Restore session
        await this.stateManager.updateSession(session.id, session);
        restored++;
      } catch (error) {
        this.logger.error(`Failed to restore session ${session.id}`, error);
      }
    }

    this.logger.info(`Backup restored: ${restored}/${backup.sessions.length} sessions`, {
      backupTimestamp: backup.timestamp
    });

    return restored;
  }

  /**
   * Export backup to JSON
   */
  exportBackup(backup: BackupData): string {
    return JSON.stringify(backup, null, 2);
  }

  /**
   * Import backup from JSON
   */
  importBackup(json: string): BackupData {
    return JSON.parse(json);
  }

  /**
   * Schedule automatic backups
   */
  scheduleBackups(intervalMs: number, callback: (backup: BackupData) => Promise<void>): NodeJS.Timeout {
    return setInterval(async () => {
      try {
        const backup = await this.createBackup();
        await callback(backup);
      } catch (error) {
        this.logger.error('Scheduled backup failed', error);
      }
    }, intervalMs);
  }
}

