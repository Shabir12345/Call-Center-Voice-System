/**
 * Unit tests for User Profile
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { UserProfile, UserProfileManager, UserPreferences } from '../../utils/userProfile';
import { ConversationContext } from '../../types';

describe('UserProfile', () => {
  let profile: UserProfile;

  beforeEach(() => {
    profile = new UserProfile('user_123');
  });

  describe('Constructor', () => {
    it('should create profile with default preferences', () => {
      expect(profile.userId).toBe('user_123');
      expect(profile.preferences.voice?.speed).toBe(1.0);
      expect(profile.preferences.communication?.style).toBe('standard');
      expect(profile.preferences.access?.level).toBe('standard');
    });

    it('should create profile with custom preferences', () => {
      const customPrefs: UserPreferences = {
        voice: {
          speed: 1.5,
          language: 'es'
        },
        access: {
          level: 'premium'
        }
      };
      const customProfile = new UserProfile('user_456', customPrefs);
      expect(customProfile.preferences.voice?.speed).toBe(1.5);
      expect(customProfile.preferences.voice?.language).toBe('es');
      expect(customProfile.preferences.access?.level).toBe('premium');
    });

    it('should set createdAt and updatedAt timestamps', () => {
      const before = Date.now();
      const newProfile = new UserProfile('user_new');
      const after = Date.now();

      expect(newProfile.createdAt).toBeGreaterThanOrEqual(before);
      expect(newProfile.createdAt).toBeLessThanOrEqual(after);
      expect(newProfile.updatedAt).toBe(newProfile.createdAt);
    });
  });

  describe('applyToContext', () => {
    it('should apply preferences to conversation context', () => {
      const context: ConversationContext = {
        threadId: 'thread_1',
        sessionId: 'session_1',
        metadata: {}
      };

      const updatedContext = profile.applyToContext(context);

      expect(updatedContext.metadata?.userPreferences).toEqual(profile.preferences);
      expect(updatedContext.metadata?.accessLevel).toBe('standard');
      expect(updatedContext.metadata?.language).toBe('en');
    });

    it('should create metadata object if it does not exist', () => {
      const context: ConversationContext = {
        threadId: 'thread_1',
        sessionId: 'session_1'
      };

      const updatedContext = profile.applyToContext(context);

      expect(updatedContext.metadata).toBeDefined();
      expect(updatedContext.metadata?.userPreferences).toBeDefined();
    });

    it('should merge with existing metadata', () => {
      const context: ConversationContext = {
        threadId: 'thread_1',
        sessionId: 'session_1',
        metadata: {
          existingKey: 'existingValue'
        }
      };

      const updatedContext = profile.applyToContext(context);

      expect(updatedContext.metadata?.existingKey).toBe('existingValue');
      expect(updatedContext.metadata?.userPreferences).toBeDefined();
    });
  });

  describe('updatePreferences', () => {
    it('should update preferences', () => {
      const updates: Partial<UserPreferences> = {
        voice: {
          speed: 1.5
        }
      };

      profile.updatePreferences(updates);

      expect(profile.preferences.voice?.speed).toBe(1.5);
      expect(profile.preferences.voice?.language).toBe('en'); // Should preserve existing
      expect(profile.updatedAt).toBeGreaterThan(profile.createdAt);
    });

    it('should merge nested preferences', () => {
      profile.updatePreferences({
        communication: {
          style: 'detailed'
        }
      });

      expect(profile.preferences.communication?.style).toBe('detailed');
      expect(profile.preferences.communication?.detailLevel).toBe('standard'); // Preserved
    });

    it('should update multiple preference categories', () => {
      profile.updatePreferences({
        voice: { speed: 1.2 },
        access: { level: 'premium' }
      });

      expect(profile.preferences.voice?.speed).toBe(1.2);
      expect(profile.preferences.access?.level).toBe('premium');
    });
  });

  describe('getPreference', () => {
    it('should get preference by path', () => {
      const speed = profile.getPreference<number>('voice.speed');
      expect(speed).toBe(1.0);
    });

    it('should get nested preference', () => {
      const level = profile.getPreference<string>('access.level');
      expect(level).toBe('standard');
    });

    it('should return undefined for non-existent path', () => {
      const value = profile.getPreference<string>('nonexistent.path');
      expect(value).toBeUndefined();
    });

    it('should return undefined for invalid path', () => {
      const value = profile.getPreference<string>('voice.invalid');
      expect(value).toBeUndefined();
    });
  });

  describe('hasPermission', () => {
    it('should return true for admin users', () => {
      profile.updatePreferences({
        access: {
          level: 'admin'
        }
      });

      expect(profile.hasPermission('any_permission')).toBe(true);
    });

    it('should return true if user has specific permission', () => {
      profile.updatePreferences({
        access: {
          level: 'standard',
          permissions: ['read_data', 'write_data']
        }
      });

      expect(profile.hasPermission('read_data')).toBe(true);
      expect(profile.hasPermission('write_data')).toBe(true);
    });

    it('should return false if user does not have permission', () => {
      profile.updatePreferences({
        access: {
          level: 'standard',
          permissions: ['read_data']
        }
      });

      expect(profile.hasPermission('admin_action')).toBe(false);
    });
  });

  describe('hasAccessLevel', () => {
    it('should return true for equal or higher access level', () => {
      profile.updatePreferences({
        access: {
          level: 'premium'
        }
      });

      expect(profile.hasAccessLevel('standard')).toBe(true);
      expect(profile.hasAccessLevel('premium')).toBe(true);
      expect(profile.hasAccessLevel('admin')).toBe(false);
    });

    it('should handle standard level correctly', () => {
      expect(profile.hasAccessLevel('standard')).toBe(true);
      expect(profile.hasAccessLevel('premium')).toBe(false);
    });
  });

  describe('getCommunicationStyle', () => {
    it('should return default communication style', () => {
      expect(profile.getCommunicationStyle()).toBe('standard');
    });

    it('should return custom communication style', () => {
      profile.updatePreferences({
        communication: {
          style: 'concise'
        }
      });

      expect(profile.getCommunicationStyle()).toBe('concise');
    });
  });

  describe('getVoiceSettings', () => {
    it('should return default voice settings', () => {
      const settings = profile.getVoiceSettings();

      expect(settings.speed).toBe(1.0);
      expect(settings.tone).toBe('professional');
      expect(settings.language).toBe('en');
    });

    it('should return custom voice settings', () => {
      profile.updatePreferences({
        voice: {
          speed: 1.5,
          tone: 'friendly',
          language: 'es'
        }
      });

      const settings = profile.getVoiceSettings();
      expect(settings.speed).toBe(1.5);
      expect(settings.tone).toBe('friendly');
      expect(settings.language).toBe('es');
    });
  });

  describe('toJSON', () => {
    it('should serialize profile to JSON', () => {
      const json = profile.toJSON();

      expect(json.userId).toBe('user_123');
      expect(json.preferences).toBeDefined();
      expect(json.createdAt).toBeDefined();
      expect(json.updatedAt).toBeDefined();
    });
  });

  describe('fromJSON', () => {
    it('should deserialize profile from JSON', () => {
      const json = profile.toJSON();
      const restored = UserProfile.fromJSON(json);

      expect(restored.userId).toBe(profile.userId);
      expect(restored.preferences).toEqual(profile.preferences);
      expect(restored.createdAt).toBe(profile.createdAt);
      expect(restored.updatedAt).toBe(profile.updatedAt);
    });

    it('should handle missing timestamps', () => {
      const json = {
        userId: 'user_789',
        preferences: {}
      };

      const restored = UserProfile.fromJSON(json);

      expect(restored.userId).toBe('user_789');
      expect(restored.createdAt).toBeDefined();
      expect(restored.updatedAt).toBeDefined();
    });
  });
});

describe('UserProfileManager', () => {
  let manager: UserProfileManager;

  beforeEach(() => {
    manager = new UserProfileManager();
  });

  describe('getOrCreateProfile', () => {
    it('should create new profile if not exists', async () => {
      const profile = await manager.getOrCreateProfile('user_new');

      expect(profile).toBeDefined();
      expect(profile.userId).toBe('user_new');
    });

    it('should return existing profile from cache', async () => {
      const profile1 = await manager.getOrCreateProfile('user_cached');
      const profile2 = await manager.getOrCreateProfile('user_cached');

      expect(profile1).toBe(profile2);
    });

    it('should load profile from storage if provided', async () => {
      const savedProfile = new UserProfile('user_storage', {
        voice: { speed: 1.5 }
      });

      const storage = {
        load: async (userId: string) => {
          if (userId === 'user_storage') {
            return savedProfile;
          }
          return null;
        },
        save: async (profile: UserProfile) => {
          // Mock save
        }
      };

      const managerWithStorage = new UserProfileManager(storage);
      const profile = await managerWithStorage.getOrCreateProfile('user_storage');

      expect(profile.preferences.voice?.speed).toBe(1.5);
    });

    it('should create new profile if not in storage', async () => {
      const storage = {
        load: async () => null,
        save: async (profile: UserProfile) => {
          // Mock save
        }
      };

      const managerWithStorage = new UserProfileManager(storage);
      const profile = await managerWithStorage.getOrCreateProfile('user_new');

      expect(profile).toBeDefined();
      expect(profile.userId).toBe('user_new');
    });
  });

  describe('updateProfile', () => {
    it('should update existing profile', async () => {
      await manager.getOrCreateProfile('user_update');
      await manager.updateProfile('user_update', {
        voice: { speed: 1.5 }
      });

      const profile = manager.getProfile('user_update');
      expect(profile?.preferences.voice?.speed).toBe(1.5);
    });

    it('should create profile if updating non-existent profile', async () => {
      await manager.updateProfile('user_new_update', {
        access: { level: 'premium' }
      });

      const profile = manager.getProfile('user_new_update');
      expect(profile?.preferences.access?.level).toBe('premium');
    });
  });

  describe('getProfile', () => {
    it('should return profile if exists', async () => {
      await manager.getOrCreateProfile('user_get');
      const profile = manager.getProfile('user_get');

      expect(profile).toBeDefined();
      expect(profile?.userId).toBe('user_get');
    });

    it('should return null if profile does not exist', () => {
      const profile = manager.getProfile('user_nonexistent');
      expect(profile).toBeNull();
    });
  });
});

