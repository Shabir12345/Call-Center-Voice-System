/**
 * Resource Monitor
 * 
 * Monitors system resources (memory, storage, logs) and implements
 * automatic cleanup to prevent resource exhaustion.
 */

export interface ResourceMetrics {
  memoryUsage: {
    used: number;        // MB
    total: number;      // MB
    percentage: number; // 0-100
  };
  storageUsage: {
    localStorage: {
      used: number;     // KB
      available: number; // KB (estimated)
      percentage: number;
    };
  };
  logCount: number;
  sessionCount: number;
}

export interface ResourceLimits {
  maxMemoryMB?: number;
  maxLogs?: number;
  maxSessions?: number;
  maxLocalStorageKB?: number;
}

export interface ResourceAlert {
  level: 'warning' | 'critical';
  resource: string;
  message: string;
  current: number;
  limit: number;
  percentage: number;
}

/**
 * Resource Monitor class
 */
export class ResourceMonitor {
  private limits: ResourceLimits;
  private alerts: ResourceAlert[] = [];
  private onAlert?: (alert: ResourceAlert) => void;

  constructor(limits: ResourceLimits = {}) {
    this.limits = {
      maxMemoryMB: limits.maxMemoryMB || 500,      // 500 MB default
      maxLogs: limits.maxLogs || 10000,
      maxSessions: limits.maxSessions || 1000,
      maxLocalStorageKB: limits.maxLocalStorageKB || 5000, // 5 MB default
      ...limits
    };
  }

  /**
   * Set alert callback
   */
  setAlertCallback(callback: (alert: ResourceAlert) => void): void {
    this.onAlert = callback;
  }

  /**
   * Get current resource metrics
   */
  getMetrics(): ResourceMetrics {
    const memoryUsage = this.getMemoryUsage();
    const storageUsage = this.getStorageUsage();
    const logCount = this.getLogCount();
    const sessionCount = this.getSessionCount();

    return {
      memoryUsage,
      storageUsage,
      logCount,
      sessionCount
    };
  }

  /**
   * Get memory usage (if available)
   */
  private getMemoryUsage(): ResourceMetrics['memoryUsage'] {
    // @ts-ignore - performance.memory is Chrome-specific
    const memory = (performance as any).memory;
    
    if (memory) {
      const used = memory.usedJSHeapSize / (1024 * 1024); // MB
      const total = memory.totalJSHeapSize / (1024 * 1024); // MB
      const percentage = (used / total) * 100;

      return { used, total, percentage };
    }

    // Fallback if memory API not available
    return { used: 0, total: 0, percentage: 0 };
  }

  /**
   * Get localStorage usage
   */
  private getStorageUsage(): ResourceMetrics['storageUsage'] {
    if (typeof window === 'undefined' || !window.localStorage) {
      return {
        localStorage: { used: 0, available: 0, percentage: 0 }
      };
    }

    let used = 0;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          const value = localStorage.getItem(key) || '';
          used += key.length + value.length;
        }
      }
    } catch (e) {
      console.warn('Failed to calculate localStorage usage:', e);
    }

    const usedKB = used / 1024;
    const availableKB = this.limits.maxLocalStorageKB || 5000;
    const percentage = (usedKB / availableKB) * 100;

    return {
      localStorage: {
        used: usedKB,
        available: availableKB,
        percentage
      }
    };
  }

  /**
   * Get log count (estimate)
   */
  private getLogCount(): number {
    // This would need to be integrated with the logger
    // For now, return 0 as placeholder
    return 0;
  }

  /**
   * Get session count (estimate)
   */
  private getSessionCount(): number {
    if (typeof window === 'undefined' || !window.localStorage) {
      return 0;
    }

    let count = 0;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('session_')) {
          count++;
        }
      }
    } catch (e) {
      console.warn('Failed to count sessions:', e);
    }

    return count;
  }

  /**
   * Check resources and generate alerts
   */
  checkResources(): ResourceAlert[] {
    this.alerts = [];
    const metrics = this.getMetrics();

    // Check memory
    if (this.limits.maxMemoryMB && metrics.memoryUsage.used > this.limits.maxMemoryMB) {
      const alert: ResourceAlert = {
        level: metrics.memoryUsage.percentage > 90 ? 'critical' : 'warning',
        resource: 'memory',
        message: `Memory usage is ${metrics.memoryUsage.percentage.toFixed(1)}% (${metrics.memoryUsage.used.toFixed(1)} MB / ${this.limits.maxMemoryMB} MB)`,
        current: metrics.memoryUsage.used,
        limit: this.limits.maxMemoryMB,
        percentage: metrics.memoryUsage.percentage
      };
      this.alerts.push(alert);
      if (this.onAlert) {
        this.onAlert(alert);
      }
    }

    // Check localStorage
    if (this.limits.maxLocalStorageKB && metrics.storageUsage.localStorage.used > this.limits.maxLocalStorageKB) {
      const alert: ResourceAlert = {
        level: metrics.storageUsage.localStorage.percentage > 90 ? 'critical' : 'warning',
        resource: 'localStorage',
        message: `LocalStorage usage is ${metrics.storageUsage.localStorage.percentage.toFixed(1)}% (${metrics.storageUsage.localStorage.used.toFixed(1)} KB / ${this.limits.maxLocalStorageKB} KB)`,
        current: metrics.storageUsage.localStorage.used,
        limit: this.limits.maxLocalStorageKB,
        percentage: metrics.storageUsage.localStorage.percentage
      };
      this.alerts.push(alert);
      if (this.onAlert) {
        this.onAlert(alert);
      }
    }

    // Check logs
    if (this.limits.maxLogs && metrics.logCount > this.limits.maxLogs) {
      const alert: ResourceAlert = {
        level: 'warning',
        resource: 'logs',
        message: `Log count exceeds limit: ${metrics.logCount} / ${this.limits.maxLogs}`,
        current: metrics.logCount,
        limit: this.limits.maxLogs,
        percentage: (metrics.logCount / this.limits.maxLogs) * 100
      };
      this.alerts.push(alert);
      if (this.onAlert) {
        this.onAlert(alert);
      }
    }

    // Check sessions
    if (this.limits.maxSessions && metrics.sessionCount > this.limits.maxSessions) {
      const alert: ResourceAlert = {
        level: 'warning',
        resource: 'sessions',
        message: `Session count exceeds limit: ${metrics.sessionCount} / ${this.limits.maxSessions}`,
        current: metrics.sessionCount,
        limit: this.limits.maxSessions,
        percentage: (metrics.sessionCount / this.limits.maxSessions) * 100
      };
      this.alerts.push(alert);
      if (this.onAlert) {
        this.onAlert(alert);
      }
    }

    return this.alerts;
  }

  /**
   * Clean up old sessions from localStorage
   */
  cleanupOldSessions(maxAge: number = 24 * 60 * 60 * 1000): number {
    if (typeof window === 'undefined' || !window.localStorage) {
      return 0;
    }

    let cleaned = 0;
    const now = Date.now();

    try {
      const keysToRemove: string[] = [];
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('session_')) {
          try {
            const data = localStorage.getItem(key);
            if (data) {
              // Try to parse and check timestamp
              const session = JSON.parse(data);
              const sessionTime = session.created_at || session.createdAt || 0;
              
              if (now - sessionTime > maxAge) {
                keysToRemove.push(key);
              }
            }
          } catch (e) {
            // If we can't parse, assume it's old and remove it
            keysToRemove.push(key);
          }
        }
      }

      // Remove old sessions
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
        cleaned++;
      });
    } catch (e) {
      console.warn('Failed to cleanup sessions:', e);
    }

    return cleaned;
  }

  /**
   * Clean up localStorage if over limit
   */
  cleanupStorage(): number {
    const metrics = this.getMetrics();
    
    if (!this.limits.maxLocalStorageKB) {
      return 0;
    }

    if (metrics.storageUsage.localStorage.used <= this.limits.maxLocalStorageKB) {
      return 0;
    }

    // Clean up old sessions first
    let cleaned = this.cleanupOldSessions(12 * 60 * 60 * 1000); // 12 hours

    // If still over limit, clean up more aggressively
    const metricsAfter = this.getMetrics();
    if (metricsAfter.storageUsage.localStorage.used > this.limits.maxLocalStorageKB) {
      cleaned += this.cleanupOldSessions(1 * 60 * 60 * 1000); // 1 hour
    }

    return cleaned;
  }

  /**
   * Get current alerts
   */
  getAlerts(): ResourceAlert[] {
    return [...this.alerts];
  }

  /**
   * Clear alerts
   */
  clearAlerts(): void {
    this.alerts = [];
  }
}

/**
 * Global resource monitor instance
 */
export const globalResourceMonitor = new ResourceMonitor({
  maxMemoryMB: 500,
  maxLogs: 10000,
  maxSessions: 1000,
  maxLocalStorageKB: 5000
});

/**
 * Start periodic resource monitoring
 */
if (typeof window !== 'undefined') {
  // Check resources every 5 minutes
  setInterval(() => {
    globalResourceMonitor.checkResources();
    globalResourceMonitor.cleanupStorage();
  }, 5 * 60 * 1000);
}

