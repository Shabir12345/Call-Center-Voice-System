/**
 * Connection Context Storage
 * 
 * Manages storage and retrieval of connection context cards for intent-based routing.
 * Uses localStorage for persistence (can be extended to use database).
 */

import { ConnectionContextCard, AppConnection, Edge } from '../types';

const STORAGE_KEY = 'agentflow-connection-contexts-v1';

export class ConnectionContextStorage {
  private storageKey: string;
  private contexts: Map<string, ConnectionContextCard> = new Map();

  constructor(storageKey: string = STORAGE_KEY) {
    this.storageKey = storageKey;
    this.loadAll();
  }

  /**
   * Load all connection contexts from storage
   */
  private loadAll(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = localStorage.getItem(this.storageKey);
        if (stored) {
          const parsed = JSON.parse(stored);
          this.contexts = new Map(Object.entries(parsed));
        }
      }
    } catch (error) {
      console.error('Failed to load connection contexts:', error);
      this.contexts = new Map();
    }
  }

  /**
   * Save all connection contexts to storage
   */
  private saveAll(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const data = Object.fromEntries(this.contexts);
        localStorage.setItem(this.storageKey, JSON.stringify(data));
      }
    } catch (error) {
      console.error('Failed to save connection contexts:', error);
    }
  }

  /**
   * Save or update a connection context card
   */
  async saveContextCard(card: ConnectionContextCard): Promise<void> {
    const now = Date.now();
    const updatedCard: ConnectionContextCard = {
      ...card,
      updatedAt: now,
      createdAt: card.createdAt || now,
    };
    
    this.contexts.set(card.id, updatedCard);
    this.saveAll();
  }

  /**
   * Get a connection context card by ID
   */
  async getContextCard(cardId: string): Promise<ConnectionContextCard | null> {
    return this.contexts.get(cardId) || null;
  }

  /**
   * Get context card by connection ID (edge ID)
   */
  async getContextCardByConnectionId(connectionId: string): Promise<ConnectionContextCard | null> {
    for (const card of this.contexts.values()) {
      if (card.connectionId === connectionId) {
        return card;
      }
    }
    return null;
  }

  /**
   * Get all context cards for a specific node (from or to)
   */
  async getContextCardsForNode(nodeId: string): Promise<ConnectionContextCard[]> {
    const cards: ConnectionContextCard[] = [];
    for (const card of this.contexts.values()) {
      if (card.fromNode === nodeId || card.toNode === nodeId) {
        cards.push(card);
      }
    }
    return cards;
  }

  /**
   * Get all outgoing context cards from a node
   */
  async getOutgoingContextCards(nodeId: string): Promise<ConnectionContextCard[]> {
    const cards: ConnectionContextCard[] = [];
    for (const card of this.contexts.values()) {
      if (card.fromNode === nodeId && card.enabled) {
        cards.push(card);
      }
    }
    return cards.sort((a, b) => b.priority - a.priority); // Sort by priority descending
  }

  /**
   * Get all context cards
   */
  async getAllContextCards(): Promise<ConnectionContextCard[]> {
    return Array.from(this.contexts.values());
  }

  /**
   * Delete a connection context card
   */
  async deleteContextCard(cardId: string): Promise<void> {
    this.contexts.delete(cardId);
    this.saveAll();
  }

  /**
   * Delete context cards for a connection (when connection is deleted)
   */
  async deleteContextCardsForConnection(connectionId: string): Promise<void> {
    const toDelete: string[] = [];
    for (const [id, card] of this.contexts.entries()) {
      if (card.connectionId === connectionId) {
        toDelete.push(id);
      }
    }
    toDelete.forEach(id => this.contexts.delete(id));
    if (toDelete.length > 0) {
      this.saveAll();
    }
  }

  /**
   * Create a default context card for a connection
   */
  createDefaultContextCard(connectionId: string, fromNode: string, toNode: string): ConnectionContextCard {
    const id = `context_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return {
      id,
      connectionId,
      name: `Connection ${fromNode} → ${toNode}`,
      fromNode,
      toNode,
      priority: 0,
      enabled: true,
      purpose: 'Handle caller request',
      whenToUse: 'Use this connection when appropriate based on caller intent',
      riskLevel: 'low',
      requiresConfirmation: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  /**
   * Link context cards to edges in a workflow
   * This ensures edges have references to their context cards
   */
  linkContextCardsToEdges(edges: Edge[]): AppConnection[] {
    return edges.map(edge => {
      const contextCard = Array.from(this.contexts.values()).find(
        card => card.connectionId === edge.id
      );
      
      return {
        ...edge,
        contextCardId: contextCard?.id,
        metadata: {
          ...edge.metadata,
          contextCardId: contextCard?.id,
        },
      } as AppConnection;
    });
  }

  /**
   * Initialize context cards for edges that don't have them
   */
  async initializeContextCardsForEdges(edges: Edge[]): Promise<void> {
    for (const edge of edges) {
      const existing = await this.getContextCardByConnectionId(edge.id);
      if (!existing) {
        const defaultCard = this.createDefaultContextCard(
          edge.id,
          edge.source,
          edge.target
        );
        await this.saveContextCard(defaultCard);
      }
    }
  }

  /**
   * Export all context cards (for backup/import)
   */
  async exportContextCards(): Promise<ConnectionContextCard[]> {
    return Array.from(this.contexts.values());
  }

  /**
   * Import context cards (for backup/import)
   */
  async importContextCards(cards: ConnectionContextCard[]): Promise<void> {
    for (const card of cards) {
      this.contexts.set(card.id, card);
    }
    this.saveAll();
  }

  /**
   * Clear all context cards (use with caution)
   */
  async clearAll(): Promise<void> {
    this.contexts.clear();
    this.saveAll();
  }
}

// Singleton instance
let storageInstance: ConnectionContextStorage | null = null;

/**
 * Get the singleton storage instance
 */
export function getConnectionContextStorage(): ConnectionContextStorage {
  if (!storageInstance) {
    storageInstance = new ConnectionContextStorage();
  }
  return storageInstance;
}

