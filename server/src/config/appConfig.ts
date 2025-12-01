/**
 * Application configuration loader
 */

export interface AppConfig {
  port: number;
  nodeEnv: string;
  geminiApiKey: string;
  aiAgentPhoneNumber?: string;
  webhookBaseUrl: string;
  webhookSecret?: string;
  supabase: {
    url: string;
    anonKey: string;
    serviceRoleKey: string;
  };
  voiceProcessing: {
    enableTranscription: boolean;
    enableTTS: boolean;
    language: string;
    sampleRate: number;
  };
}

export function loadAppConfig(): AppConfig {
  const port = parseInt(process.env.PORT || '3001', 10);
  const nodeEnv = process.env.NODE_ENV || 'development';
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const aiAgentPhoneNumber = process.env.AI_AGENT_PHONE_NUMBER;
  const webhookBaseUrl = process.env.WEBHOOK_BASE_URL || 'http://localhost:3001';
  const webhookSecret = process.env.WEBHOOK_SECRET;

  // Supabase configuration
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!geminiApiKey) {
    throw new Error('Missing required GEMINI_API_KEY environment variable');
  }

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    throw new Error(
      'Missing required Supabase environment variables. ' +
      'Please set SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY in your .env.local file.'
    );
  }

  return {
    port,
    nodeEnv,
    geminiApiKey,
    aiAgentPhoneNumber,
    webhookBaseUrl,
    webhookSecret,
    supabase: {
      url: supabaseUrl,
      anonKey: supabaseAnonKey,
      serviceRoleKey: supabaseServiceRoleKey,
    },
    voiceProcessing: {
      enableTranscription: true,
      enableTTS: true,
      language: 'en-US',
      sampleRate: 16000,
    },
  };
}

