/**
 * Connection Router
 * 
 * Handles candidate selection and routing logic for intent-based connection selection.
 * Filters connections based on enabled status and preconditions.
 */

import { 
  ConnectionContextCard, 
  ConnectionPrecondition, 
  ConversationState,
  AppConnection,
  Edge
} from '../types';
import { ConnectionContextStorage, getConnectionContextStorage } from './connectionContextStorage';

export interface CandidateConnection {
  connectionId: string;
  contextCard: ConnectionContextCard;
  edge: Edge;
}

export interface CandidateSelectionOptions {
  includeDisabled?: boolean; // Include disabled connections (default: false)
  requirePreconditions?: boolean; // Require all preconditions to be met (default: true)
  includeFallback?: boolean; // Include fallback connections (default: true)
}

/**
 * Connection Router class
 */
export class ConnectionRouter {
  private contextStorage: ConnectionContextStorage;

  constructor(contextStorage?: ConnectionContextStorage) {
    this.contextStorage = contextStorage || getConnectionContextStorage();
  }

  /**
   * Get candidate connections from a node
   */
  async getCandidateConnections(
    currentNodeId: string,
    edges: Edge[],
    conversationState: ConversationState,
    options: CandidateSelectionOptions = {}
  ): Promise<CandidateConnection[]> {
    const opts: Required<CandidateSelectionOptions> = {
      includeDisabled: options.includeDisabled ?? false,
      requirePreconditions: options.requirePreconditions ?? true,
      includeFallback: options.includeFallback ?? true,
    };

    // Get all outgoing edges from current node
    const outgoingEdges = edges.filter(edge => edge.source === currentNodeId);

    // Get context cards for these edges
    const candidates: CandidateConnection[] = [];

    for (const edge of outgoingEdges) {
      const contextCard = await this.contextStorage.getContextCardByConnectionId(edge.id);
      
      if (!contextCard) {
        // If no context card exists, create a default one
        const defaultCard = this.contextStorage.createDefaultContextCard(
          edge.id,
          edge.source,
          edge.target
        );
        await this.contextStorage.saveContextCard(defaultCard);
        
        candidates.push({
          connectionId: edge.id,
          contextCard: defaultCard,
          edge,
        });
        continue;
      }

      // Check if connection is enabled
      if (!contextCard.enabled && !opts.includeDisabled) {
        continue;
      }

      // Check preconditions if required
      if (opts.requirePreconditions && contextCard.preconditions) {
        const preconditionsMet = this.checkPreconditions(
          contextCard.preconditions,
          conversationState
        );
        
        if (!preconditionsMet) {
          continue; // Skip this connection if preconditions not met
        }
      }

      candidates.push({
        connectionId: edge.id,
        contextCard,
        edge,
      });
    }

    // Sort by priority (higher priority first)
    candidates.sort((a, b) => b.contextCard.priority - a.contextCard.priority);

    return candidates;
  }

  /**
   * Check if preconditions are met
   */
  private checkPreconditions(
    preconditions: ConnectionPrecondition[],
    state: ConversationState
  ): boolean {
    for (const precondition of preconditions) {
      const value = this.getStateValue(state, precondition.key);
      
      switch (precondition.operator) {
        case 'exists':
          if (value === undefined || value === null) {
            return false;
          }
          break;
        
        case 'not_exists':
          if (value !== undefined && value !== null) {
            return false;
          }
          break;
        
        case 'equals':
          if (value !== precondition.value) {
            return false;
          }
          break;
        
        case 'not_equals':
          if (value === precondition.value) {
            return false;
          }
          break;
        
        case 'greater_than':
          if (typeof value === 'number' && typeof precondition.value === 'number') {
            if (value <= precondition.value) {
              return false;
            }
          } else {
            return false; // Type mismatch
          }
          break;
        
        case 'less_than':
          if (typeof value === 'number' && typeof precondition.value === 'number') {
            if (value >= precondition.value) {
              return false;
            }
          } else {
            return false; // Type mismatch
          }
          break;
        
        default:
          console.warn(`Unknown precondition operator: ${precondition.operator}`);
          return false;
      }
    }

    return true; // All preconditions met
  }

  /**
   * Get a value from conversation state by key
   * Supports nested keys like "flags.authenticated" or "knownEntities.customerId"
   */
  private getStateValue(state: ConversationState, key: string): any {
    const parts = key.split('.');
    let value: any = state;

    for (const part of parts) {
      if (value === undefined || value === null) {
        return undefined;
      }
      value = value[part];
    }

    return value;
  }

  /**
   * Get a fallback connection (e.g., clarification or safe default)
   * This should always be available when no good candidates are found
   */
  async getFallbackConnection(
    currentNodeId: string,
    edges: Edge[],
    fallbackNodeId?: string
  ): Promise<CandidateConnection | null> {
    // Look for a connection to a clarification or safe default node
    if (fallbackNodeId) {
      const fallbackEdge = edges.find(
        edge => edge.source === currentNodeId && edge.target === fallbackNodeId
      );
      
      if (fallbackEdge) {
        let contextCard = await this.contextStorage.getContextCardByConnectionId(fallbackEdge.id);
        
        if (!contextCard) {
          contextCard = this.contextStorage.createDefaultContextCard(
            fallbackEdge.id,
            fallbackEdge.source,
            fallbackEdge.target
          );
          contextCard.name = 'Clarification';
          contextCard.purpose = 'Ask caller for clarification when intent is unclear';
          contextCard.whenToUse = 'Use when no other connection is a good match';
          await this.contextStorage.saveContextCard(contextCard);
        }

        return {
          connectionId: fallbackEdge.id,
          contextCard,
          edge: fallbackEdge,
        };
      }
    }

    // If no specific fallback node, return null (caller should handle)
    return null;
  }

  /**
   * Get all connections for a node (both incoming and outgoing)
   */
  async getAllConnectionsForNode(
    nodeId: string,
    edges: Edge[]
  ): Promise<{ incoming: CandidateConnection[]; outgoing: CandidateConnection[] }> {
    const incoming: CandidateConnection[] = [];
    const outgoing: CandidateConnection[] = [];

    // Incoming edges
    for (const edge of edges.filter(e => e.target === nodeId)) {
      const contextCard = await this.contextStorage.getContextCardByConnectionId(edge.id);
      if (contextCard) {
        incoming.push({
          connectionId: edge.id,
          contextCard,
          edge,
        });
      }
    }

    // Outgoing edges
    for (const edge of edges.filter(e => e.source === nodeId)) {
      const contextCard = await this.contextStorage.getContextCardByConnectionId(edge.id);
      if (contextCard) {
        outgoing.push({
          connectionId: edge.id,
          contextCard,
          edge,
        });
      }
    }

    return { incoming, outgoing };
  }

  /**
   * Check if a connection is available (enabled and preconditions met)
   */
  async isConnectionAvailable(
    connectionId: string,
    conversationState: ConversationState
  ): Promise<boolean> {
    const contextCard = await this.contextStorage.getContextCardByConnectionId(connectionId);
    
    if (!contextCard) {
      return false; // No context card means connection not configured
    }

    if (!contextCard.enabled) {
      return false; // Connection is disabled
    }

    // Check preconditions
    if (contextCard.preconditions && contextCard.preconditions.length > 0) {
      return this.checkPreconditions(contextCard.preconditions, conversationState);
    }

    return true; // Available
  }
}

