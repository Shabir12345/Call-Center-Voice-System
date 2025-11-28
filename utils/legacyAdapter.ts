/**
 * Legacy System Adapter
 * 
 * Adapter for migrating from legacy systems to new architecture
 */

import { SystemOrchestrator } from './systemOrchestrator';
import { AppNode } from '../types';
import { TestPanelAdapter } from './testPanelAdapter';

/**
 * Legacy system configuration
 */
export interface LegacyConfig {
  nodes: AppNode[];
  oldCommunicationManager?: any;
  oldStateManager?: any;
}

/**
 * Legacy System Adapter
 */
export class LegacyAdapter {
  private testPanelAdapter: TestPanelAdapter;
  private orchestrator: SystemOrchestrator | null = null;

  constructor(legacyConfig: LegacyConfig) {
    this.testPanelAdapter = new TestPanelAdapter();
  }

  /**
   * Migrate from legacy system
   */
  async migrate(legacyConfig: LegacyConfig): Promise<void> {
    // Initialize new system from legacy nodes
    await this.testPanelAdapter.initializeFromNodes(legacyConfig.nodes);
    
    // Get orchestrator
    this.orchestrator = this.testPanelAdapter.getOrchestrator();
    
    if (!this.orchestrator) {
      throw new Error('Failed to initialize orchestrator from legacy config');
    }
  }

  /**
   * Process input (compatible with legacy interface)
   */
  async processInput(
    input: string,
    sessionId: string,
    userId?: string
  ): Promise<string> {
    if (!this.orchestrator) {
      throw new Error('Adapter not migrated. Call migrate() first.');
    }

    return await this.orchestrator.processCallerInput(input, sessionId, userId);
  }

  /**
   * Get statistics (compatible with legacy interface)
   */
  getStats(): any {
    if (!this.orchestrator) {
      return null;
    }
    return this.orchestrator.getStatistics();
  }

  /**
   * Shutdown
   */
  async shutdown(): Promise<void> {
    if (this.orchestrator) {
      await this.orchestrator.shutdown();
    }
    await this.testPanelAdapter.shutdown();
  }
}

