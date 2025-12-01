/**
 * State Manager
 * 
 * Maintains conversation state and session data.
 * Supports ephemeral, session-based, and long-term storage options.
 */

import { ConversationContext, ConversationThread } from '../types';

/**
 * History entry for conversation tracking
 */
export interface HistoryEntry {
  role: 'caller' | 'agent' | 'system';
  content: string;
  timestamp: number;
  messageId?: string;
  metadata?: Record<string, any>;
}

/**
 * Session data structure
 */
/**
 * Session memory structure for storing important conversation data
 */
export interface SessionMemory {
  [key: string]: any; // Flexible structure for different types of data
  // Common patterns:
  // reservation?: ReservationData;
  // billing?: BillingData;
  // customer?: CustomerData;
}

export class Session {
  id: string;
  created_at: number;
  updated_at: number;
  expires_at: number;
  caller_id?: string;
  current_thread_id: string;
  history: HistoryEntry[];
  context: ConversationContext;
  metadata: Record<string, any>;
  sessionMemory: SessionMemory; // Temporary memory for current call
  pending_requests: Map<string, any>;
  private maxHistorySize: number;

  constructor(id: string, created_at: number, timeoutMs: number = SESSION_TIMEOUT, maxHistorySize: number = 50) {
    this.id = id;
    this.created_at = created_at;
    this.updated_at = created_at;
    this.expires_at = created_at + timeoutMs;
    this.caller_id = undefined;
    this.current_thread_id = generateThreadId();
    this.history = [];
    this.context = {
      threadId: this.current_thread_id,
      sessionId: id,
      metadata: {}
    };
    this.metadata = {
      userPreferences: {},
      accessLevel: 'standard',
      language: 'en',
      timezone: 'UTC'
    };
    this.sessionMemory = {}; // Initialize empty memory
    this.pending_requests = new Map();
    this.maxHistorySize = maxHistorySize;
  }

  isExpired(): boolean {
    return Date.now() > this.expires_at;
  }

  extend(duration: number = SESSION_TIMEOUT): void {
    this.expires_at = Date.now() + duration;
    this.updated_at = Date.now();
  }

  getRecentHistory(count: number = 5): HistoryEntry[] {
    return this.history.length > count 
      ? this.history.slice(-count) 
      : this.history;
  }

  addToHistory(entry: HistoryEntry): void {
    this.history.push(entry);
    // Limit history size (keep last N entries)
    if (this.history.length > this.maxHistorySize) {
      this.history = this.history.slice(-this.maxHistorySize);
    }
    this.updated_at = Date.now();
  }

  /**
   * Store data in session memory
   */
  storeInMemory(key: string, value: any): void {
    this.sessionMemory[key] = value;
    this.updated_at = Date.now();
  }

  /**
   * Retrieve data from session memory
   */
  getFromMemory(key: string): any {
    return this.sessionMemory[key];
  }

  /**
   * Check if memory has a specific key
   */
  hasInMemory(key: string): boolean {
    return key in this.sessionMemory && this.sessionMemory[key] !== undefined;
  }

  /**
   * Clear specific memory entry or all memory
   */
  clearMemory(key?: string): void {
    if (key) {
      delete this.sessionMemory[key];
    } else {
      this.sessionMemory = {};
    }
    this.updated_at = Date.now();
  }

  /**
   * Get all memory keys
   */
  getMemoryKeys(): string[] {
    return Object.keys(this.sessionMemory);
  }

  toJSON(): any {
    return {
      id: this.id,
      created_at: this.created_at,
      updated_at: this.updated_at,
      expires_at: this.expires_at,
      caller_id: this.caller_id,
      current_thread_id: this.current_thread_id,
      history: this.history,
      context: this.context,
      metadata: this.metadata,
      sessionMemory: this.sessionMemory
    };
  }

  static fromJSON(data: any): Session {
    const session = new Session(data.id, data.created_at);
    session.updated_at = data.updated_at;
    session.expires_at = data.expires_at;
    session.caller_id = data.caller_id;
    session.current_thread_id = data.current_thread_id;
    session.history = data.history || [];
    session.context = data.context || session.context;
    session.metadata = data.metadata || session.metadata;
    session.sessionMemory = data.sessionMemory || {};
    return session;
  }
}

/**
 * Storage interface for different persistence options
 */
export interface StorageInterface {
  isPersistent(): boolean;
  saveSession(session: Session): Promise<void>;
  loadSession(sessionId: string): Promise<Session | null>;
  updateSession(session: Session): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;
  listSessions(): Promise<string[]>;
}

/**
 * In-memory ephemeral storage
 */
class EphemeralStorage implements StorageInterface {
  private sessions: Map<string, Session> = new Map();

  isPersistent(): boolean {
    return false;
  }

  async saveSession(session: Session): Promise<void> {
    this.sessions.set(session.id, session);
  }

  async loadSession(sessionId: string): Promise<Session | null> {
    return this.sessions.get(sessionId) || null;
  }

  async updateSession(session: Session): Promise<void> {
    this.sessions.set(session.id, session);
  }

  async deleteSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }

  async listSessions(): Promise<string[]> {
    return Array.from(this.sessions.keys());
  }
}

/**
 * Session-based storage (temporary persistence)
 */
class SessionStorage implements StorageInterface {
  private sessions: Map<string, Session> = new Map();

  isPersistent(): boolean {
    return true; // Persisted for session duration
  }

  async saveSession(session: Session): Promise<void> {
    this.sessions.set(session.id, session);
    // Store in localStorage for browser persistence (encrypted)
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const sessionData = JSON.stringify(session.toJSON());
        // Encrypt session data before storing
        const { encryptData, isEncryptionSupported } = await import('./encryption');
        if (isEncryptionSupported()) {
          const encrypted = await encryptData(sessionData);
          localStorage.setItem(`session_${session.id}`, encrypted);
        } else {
          // Fallback to unencrypted if encryption not supported
          console.warn('Encryption not supported, storing unencrypted session data');
          localStorage.setItem(`session_${session.id}`, sessionData);
        }
      } catch (e) {
        console.warn('Failed to save session to localStorage:', e);
      }
    }
  }

  async loadSession(sessionId: string): Promise<Session | null> {
    // Check in-memory first
    if (this.sessions.has(sessionId)) {
      return this.sessions.get(sessionId)!;
    }

    // Try loading from localStorage
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const data = localStorage.getItem(`session_${sessionId}`);
        if (data) {
          let sessionData: string;
          
          // Try to decrypt (may be encrypted or unencrypted)
          const { decryptData, isEncryptionSupported } = await import('./encryption');
          if (isEncryptionSupported()) {
            try {
              sessionData = await decryptData(data);
            } catch (e) {
              // If decryption fails, try parsing as unencrypted JSON (backward compatibility)
              try {
                sessionData = data;
                JSON.parse(data); // Validate it's JSON
              } catch (parseError) {
                console.warn('Failed to decrypt or parse session data:', e);
                return null;
              }
            }
          } else {
            sessionData = data;
          }
          
          const session = Session.fromJSON(JSON.parse(sessionData));
          this.sessions.set(sessionId, session);
          return session;
        }
      } catch (e) {
        console.warn('Failed to load session from localStorage:', e);
      }
    }

    return null;
  }

  async updateSession(session: Session): Promise<void> {
    await this.saveSession(session);
  }

  async deleteSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.removeItem(`session_${sessionId}`);
      } catch (e) {
        console.warn('Failed to delete session from localStorage:', e);
      }
    }
  }

  async listSessions(): Promise<string[]> {
    return Array.from(this.sessions.keys());
  }
}

/**
 * Long-term storage interface (for database implementation)
 */
export interface LongTermStorage extends StorageInterface {
  // Additional methods for long-term storage
  querySessions(filter: { callerId?: string; startTime?: number; endTime?: number }): Promise<Session[]>;
  cleanupExpiredSessions(): Promise<number>;
}

/**
 * State Manager for conversation state and session data
 */
export class StateManager {
  private storage: StorageInterface;
  private sessions: Map<string, Session> = new Map();
  private storageType: 'ephemeral' | 'session' | 'long_term';
  private maxHistorySize: number;
  private sessionTimeoutMs: number;

  constructor(
    storageType: 'ephemeral' | 'session' | 'long_term' = 'session',
    options?: { maxHistorySize?: number; sessionTimeoutMs?: number }
  ) {
    this.storageType = storageType;
    this.maxHistorySize = options?.maxHistorySize ?? 50;
    this.sessionTimeoutMs = options?.sessionTimeoutMs ?? SESSION_TIMEOUT;
    this.storage = this.createStorage(storageType);
  }

  private createStorage(type: string): StorageInterface {
    switch (type) {
      case 'ephemeral':
        return new EphemeralStorage();
      case 'session':
        return new SessionStorage();
      case 'long_term':
        // For long-term storage, you would implement a database-backed storage
        // For now, fall back to session storage
        console.warn('Long-term storage not fully implemented, using session storage');
        return new SessionStorage();
      default:
        return new SessionStorage();
    }
  }

  /**
   * Get or create a session
   */
  async getOrCreateSession(sessionId: string): Promise<Session> {
    // Check in-memory cache first
    if (this.sessions.has(sessionId)) {
      const session = this.sessions.get(sessionId)!;
      if (session.isExpired()) {
        this.sessions.delete(sessionId);
        await this.storage.deleteSession(sessionId);
      } else {
        return session;
      }
    }

    // Try loading from storage
    const loadedSession = await this.storage.loadSession(sessionId);
    if (loadedSession) {
      if (loadedSession.isExpired()) {
        await this.storage.deleteSession(sessionId);
      } else {
        this.sessions.set(sessionId, loadedSession);
        return loadedSession;
      }
    }

    // Create new session
    const session = new Session(sessionId, Date.now(), this.sessionTimeoutMs, this.maxHistorySize);
    this.sessions.set(sessionId, session);

    // Persist if using persistent storage
    if (this.storage.isPersistent()) {
      await this.storage.saveSession(session);
    }

    return session;
  }

  /**
   * Update session with new information
   */
  async updateSession(sessionId: string, updates: Partial<Session>): Promise<void> {
    const session = await this.getOrCreateSession(sessionId);

    // Update session attributes
    Object.assign(session, updates);
    session.updated_at = Date.now();

    // Persist if using persistent storage
    if (this.storage.isPersistent()) {
      await this.storage.updateSession(session);
    }
  }

  /**
   * Add entry to conversation history
   */
  async addToHistory(sessionId: string, entry: HistoryEntry): Promise<void> {
    const session = await this.getOrCreateSession(sessionId);
    session.addToHistory(entry);

    // Persist if using persistent storage
    if (this.storage.isPersistent()) {
      await this.storage.updateSession(session);
    }
  }

  /**
   * Convenience helper used in unit tests to add a single message to history.
   */
  async addMessageToHistory(
    sessionId: string,
    role: HistoryEntry['role'],
    content: string,
    messageId?: string
  ): Promise<void> {
    await this.addToHistory(sessionId, {
      role,
      content,
      timestamp: Date.now(),
      messageId
    });
  }

  /**
   * Get the full conversation history for a session.
   */
  async getSessionHistory(sessionId: string): Promise<HistoryEntry[]> {
    const session = await this.getOrCreateSession(sessionId);
    return session.history;
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<Session | null> {
    return await this.getOrCreateSession(sessionId);
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
    await this.storage.deleteSession(sessionId);
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    let cleaned = 0;
    const now = Date.now();

    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.isExpired()) {
        await this.deleteSession(sessionId);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): Session[] {
    return Array.from(this.sessions.values()).filter(s => !s.isExpired());
  }

  /**
   * Store data in session memory
   */
  async storeInSessionMemory(sessionId: string, key: string, value: any): Promise<void> {
    const session = await this.getOrCreateSession(sessionId);
    session.storeInMemory(key, value);
    
    // Persist if using persistent storage
    if (this.storage.isPersistent()) {
      await this.storage.updateSession(session);
    }
  }

  /**
   * Retrieve data from session memory
   */
  async getFromSessionMemory(sessionId: string, key: string): Promise<any> {
    const session = await this.getOrCreateSession(sessionId);
    return session.getFromMemory(key);
  }

  /**
   * Check if session memory has a specific key
   */
  async hasInSessionMemory(sessionId: string, key: string): Promise<boolean> {
    const session = await this.getOrCreateSession(sessionId);
    return session.hasInMemory(key);
  }

  /**
   * Clear session memory (all or specific key)
   */
  async clearSessionMemory(sessionId: string, key?: string): Promise<void> {
    const session = await this.getOrCreateSession(sessionId);
    session.clearMemory(key);
    
    // Persist if using persistent storage
    if (this.storage.isPersistent()) {
      await this.storage.updateSession(session);
    }
  }

  /**
   * Get all memory keys for a session
   */
  async getSessionMemoryKeys(sessionId: string): Promise<string[]> {
    const session = await this.getOrCreateSession(sessionId);
    return session.getMemoryKeys();
  }
}

// Constants
const SESSION_TIMEOUT = 3600000; // 1 hour in milliseconds

/**
 * Generate a unique thread ID
 */
function generateThreadId(): string {
  return `thread_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

