/**
 * User Profile
 * 
 * Manages user-specific customization including preferences,
 * access levels, and personalization settings.
 */

import { ConversationContext } from '../types';

/**
 * User preferences structure
 */
export interface UserPreferences {
  voice?: {
    speed?: number;
    tone?: string;
    language?: string;
  };
  communication?: {
    style?: 'concise' | 'detailed' | 'standard';
    detailLevel?: 'minimal' | 'standard' | 'comprehensive';
  };
  access?: {
    level?: 'standard' | 'premium' | 'admin';
    permissions?: string[];
  };
  notifications?: {
    enabled?: boolean;
    channels?: string[];
  };
}

/**
 * User Profile class
 */
export class UserProfile {
  userId: string;
  preferences: UserPreferences;
  createdAt: number;
  updatedAt: number;

  constructor(userId: string, preferences?: UserPreferences) {
    this.userId = userId;
    this.preferences = preferences || this.getDefaultPreferences();
    this.createdAt = Date.now();
    this.updatedAt = Date.now();
  }

  /**
   * Get default preferences
   */
  private getDefaultPreferences(): UserPreferences {
    return {
      voice: {
        speed: 1.0,
        tone: 'professional',
        language: 'en'
      },
      communication: {
        style: 'standard',
        detailLevel: 'standard'
      },
      access: {
        level: 'standard',
        permissions: []
      },
      notifications: {
        enabled: true,
        channels: []
      }
    };
  }

  /**
   * Apply preferences to conversation context
   */
  applyToContext(context: ConversationContext): ConversationContext {
    if (!context.metadata) {
      context.metadata = {};
    }

    context.metadata.userPreferences = this.preferences;
    context.metadata.accessLevel = this.preferences.access?.level || 'standard';
    context.metadata.language = this.preferences.voice?.language || 'en';

    return context;
  }

  /**
   * Update preferences
   */
  updatePreferences(updates: Partial<UserPreferences>): void {
    this.preferences = {
      ...this.preferences,
      ...updates,
      voice: {
        ...this.preferences.voice,
        ...updates.voice
      },
      communication: {
        ...this.preferences.communication,
        ...updates.communication
      },
      access: {
        ...this.preferences.access,
        ...updates.access
      },
      notifications: {
        ...this.preferences.notifications,
        ...updates.notifications
      }
    };
    this.updatedAt = Date.now();
  }

  /**
   * Get preference value
   */
  getPreference<T>(path: string): T | undefined {
    const keys = path.split('.');
    let value: any = this.preferences;

    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return undefined;
      }
    }

    return value as T;
  }

  /**
   * Check if user has permission
   */
  hasPermission(permission: string): boolean {
    const permissions = this.preferences.access?.permissions || [];
    return permissions.includes(permission) || 
           this.preferences.access?.level === 'admin';
  }

  /**
   * Check if user has access level
   */
  hasAccessLevel(level: string): boolean {
    const userLevel = this.preferences.access?.level || 'standard';
    const levels = ['standard', 'premium', 'admin'];
    const userLevelIndex = levels.indexOf(userLevel);
    const requiredLevelIndex = levels.indexOf(level);
    return userLevelIndex >= requiredLevelIndex;
  }

  /**
   * Get communication style
   */
  getCommunicationStyle(): 'concise' | 'detailed' | 'standard' {
    return this.preferences.communication?.style || 'standard';
  }

  /**
   * Get voice settings
   */
  getVoiceSettings(): {
    speed: number;
    tone: string;
    language: string;
  } {
    return {
      speed: this.preferences.voice?.speed || 1.0,
      tone: this.preferences.voice?.tone || 'professional',
      language: this.preferences.voice?.language || 'en'
    };
  }

  /**
   * Convert to JSON
   */
  toJSON(): any {
    return {
      userId: this.userId,
      preferences: this.preferences,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  /**
   * Create from JSON
   */
  static fromJSON(data: any): UserProfile {
    const profile = new UserProfile(data.userId, data.preferences);
    profile.createdAt = data.createdAt || Date.now();
    profile.updatedAt = data.updatedAt || Date.now();
    return profile;
  }
}

/**
 * User Profile Manager
 */
export class UserProfileManager {
  private profiles: Map<string, UserProfile> = new Map();
  private storage?: {
    load: (userId: string) => Promise<UserProfile | null>;
    save: (profile: UserProfile) => Promise<void>;
  };

  constructor(storage?: {
    load: (userId: string) => Promise<UserProfile | null>;
    save: (profile: UserProfile) => Promise<void>;
  }) {
    this.storage = storage;
  }

  /**
   * Get or create user profile
   */
  async getOrCreateProfile(userId: string): Promise<UserProfile> {
    // Check cache
    if (this.profiles.has(userId)) {
      return this.profiles.get(userId)!;
    }

    // Try loading from storage
    if (this.storage) {
      const profile = await this.storage.load(userId);
      if (profile) {
        this.profiles.set(userId, profile);
        return profile;
      }
    }

    // Create new profile
    const profile = new UserProfile(userId);
    this.profiles.set(userId, profile);

    // Save to storage
    if (this.storage) {
      await this.storage.save(profile);
    }

    return profile;
  }

  /**
   * Update user profile
   */
  async updateProfile(userId: string, updates: Partial<UserPreferences>): Promise<void> {
    const profile = await this.getOrCreateProfile(userId);
    profile.updatePreferences(updates);

    // Save to storage
    if (this.storage) {
      await this.storage.save(profile);
    }
  }

  /**
   * Get user profile
   */
  getProfile(userId: string): UserProfile | null {
    return this.profiles.get(userId) || null;
  }
}

