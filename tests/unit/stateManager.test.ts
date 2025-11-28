/**
 * Unit tests for State Manager
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { StateManager } from '../../utils/stateManager';

describe('StateManager', () => {
  let stateManager: StateManager;

  beforeEach(() => {
    stateManager = new StateManager('ephemeral');
  });

  describe('Session Management', () => {
    it('should create a new session', async () => {
      const session = await stateManager.getOrCreateSession('session_123');
      
      expect(session).toBeDefined();
      expect(session.id).toBe('session_123');
      expect(session.history).toEqual([]);
    });

    it('should retrieve existing session', async () => {
      const session1 = await stateManager.getOrCreateSession('session_123');
      const session2 = await stateManager.getOrCreateSession('session_123');
      
      expect(session1.id).toBe(session2.id);
    });

    it('should add message to history', async () => {
      await stateManager.addMessageToHistory(
        'session_123',
        'user',
        'Hello',
        'msg_1'
      );

      const history = await stateManager.getSessionHistory('session_123');
      expect(history.length).toBe(1);
      expect(history[0].content).toBe('Hello');
      expect(history[0].role).toBe('user');
    });

    it('should limit history size', async () => {
      const stateManagerWithLimit = new StateManager('ephemeral', {
        maxHistorySize: 3
      });

      for (let i = 0; i < 5; i++) {
        await stateManagerWithLimit.addMessageToHistory(
          'session_123',
          'user',
          `Message ${i}`
        );
      }

      const history = await stateManagerWithLimit.getSessionHistory('session_123');
      expect(history.length).toBe(3);
      expect(history[0].content).toBe('Message 2');
    });
  });

  describe('Session Expiration', () => {
    it('should handle expired sessions', async () => {
      const shortTimeoutManager = new StateManager('ephemeral', {
        sessionTimeoutMs: 100 // 100ms timeout
      });

      const session = await shortTimeoutManager.getOrCreateSession('session_123');
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(session.isExpired()).toBe(true);
    });
  });
});

