/**
 * Phone provider configuration
 */

import { PhoneProvider, PhoneProviderConfig } from '../types/callTypes.js';

export interface PhoneProviderSettings {
  provider: PhoneProvider;
  twilio?: {
    accountSid: string;
    authToken: string;
    phoneNumber: string;
  };
  telnyx?: {
    apiKey: string;
    phoneNumber: string;
  };
  webhookBaseUrl: string;
  webhookSecret?: string;
}

export function loadPhoneProviderConfig(): PhoneProviderSettings {
  const provider = (process.env.PHONE_PROVIDER || 'both') as PhoneProvider;
  const webhookBaseUrl = process.env.WEBHOOK_BASE_URL || 'http://localhost:3001';
  const webhookSecret = process.env.WEBHOOK_SECRET;

  const config: PhoneProviderSettings = {
    provider,
    webhookBaseUrl,
    webhookSecret,
  };

  // Twilio configuration
  if (provider === 'twilio' || provider === 'both') {
    const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

    if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
      throw new Error('Missing required Twilio configuration. Please set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER');
    }

    config.twilio = {
      accountSid: twilioAccountSid,
      authToken: twilioAuthToken,
      phoneNumber: twilioPhoneNumber,
    };
  }

  // Telnyx configuration
  if (provider === 'telnyx' || provider === 'both') {
    const telnyxApiKey = process.env.TELNYX_API_KEY;
    const telnyxPhoneNumber = process.env.TELNYX_PHONE_NUMBER;

    if (!telnyxApiKey || !telnyxPhoneNumber) {
      throw new Error('Missing required Telnyx configuration. Please set TELNYX_API_KEY and TELNYX_PHONE_NUMBER');
    }

    config.telnyx = {
      apiKey: telnyxApiKey,
      phoneNumber: telnyxPhoneNumber,
    };
  }

  return config;
}

export function getPhoneProviderConfig(provider: PhoneProvider, settings: PhoneProviderSettings): PhoneProviderConfig | null {
  if (provider === 'twilio' && settings.twilio) {
    return {
      provider: 'twilio',
      enabled: true,
      accountSid: settings.twilio.accountSid,
      authToken: settings.twilio.authToken,
      phoneNumber: settings.twilio.phoneNumber,
      webhookUrl: `${settings.webhookBaseUrl}/webhooks/twilio/incoming`,
      webhookSecret: settings.webhookSecret,
    };
  }

  if (provider === 'telnyx' && settings.telnyx) {
    return {
      provider: 'telnyx',
      enabled: true,
      apiKey: settings.telnyx.apiKey,
      phoneNumber: settings.telnyx.phoneNumber,
      webhookUrl: `${settings.webhookBaseUrl}/webhooks/telnyx/incoming`,
      webhookSecret: settings.webhookSecret,
    };
  }

  return null;
}

