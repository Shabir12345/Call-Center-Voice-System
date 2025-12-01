/**
 * Supabase Setup Test Script (Node.js)
 * 
 * Tests all Supabase configuration, tables, and storage buckets
 * Run with: node scripts/test-supabase.js
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { readFileSync } from 'fs';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

// Load environment variables from project root
config({ path: resolve(projectRoot, '.env.local') });

// Colors for terminal output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, type = 'info') {
  const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️';
  const color = type === 'success' ? colors.green : 
                type === 'error' ? colors.red : 
                type === 'warning' ? colors.yellow : colors.blue;
  console.log(`${color}${icon} ${message}${colors.reset}`);
}

function logSection(title) {
  console.log(`\n${colors.bold}${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.bold}${colors.blue}  ${title}${colors.reset}`);
  console.log(`${colors.bold}${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);
}

const results = [];

async function testEnvironmentVariables() {
  logSection('Testing Environment Variables');
  
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const urlExists = !!supabaseUrl;
  const keyExists = !!supabaseKey;
  const serviceKeyExists = !!serviceRoleKey;

  results.push({ name: 'SUPABASE_URL', passed: urlExists });
  log(urlExists ? `SUPABASE_URL: ${supabaseUrl.substring(0, 40)}...` : 'SUPABASE_URL missing', urlExists ? 'success' : 'error');

  results.push({ name: 'SUPABASE_ANON_KEY', passed: keyExists });
  log(keyExists ? `SUPABASE_ANON_KEY: ${supabaseKey.substring(0, 20)}...` : 'SUPABASE_ANON_KEY missing', keyExists ? 'success' : 'error');

  results.push({ name: 'SUPABASE_SERVICE_ROLE_KEY', passed: serviceKeyExists });
  log(serviceKeyExists ? `SUPABASE_SERVICE_ROLE_KEY: ${serviceRoleKey.substring(0, 20)}...` : 'SUPABASE_SERVICE_ROLE_KEY missing', serviceKeyExists ? 'success' : 'warning');

  if (!urlExists || !keyExists) {
    throw new Error('Missing required Supabase environment variables');
  }

  return { url: supabaseUrl, key: supabaseKey, serviceKey: serviceRoleKey };
}

async function testConnection(config) {
  logSection('Testing Supabase Connection');
  
  try {
    const supabase = createClient(config.url, config.key);
    
    // Test connection
    const { data, error } = await supabase.from('sessions').select('count').limit(0);
    
    results.push({ name: 'Database Connection', passed: !error });
    log(error ? `Connection error: ${error.message}` : 'Database connection successful', error ? 'error' : 'success');
    
    // Also create admin client for CRUD operations (bypasses RLS)
    let adminSupabase = null;
    if (config.serviceKey) {
      adminSupabase = createClient(config.url, config.serviceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });
      log('Admin client created (for CRUD testing)', 'success');
    }
    
    return { supabase, adminSupabase, error };
  } catch (error) {
    results.push({ name: 'Database Connection', passed: false, error: error.message });
    log(`Connection failed: ${error.message}`, 'error');
    throw error;
  }
}

async function testTables(supabase) {
  logSection('Testing Database Tables');
  
  const tables = [
    'sessions',
    'call_recordings',
    'customer_profiles',
    'knowledge_base',
    'call_sessions',
    'transcripts',
    'templates',
    'connection_context_cards'
  ];

  for (const tableName of tables) {
    try {
      const { data, error } = await supabase.from(tableName).select('*').limit(1);
      
      if (error) {
        if (error.message.includes('does not exist') || error.code === '42P01') {
          results.push({ name: `Table: ${tableName}`, passed: false, error: 'Table does not exist' });
          log(`Table '${tableName}' does not exist`, 'error');
        } else {
          // Table exists but might have RLS restrictions
          results.push({ name: `Table: ${tableName}`, passed: true });
          log(`Table '${tableName}' exists`, 'success');
        }
      } else {
        results.push({ name: `Table: ${tableName}`, passed: true });
        log(`Table '${tableName}' exists and is accessible`, 'success');
      }
    } catch (error) {
      results.push({ name: `Table: ${tableName}`, passed: false, error: error.message });
      log(`Error testing table '${tableName}': ${error.message}`, 'error');
    }
  }
}

async function testCRUD(supabase, adminSupabase) {
  logSection('Testing CRUD Operations');
  
  // Use admin client if available (bypasses RLS), otherwise use regular client
  const client = adminSupabase || supabase;
  const testId = `test-${Date.now()}`;

  // INSERT
  try {
    const { data, error } = await client
      .from('sessions')
      .insert({
        id: testId,
        caller_id: 'test-caller',
        expires_at: new Date(Date.now() + 3600000).toISOString(),
        current_thread_id: 'test-thread',
        history: [],
        context: {},
        metadata: { test: true }
      })
      .select()
      .single();

    results.push({ name: 'INSERT Operation', passed: !error });
    log(error ? `INSERT failed: ${error.message}` : 'INSERT successful', error ? 'error' : 'success');
  } catch (error) {
    results.push({ name: 'INSERT Operation', passed: false, error: error.message });
    log(`INSERT error: ${error.message}`, 'error');
    return; // Can't continue if INSERT fails
  }

  // SELECT
  try {
    const { data, error } = await client
      .from('sessions')
      .select('*')
      .eq('id', testId)
      .single();

    results.push({ name: 'SELECT Operation', passed: !error && !!data });
    log(error ? `SELECT failed: ${error.message}` : 'SELECT successful', error ? 'error' : 'success');
  } catch (error) {
    results.push({ name: 'SELECT Operation', passed: false, error: error.message });
    log(`SELECT error: ${error.message}`, 'error');
  }

  // UPDATE
  try {
    const { data, error } = await client
      .from('sessions')
      .update({ metadata: { test: true, updated: true } })
      .eq('id', testId)
      .select()
      .single();

    results.push({ name: 'UPDATE Operation', passed: !error });
    log(error ? `UPDATE failed: ${error.message}` : 'UPDATE successful', error ? 'error' : 'success');
  } catch (error) {
    results.push({ name: 'UPDATE Operation', passed: false, error: error.message });
    log(`UPDATE error: ${error.message}`, 'error');
  }

  // DELETE
  try {
    const { error } = await client
      .from('sessions')
      .delete()
      .eq('id', testId);

    results.push({ name: 'DELETE Operation', passed: !error });
    log(error ? `DELETE failed: ${error.message}` : 'DELETE successful (test record cleaned up)', error ? 'error' : 'success');
  } catch (error) {
    results.push({ name: 'DELETE Operation', passed: false, error: error.message });
    log(`DELETE error: ${error.message}`, 'error');
  }
}

async function testStorage(supabase) {
  logSection('Testing Storage Buckets');
  
  const buckets = ['call-recordings', 'templates', 'transcripts', 'attachments'];

  for (const bucketName of buckets) {
    try {
      const { data, error } = await supabase.storage.from(bucketName).list('', { limit: 1 });

      if (error) {
        if (error.message.includes('not found') || error.message.includes('does not exist')) {
          results.push({ name: `Bucket: ${bucketName}`, passed: false, error: 'Bucket does not exist' });
          log(`Bucket '${bucketName}' does not exist`, 'error');
        } else {
          results.push({ name: `Bucket: ${bucketName}`, passed: true });
          log(`Bucket '${bucketName}' exists`, 'success');
        }
      } else {
        results.push({ name: `Bucket: ${bucketName}`, passed: true });
        log(`Bucket '${bucketName}' exists and is accessible`, 'success');
      }
    } catch (error) {
      results.push({ name: `Bucket: ${bucketName}`, passed: false, error: error.message });
      log(`Error testing bucket '${bucketName}': ${error.message}`, 'error');
    }
  }
}

async function runTests() {
  console.log(`\n${colors.bold}${colors.blue}╔═══════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bold}${colors.blue}║   Supabase Setup Test Suite${colors.reset}`);
  console.log(`${colors.bold}${colors.blue}╚═══════════════════════════════════════════════════════════╝${colors.reset}\n`);

  try {
    const config = await testEnvironmentVariables();
    const { supabase, adminSupabase } = await testConnection(config);
    await testTables(supabase);
    await testCRUD(supabase, adminSupabase);
    await testStorage(supabase);

    // Summary
    logSection('Test Summary');
    
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    const total = results.length;

    console.log(`\n${colors.bold}Total Tests: ${total}${colors.reset}`);
    console.log(`${colors.green}✅ Passed: ${passed}${colors.reset}`);
    console.log(`${colors.red}❌ Failed: ${failed}${colors.reset}`);
    console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%\n`);

    if (failed > 0) {
      console.log(`${colors.red}${colors.bold}Failed Tests:${colors.reset}\n`);
      results.filter(r => !r.passed).forEach(result => {
        console.log(`${colors.red}  ❌ ${result.name}${colors.reset}`);
        if (result.error) {
          console.log(`     Error: ${result.error}`);
        }
      });
      console.log();
    }

    process.exit(failed > 0 ? 1 : 0);
  } catch (error) {
    log(`Fatal error: ${error.message}`, 'error');
    console.error(error);
    process.exit(1);
  }
}

runTests();

