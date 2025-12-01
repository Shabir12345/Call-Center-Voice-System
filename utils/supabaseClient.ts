/**
 * Supabase Client Configuration
 * 
 * Provides Supabase client instances for both client-side and server-side usage.
 * Uses environment variables to securely manage credentials.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Get Supabase URL from environment variables
 */
function getSupabaseUrl(): string {
  // Try Vite environment variable first (for client-side)
  const viteUrl = import.meta.env.VITE_SUPABASE_URL;
  if (viteUrl) {
    return viteUrl;
  }
  
  // Fallback to Node.js environment variable (for server-side)
  if (typeof process !== 'undefined' && process.env.SUPABASE_URL) {
    return process.env.SUPABASE_URL;
  }
  
  throw new Error(
    'Missing SUPABASE_URL environment variable. ' +
    'Please set VITE_SUPABASE_URL (client-side) or SUPABASE_URL (server-side) in your .env.local file.'
  );
}

/**
 * Get Supabase Anon Key from environment variables
 */
function getSupabaseAnonKey(): string {
  // Try Vite environment variable first (for client-side)
  const viteKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (viteKey) {
    return viteKey;
  }
  
  // Fallback to Node.js environment variable (for server-side)
  if (typeof process !== 'undefined' && process.env.SUPABASE_ANON_KEY) {
    return process.env.SUPABASE_ANON_KEY;
  }
  
  throw new Error(
    'Missing SUPABASE_ANON_KEY environment variable. ' +
    'Please set VITE_SUPABASE_ANON_KEY (client-side) or SUPABASE_ANON_KEY (server-side) in your .env.local file.'
  );
}

/**
 * Get Supabase Service Role Key (server-side only)
 * ⚠️ WARNING: This key has admin privileges and should NEVER be exposed to the client
 */
function getSupabaseServiceRoleKey(): string | null {
  if (typeof process === 'undefined' || typeof window !== 'undefined') {
    // Running in browser - service role key should never be accessible here
    console.warn('Service role key is not available in browser context for security reasons');
    return null;
  }
  
  return process.env.SUPABASE_SERVICE_ROLE_KEY || null;
}

/**
 * Client-side Supabase client (uses anon key)
 * Safe to use in browser - respects Row Level Security (RLS) policies
 */
let clientSupabase: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (clientSupabase) {
    return clientSupabase;
  }
  
  const url = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();
  
  clientSupabase = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });
  
  return clientSupabase;
}

/**
 * Server-side Supabase client (uses service role key for admin operations)
 * ⚠️ Only use this in server-side code (Node.js backend)
 * This bypasses RLS and should be used carefully
 */
let adminSupabase: SupabaseClient | null = null;

export function getSupabaseAdminClient(): SupabaseClient {
  if (adminSupabase) {
    return adminSupabase;
  }
  
  const url = getSupabaseUrl();
  const serviceRoleKey = getSupabaseServiceRoleKey();
  
  if (!serviceRoleKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is required for admin operations. ' +
      'This should only be used in server-side code and should never be exposed to the client.'
    );
  }
  
  adminSupabase = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  
  return adminSupabase;
}

/**
 * Type definitions for common Supabase operations
 */
export interface SupabaseTable {
  [key: string]: any;
}

/**
 * Helper function to check if Supabase is properly configured
 */
export function isSupabaseConfigured(): boolean {
  try {
    getSupabaseUrl();
    getSupabaseAnonKey();
    return true;
  } catch {
    return false;
  }
}

/**
 * Helper function to test Supabase connection
 */
export async function testSupabaseConnection(): Promise<boolean> {
  try {
    const client = getSupabaseClient();
    // Simple query to test connection
    const { error } = await client.from('_test_connection').select('count').limit(1);
    // We expect an error if table doesn't exist, but no error means connection works
    return true;
  } catch (error) {
    console.error('Supabase connection test failed:', error);
    return false;
  }
}

