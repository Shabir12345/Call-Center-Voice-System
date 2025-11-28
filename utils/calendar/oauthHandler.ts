/**
 * OAuth 2.0 Handler
 * 
 * Manages OAuth flows for Google, Microsoft, and Apple calendar providers
 */

import {
  CalendarProvider,
  OAuthTokens,
  OAuthConfig,
  CalendarConnection
} from '../../types/calendarTypes';
import { encryptData, decryptData } from '../encryption';

/**
 * OAuth handler for calendar providers
 */
export class OAuthHandler {
  private storageKey = 'calendar_connections';
  private encryptionKey: string;

  constructor(encryptionKey?: string) {
    // Use provided key or generate a default (in production, this should come from secure config)
    this.encryptionKey = encryptionKey || 'default-encryption-key-change-in-production';
  }

  /**
   * Generate OAuth authorization URL for provider
   */
  generateAuthUrl(
    provider: CalendarProvider,
    config: OAuthConfig,
    state?: string
  ): string {
    const stateParam = state || this.generateState();
    
    switch (provider) {
      case 'google':
        return this.generateGoogleAuthUrl(config, stateParam);
      case 'outlook':
        return this.generateOutlookAuthUrl(config, stateParam);
      case 'apple':
        return this.generateAppleAuthUrl(config, stateParam);
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(
    provider: CalendarProvider,
    config: OAuthConfig,
    code: string,
    state?: string
  ): Promise<OAuthTokens> {
    switch (provider) {
      case 'google':
        return this.exchangeGoogleCode(code, config);
      case 'outlook':
        return this.exchangeOutlookCode(code, config);
      case 'apple':
        return this.exchangeAppleCode(code, config);
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(
    provider: CalendarProvider,
    config: OAuthConfig,
    refreshToken: string
  ): Promise<OAuthTokens> {
    switch (provider) {
      case 'google':
        return this.refreshGoogleToken(refreshToken, config);
      case 'outlook':
        return this.refreshOutlookToken(refreshToken, config);
      case 'apple':
        return this.refreshAppleToken(refreshToken, config);
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  /**
   * Store calendar connection securely
   */
  async storeConnection(connection: CalendarConnection): Promise<void> {
    try {
      const connections = await this.getStoredConnections();
      const index = connections.findIndex(c => c.id === connection.id);
      
      if (index >= 0) {
        connections[index] = connection;
      } else {
        connections.push(connection);
      }

      // Encrypt tokens before storage
      const encryptedConnections = await Promise.all(
        connections.map(async conn => ({
          ...conn,
          tokens: {
            ...conn.tokens,
            accessToken: await encryptData(conn.tokens.accessToken),
            refreshToken: conn.tokens.refreshToken 
              ? await encryptData(conn.tokens.refreshToken)
              : undefined
          }
        }))
      );

      // Store in localStorage (in production, use secure backend storage)
      localStorage.setItem(this.storageKey, JSON.stringify(encryptedConnections));
    } catch (error) {
      throw new Error(`Failed to store connection: ${error}`);
    }
  }

  /**
   * Retrieve calendar connection
   */
  async getConnection(connectionId: string): Promise<CalendarConnection | null> {
    try {
      const connections = await this.getStoredConnections();
      const connection = connections.find(c => c.id === connectionId);
      
      if (!connection) {
        return null;
      }

      // Decrypt tokens
      return {
        ...connection,
        tokens: {
          ...connection.tokens,
          accessToken: await decryptData(connection.tokens.accessToken),
          refreshToken: connection.tokens.refreshToken
            ? await decryptData(connection.tokens.refreshToken)
            : undefined
        }
      };
    } catch (error) {
      throw new Error(`Failed to retrieve connection: ${error}`);
    }
  }

  /**
   * Get all stored connections
   */
  async getAllConnections(): Promise<CalendarConnection[]> {
    return await this.getStoredConnections();
  }

  /**
   * Delete calendar connection
   */
  async deleteConnection(connectionId: string): Promise<void> {
    try {
      const connections = await this.getStoredConnections();
      const filtered = connections.filter(c => c.id !== connectionId);
      localStorage.setItem(this.storageKey, JSON.stringify(filtered));
    } catch (error) {
      throw new Error(`Failed to delete connection: ${error}`);
    }
  }

  /**
   * Check if token is expired
   */
  isTokenExpired(tokens: OAuthTokens): boolean {
    if (!tokens.expiresAt) {
      return false; // No expiration set
    }
    // Refresh 5 minutes before expiration
    return Date.now() >= (tokens.expiresAt - 5 * 60 * 1000);
  }

  // Private methods for Google OAuth

  private generateGoogleAuthUrl(config: OAuthConfig, state: string): string {
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: config.scopes.join(' '),
      access_type: 'offline', // Required to get refresh token
      prompt: 'consent', // Force consent to get refresh token
      state: state
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  private async exchangeGoogleCode(code: string, config: OAuthConfig): Promise<OAuthTokens> {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: config.redirectUri
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Token exchange failed: ${error.error_description || error.error}`);
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_in ? Date.now() + (data.expires_in * 1000) : undefined,
      tokenType: data.token_type,
      scope: data.scope ? data.scope.split(' ') : config.scopes
    };
  }

  private async refreshGoogleToken(refreshToken: string, config: OAuthConfig): Promise<OAuthTokens> {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Token refresh failed: ${error.error_description || error.error}`);
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken, // Keep old refresh token if not provided
      expiresAt: data.expires_in ? Date.now() + (data.expires_in * 1000) : undefined,
      tokenType: data.token_type,
      scope: data.scope ? data.scope.split(' ') : config.scopes
    };
  }

  // Private methods for Microsoft Outlook OAuth

  private generateOutlookAuthUrl(config: OAuthConfig, state: string): string {
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: config.scopes.join(' '),
      response_mode: 'query',
      state: state
    });

    return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;
  }

  private async exchangeOutlookCode(code: string, config: OAuthConfig): Promise<OAuthTokens> {
    const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: config.redirectUri,
        scope: config.scopes.join(' ')
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Token exchange failed: ${error.error_description || error.error}`);
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_in ? Date.now() + (data.expires_in * 1000) : undefined,
      tokenType: data.token_type,
      scope: data.scope ? data.scope.split(' ') : config.scopes
    };
  }

  private async refreshOutlookToken(refreshToken: string, config: OAuthConfig): Promise<OAuthTokens> {
    const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
        scope: config.scopes.join(' ')
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Token refresh failed: ${error.error_description || error.error}`);
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken,
      expiresAt: data.expires_in ? Date.now() + (data.expires_in * 1000) : undefined,
      tokenType: data.token_type,
      scope: data.scope ? data.scope.split(' ') : config.scopes
    };
  }

  // Private methods for Apple Calendar OAuth (CalDAV)

  private generateAppleAuthUrl(config: OAuthConfig, state: string): string {
    // Apple uses different OAuth flow - typically requires server-side handling
    // For CalDAV, authentication is usually done via HTTP Basic Auth or OAuth 2.0
    // This is a simplified version - in production, you may need server-side proxy
    
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: config.scopes.join(' '),
      state: state
    });

    // Apple's OAuth endpoint (this may vary based on your Apple Developer setup)
    return `https://appleid.apple.com/auth/authorize?${params.toString()}`;
  }

  private async exchangeAppleCode(code: string, config: OAuthConfig): Promise<OAuthTokens> {
    // Apple OAuth token exchange
    // Note: Apple Calendar (iCloud) typically uses CalDAV with HTTP Basic Auth
    // or app-specific passwords. OAuth 2.0 for iCloud requires special setup.
    
    // For now, return a structure that can be used with CalDAV
    // In production, you may need to implement server-side token exchange
    throw new Error('Apple Calendar OAuth requires server-side implementation. Consider using app-specific passwords for CalDAV.');
  }

  private async refreshAppleToken(refreshToken: string, config: OAuthConfig): Promise<OAuthTokens> {
    // Similar to exchangeAppleCode - requires server-side implementation
    throw new Error('Apple Calendar token refresh requires server-side implementation.');
  }

  // Helper methods

  private async getStoredConnections(): Promise<CalendarConnection[]> {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (!stored) {
        return [];
      }

      const encryptedConnections: CalendarConnection[] = JSON.parse(stored);
      
      // Decrypt tokens
      return await Promise.all(
        encryptedConnections.map(async conn => ({
          ...conn,
          tokens: {
            ...conn.tokens,
            accessToken: await decryptData(conn.tokens.accessToken),
            refreshToken: conn.tokens.refreshToken
              ? await decryptData(conn.tokens.refreshToken)
              : undefined
          }
        }))
      );
    } catch (error) {
      console.error('Failed to get stored connections:', error);
      return [];
    }
  }

  private generateState(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }
}

