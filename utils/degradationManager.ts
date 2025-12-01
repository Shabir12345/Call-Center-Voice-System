/**
 * Degradation Manager
 * 
 * Manages system degradation levels and fallback strategies when components fail.
 * Provides graceful degradation to maintain core functionality during outages.
 * 
 * Degradation Levels:
 * - Level 0: Full functionality (all services operational)
 * - Level 1: Reduced features (no voice, text-only mode)
 * - Level 2: Minimal mode (rule-based responses only)
 * - Level 3: Emergency mode (static responses, escalate to human)
 */

import { CentralLogger } from './logger';

/**
 * Degradation level enum
 */
export enum DegradationLevel {
  FULL = 0,        // All systems operational
  REDUCED = 1,     // Reduced features (text-only, no voice)
  MINIMAL = 2,     // Minimal functionality (rule-based only)
  EMERGENCY = 3    // Emergency mode (static responses)
}

/**
 * Degradation reason
 */
export interface DegradationReason {
  component: string;
  reason: string;
  timestamp: number;
  level: DegradationLevel;
}

/**
 * Degradation manager configuration
 */
export interface DegradationManagerConfig {
  logger?: CentralLogger;
  onLevelChange?: (level: DegradationLevel, reason: DegradationReason) => void;
  enableAutoRecovery?: boolean;
  recoveryCheckInterval?: number; // ms
}

/**
 * Component health status
 */
interface ComponentHealth {
  component: string;
  healthy: boolean;
  lastCheck: number;
  failureCount: number;
  lastFailureReason?: string;
}

/**
 * Degradation Manager
 */
export class DegradationManager {
  private currentLevel: DegradationLevel = DegradationLevel.FULL;
  private componentHealth: Map<string, ComponentHealth> = new Map();
  private degradationHistory: DegradationReason[] = [];
  private logger: CentralLogger;
  private config: DegradationManagerConfig;
  private recoveryCheckInterval?: ReturnType<typeof setInterval>;

  constructor(config: DegradationManagerConfig = {}) {
    this.config = {
      enableAutoRecovery: true,
      recoveryCheckInterval: 30000, // 30 seconds
      ...config
    };
    this.logger = config.logger || new CentralLogger('info');

    // Initialize component health tracking
    this.initializeComponents();

    // Start auto-recovery checks if enabled
    if (this.config.enableAutoRecovery) {
      this.startRecoveryChecks();
    }
  }

  /**
   * Initialize component health tracking
   */
  private initializeComponents(): void {
    const components = [
      'llm',           // LLM service (Gemini)
      'voice',         // Voice/audio capabilities
      'integration',   // External integrations
      'database',      // Database/storage
      'cache'          // Caching system
    ];

    components.forEach(component => {
      this.componentHealth.set(component, {
        component,
        healthy: true,
        lastCheck: Date.now(),
        failureCount: 0
      });
    });
  }

  /**
   * Report component failure
   */
  reportFailure(component: string, reason: string): void {
    const health = this.componentHealth.get(component);
    if (!health) {
      this.logger.warn(`Unknown component: ${component}`);
      return;
    }

    health.healthy = false;
    health.lastCheck = Date.now();
    health.failureCount++;
    health.lastFailureReason = reason;

    this.logger.warn(`Component failure: ${component}`, { reason, failureCount: health.failureCount });

    // Recalculate degradation level
    this.recalculateLevel(component, reason);
  }

  /**
   * Report component recovery
   */
  reportRecovery(component: string): void {
    const health = this.componentHealth.get(component);
    if (!health) {
      return;
    }

    const wasUnhealthy = !health.healthy;
    health.healthy = true;
    health.lastCheck = Date.now();
    health.failureCount = 0;
    health.lastFailureReason = undefined;

    if (wasUnhealthy) {
      this.logger.info(`Component recovered: ${component}`);
      // Recalculate degradation level (may improve)
      this.recalculateLevel(component, 'Component recovered');
    }
  }

  /**
   * Recalculate current degradation level based on component health
   */
  private recalculateLevel(failedComponent: string, reason: string): void {
    const llmHealthy = this.componentHealth.get('llm')?.healthy ?? true;
    const voiceHealthy = this.componentHealth.get('voice')?.healthy ?? true;
    const integrationHealthy = this.componentHealth.get('integration')?.healthy ?? true;
    const databaseHealthy = this.componentHealth.get('database')?.healthy ?? true;

    let newLevel: DegradationLevel = DegradationLevel.FULL;

    // Determine degradation level based on component failures
    if (!llmHealthy && !voiceHealthy) {
      // Both LLM and voice down - minimal mode
      newLevel = DegradationLevel.MINIMAL;
    } else if (!llmHealthy) {
      // LLM down but voice might work - reduced mode
      newLevel = DegradationLevel.REDUCED;
    } else if (!voiceHealthy && !integrationHealthy) {
      // Voice and integrations down - reduced mode
      newLevel = DegradationLevel.REDUCED;
    } else if (!voiceHealthy) {
      // Only voice down - reduced mode
      newLevel = DegradationLevel.REDUCED;
    } else if (!databaseHealthy && !integrationHealthy) {
      // Database and integrations down - minimal mode
      newLevel = DegradationLevel.MINIMAL;
    } else if (!integrationHealthy || !databaseHealthy) {
      // Some integrations down - reduced mode
      newLevel = DegradationLevel.REDUCED;
    }

    // Update level if changed
    if (newLevel !== this.currentLevel) {
      const previousLevel = this.currentLevel;
      this.currentLevel = newLevel;

      const degradationReason: DegradationReason = {
        component: failedComponent,
        reason,
        timestamp: Date.now(),
        level: newLevel
      };

      this.degradationHistory.push(degradationReason);
      
      // Keep only last 100 degradation events
      if (this.degradationHistory.length > 100) {
        this.degradationHistory = this.degradationHistory.slice(-100);
      }

      this.logger.warn(`Degradation level changed: ${DegradationLevel[previousLevel]} → ${DegradationLevel[newLevel]}`, {
        component: failedComponent,
        reason
      });

      // Notify callback
      if (this.config.onLevelChange) {
        this.config.onLevelChange(newLevel, degradationReason);
      }
    }
  }

  /**
   * Get current degradation level
   */
  getLevel(): DegradationLevel {
    return this.currentLevel;
  }

  /**
   * Check if a feature is available at current degradation level
   */
  isFeatureAvailable(feature: 'voice' | 'llm' | 'integrations' | 'cache'): boolean {
    switch (this.currentLevel) {
      case DegradationLevel.FULL:
        return true;
      
      case DegradationLevel.REDUCED:
        // Voice unavailable, LLM and integrations should work
        return feature !== 'voice';
      
      case DegradationLevel.MINIMAL:
        // Only rule-based responses, no external services
        return false;
      
      case DegradationLevel.EMERGENCY:
        // Emergency mode - no features
        return false;
      
      default:
        return false;
    }
  }

  /**
   * Get fallback strategy for a failed component
   */
  getFallbackStrategy(component: string): string {
    switch (component) {
      case 'llm':
        return this.currentLevel >= DegradationLevel.MINIMAL
          ? 'Use rule-based responses'
          : 'Fall back to cached responses or static messages';
      
      case 'voice':
        return 'Fall back to text mode';
      
      case 'integration':
        return 'Use cached data and notify user of limited functionality';
      
      case 'database':
        return 'Use in-memory cache and limit data access';
      
      case 'cache':
        return 'Direct access without caching (may be slower)';
      
      default:
        return 'Unknown fallback strategy';
    }
  }

  /**
   * Get component health status
   */
  getComponentHealth(component: string): ComponentHealth | undefined {
    return this.componentHealth.get(component);
  }

  /**
   * Get all component health statuses
   */
  getAllComponentHealth(): Map<string, ComponentHealth> {
    return new Map(this.componentHealth);
  }

  /**
   * Get degradation history
   */
  getHistory(limit: number = 10): DegradationReason[] {
    return this.degradationHistory.slice(-limit);
  }

  /**
   * Start automatic recovery checks
   */
  private startRecoveryChecks(): void {
    if (this.recoveryCheckInterval) {
      clearInterval(this.recoveryCheckInterval);
    }

    this.recoveryCheckInterval = setInterval(() => {
      this.checkComponentRecovery();
    }, this.config.recoveryCheckInterval || 30000);
  }

  /**
   * Check if components have recovered (for auto-recovery)
   */
  private checkComponentRecovery(): void {
    // This would typically involve health checks or probes
    // For now, we'll rely on explicit reportRecovery() calls
    // In a full implementation, this would ping services
  }

  /**
   * Manually set degradation level (for testing/emergency)
   */
  setLevel(level: DegradationLevel, reason: string = 'Manual override'): void {
    if (level !== this.currentLevel) {
      const previousLevel = this.currentLevel;
      this.currentLevel = level;

      const degradationReason: DegradationReason = {
        component: 'system',
        reason,
        timestamp: Date.now(),
        level
      };

      this.degradationHistory.push(degradationReason);

      this.logger.warn(`Degradation level manually set: ${DegradationLevel[previousLevel]} → ${DegradationLevel[level]}`, {
        reason
      });

      if (this.config.onLevelChange) {
        this.config.onLevelChange(level, degradationReason);
      }
    }
  }

  /**
   * Reset all degradation (for testing)
   */
  reset(): void {
    this.currentLevel = DegradationLevel.FULL;
    this.degradationHistory = [];
    
    this.componentHealth.forEach(health => {
      health.healthy = true;
      health.failureCount = 0;
      health.lastFailureReason = undefined;
    });

    this.logger.info('Degradation manager reset - all components healthy');
  }

  /**
   * Shutdown degradation manager
   */
  shutdown(): void {
    if (this.recoveryCheckInterval) {
      clearInterval(this.recoveryCheckInterval);
      this.recoveryCheckInterval = undefined;
    }
  }
}

/**
 * Global degradation manager instance
 */
let globalDegradationManager: DegradationManager | null = null;

/**
 * Get or create global degradation manager
 */
export function getDegradationManager(config?: DegradationManagerConfig): DegradationManager {
  if (!globalDegradationManager) {
    globalDegradationManager = new DegradationManager(config);
  }
  return globalDegradationManager;
}
