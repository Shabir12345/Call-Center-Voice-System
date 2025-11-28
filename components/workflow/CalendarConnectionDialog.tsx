/**
 * Calendar Connection Dialog
 * 
 * UI component for connecting calendars via OAuth flow
 */

import React, { useState, useEffect } from 'react';
import { CalendarProvider, CalendarConnection, OAuthConfig } from '../../types/calendarTypes';
import { OAuthHandler } from '../../utils/calendar/oauthHandler';
import { CalendarService } from '../../utils/calendar/calendarService';
import { X, Calendar, Check, AlertCircle, Loader } from 'lucide-react';

interface CalendarConnectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (connection: CalendarConnection) => void;
  existingConnections?: CalendarConnection[];
}

export const CalendarConnectionDialog: React.FC<CalendarConnectionDialogProps> = ({
  isOpen,
  onClose,
  onConnect,
  existingConnections = []
}) => {
  const [selectedProvider, setSelectedProvider] = useState<CalendarProvider | null>(null);
  const [oauthConfig, setOAuthConfig] = useState<Partial<OAuthConfig>>({});
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'select' | 'config' | 'oauth'>('select');

  const oauthHandler = new OAuthHandler();
  const calendarService = new CalendarService(oauthHandler);

  useEffect(() => {
    if (!isOpen) {
      setStep('select');
      setSelectedProvider(null);
      setOAuthConfig({});
      setError(null);
    }
  }, [isOpen]);

  const handleProviderSelect = (provider: CalendarProvider) => {
    setSelectedProvider(provider);
    setStep('config');
    setError(null);
    
    // Set default scopes based on provider
    const defaultScopes = {
      google: [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events'
      ],
      outlook: [
        'Calendars.ReadWrite',
        'offline_access'
      ],
      apple: [
        'calendars.read',
        'calendars.write'
      ]
    };

    setOAuthConfig({
      scopes: defaultScopes[provider],
      redirectUri: window.location.origin + '/oauth/callback'
    });
  };

  const handleOAuthConfigChange = (field: keyof OAuthConfig, value: string) => {
    setOAuthConfig(prev => ({
      ...prev,
      [field]: field === 'scopes' ? value.split(',').map(s => s.trim()) : value
    }));
  };

  const handleStartOAuth = async () => {
    if (!selectedProvider || !oauthConfig.clientId || !oauthConfig.clientSecret || !oauthConfig.redirectUri) {
      setError('Please fill in all OAuth configuration fields');
      return;
    }

    setConnecting(true);
    setError(null);

    try {
      const state = `calendar-${selectedProvider}-${Date.now()}`;
      const authUrl = oauthHandler.generateAuthUrl(
        selectedProvider,
        oauthConfig as OAuthConfig,
        state
      );

      // Store OAuth config temporarily for callback
      sessionStorage.setItem(`oauth_config_${state}`, JSON.stringify({
        provider: selectedProvider,
        config: oauthConfig
      }));

      // Open OAuth window
      const width = 600;
      const height = 700;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;

      const oauthWindow = window.open(
        authUrl,
        'Calendar OAuth',
        `width=${width},height=${height},left=${left},top=${top}`
      );

      // Listen for OAuth callback
      const checkOAuth = setInterval(() => {
        try {
          if (oauthWindow?.closed) {
            clearInterval(checkOAuth);
            setConnecting(false);
            return;
          }

          // Check if we have the authorization code (this would typically come from a callback URL)
          // For now, we'll simulate the flow
        } catch (e) {
          // Cross-origin, can't access
        }
      }, 1000);

    } catch (err: any) {
      setError(err.message || 'Failed to start OAuth flow');
      setConnecting(false);
    }
  };

  const handleManualConnection = async () => {
    // For Apple Calendar, we can use manual connection with app-specific password
    if (selectedProvider === 'apple') {
      // This would be handled differently - show form for CalDAV credentials
      setStep('oauth');
    } else {
      setError('Manual connection only supported for Apple Calendar. Please use OAuth for Google and Outlook.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <Calendar className="text-blue-600" size={24} />
            <h2 className="text-xl font-bold text-gray-800">Connect Calendar</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {step === 'select' && (
            <div className="space-y-4">
              <p className="text-gray-600 mb-4">Select a calendar provider to connect:</p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {(['google', 'outlook', 'apple'] as CalendarProvider[]).map(provider => {
                  const isConnected = existingConnections.some(c => c.provider === provider);
                  
                  return (
                    <button
                      key={provider}
                      onClick={() => handleProviderSelect(provider)}
                      disabled={isConnected}
                      className={`p-4 border-2 rounded-lg text-left transition-all ${
                        isConnected
                          ? 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed'
                          : 'border-gray-200 hover:border-blue-400 hover:shadow-md cursor-pointer'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-gray-800 capitalize">{provider}</span>
                        {isConnected && <Check className="text-green-600" size={16} />}
                      </div>
                      <p className="text-xs text-gray-500">
                        {provider === 'google' && 'Google Calendar'}
                        {provider === 'outlook' && 'Microsoft Outlook'}
                        {provider === 'apple' && 'Apple Calendar (iCloud)'}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 'config' && selectedProvider && (
            <div className="space-y-4">
              <button
                onClick={() => setStep('select')}
                className="text-sm text-blue-600 hover:text-blue-800 mb-4"
              >
                ← Back to provider selection
              </button>

              <h3 className="font-semibold text-gray-800 mb-4">
                Configure {selectedProvider === 'google' ? 'Google' : selectedProvider === 'outlook' ? 'Outlook' : 'Apple'} Calendar
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Client ID
                  </label>
                  <input
                    type="text"
                    value={oauthConfig.clientId || ''}
                    onChange={(e) => handleOAuthConfigChange('clientId', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter OAuth Client ID"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Client Secret
                  </label>
                  <input
                    type="password"
                    value={oauthConfig.clientSecret || ''}
                    onChange={(e) => handleOAuthConfigChange('clientSecret', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter OAuth Client Secret"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Redirect URI
                  </label>
                  <input
                    type="text"
                    value={oauthConfig.redirectUri || ''}
                    onChange={(e) => handleOAuthConfigChange('redirectUri', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="https://your-app.com/oauth/callback"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Must match the redirect URI configured in your OAuth app
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Scopes (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={oauthConfig.scopes?.join(', ') || ''}
                    onChange={(e) => handleOAuthConfigChange('scopes', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="calendar, calendar.events"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={handleStartOAuth}
                    disabled={connecting || !oauthConfig.clientId || !oauthConfig.clientSecret}
                    className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {connecting ? (
                      <>
                        <Loader className="animate-spin" size={16} />
                        Connecting...
                      </>
                    ) : (
                      'Connect via OAuth'
                    )}
                  </button>

                  {selectedProvider === 'apple' && (
                    <button
                      onClick={handleManualConnection}
                      className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Manual Setup
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {step === 'oauth' && selectedProvider === 'apple' && (
            <div className="space-y-4">
              <button
                onClick={() => setStep('config')}
                className="text-sm text-blue-600 hover:text-blue-800 mb-4"
              >
                ← Back
              </button>

              <h3 className="font-semibold text-gray-800 mb-4">Apple Calendar Manual Setup</h3>
              <p className="text-sm text-gray-600 mb-4">
                For Apple Calendar, you can use CalDAV with an app-specific password.
                Generate an app-specific password in your Apple ID settings.
              </p>

              {/* CalDAV configuration form would go here */}
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  Apple Calendar CalDAV setup requires server URL, username, and app-specific password.
                  This feature is coming soon.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

