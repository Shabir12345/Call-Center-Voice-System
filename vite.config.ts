import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    
    // For production builds, also check for Vercel environment variables
    const geminiApiKey = env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY || '';
    
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        // ⚠️ SECURITY WARNING: API keys exposed in client bundle!
        // TODO: Move to backend API proxy (see docs/SECURITY_API_KEY_FIX.md)
        // This is a temporary solution - API keys should NEVER be in client code
        // For Vercel: Set GEMINI_API_KEY in environment variables
        'process.env.API_KEY': JSON.stringify(geminiApiKey),
        'process.env.GEMINI_API_KEY': JSON.stringify(geminiApiKey),
        // Expose Vite env vars for Supabase (client-side safe)
        'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL || ''),
        'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY || ''),
      },
      // Supabase environment variables are automatically available via import.meta.env
      // VITE_ prefixed variables are exposed to the client (this is safe for Supabase anon key)
      // Service role key should NEVER be exposed to client - only use in server-side code
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
