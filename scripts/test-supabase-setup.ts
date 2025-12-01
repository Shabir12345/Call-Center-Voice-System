/**
 * Supabase Setup Test Script
 * 
 * Tests all Supabase configuration, tables, and storage buckets
 * Run with: npx tsx scripts/test-supabase-setup.ts
 */

import { getSupabaseClient, isSupabaseConfigured, getSupabaseAdminClient } from '../utils/supabaseClient';
import { 
  uploadTemplate, 
  getTemplate, 
  listTemplates,
  uploadCallRecording,
  listCallRecordings,
  STORAGE_BUCKETS 
} from '../utils/supabaseStorage';

// ANSI color codes for terminal output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') {
  const color = type === 'success' ? colors.green : 
                type === 'error' ? colors.red : 
                type === 'warning' ? colors.yellow : colors.blue;
  console.log(`${color}${type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️'} ${message}${colors.reset}`);
}

function logSection(title: string) {
  console.log(`\n${colors.bold}${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.bold}${colors.blue}  ${title}${colors.reset}`);
  console.log(`${colors.bold}${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);
}

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: any;
}

const results: TestResult[] = [];

async function testEnvironmentVariables(): Promise<TestResult[]> {
  logSection('Testing Environment Variables');
  const testResults: TestResult[] = [];

  // Check if Supabase is configured
  const configured = isSupabaseConfigured();
  testResults.push({
    name: 'Supabase Configuration Check',
    passed: configured,
    error: configured ? undefined : 'Supabase environment variables not found'
  });
  log(configured ? 'Supabase is configured' : 'Supabase configuration missing', configured ? 'success' : 'error');

  // Check individual environment variables (client-side)
  const viteUrl = import.meta.env.VITE_SUPABASE_URL;
  const viteKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  
  testResults.push({
    name: 'VITE_SUPABASE_URL',
    passed: !!viteUrl,
    error: viteUrl ? undefined : 'VITE_SUPABASE_URL not set'
  });
  log(viteUrl ? `VITE_SUPABASE_URL: ${viteUrl.substring(0, 30)}...` : 'VITE_SUPABASE_URL missing', viteUrl ? 'success' : 'error');

  testResults.push({
    name: 'VITE_SUPABASE_ANON_KEY',
    passed: !!viteKey,
    error: viteKey ? undefined : 'VITE_SUPABASE_ANON_KEY not set'
  });
  log(viteKey ? `VITE_SUPABASE_ANON_KEY: ${viteKey.substring(0, 20)}...` : 'VITE_SUPABASE_ANON_KEY missing', viteKey ? 'success' : 'error');

  return testResults;
}

async function testSupabaseConnection(): Promise<TestResult[]> {
  logSection('Testing Supabase Connection');
  const testResults: TestResult[] = [];

  try {
    const supabase = getSupabaseClient();
    testResults.push({
      name: 'Get Supabase Client',
      passed: true,
      details: 'Client created successfully'
    });
    log('Supabase client created', 'success');

    // Test connection with a simple query
    const { data, error } = await supabase.from('sessions').select('count').limit(0);
    
    testResults.push({
      name: 'Database Connection Test',
      passed: !error,
      error: error?.message,
      details: error ? undefined : 'Successfully connected to database'
    });
    
    if (error) {
      log(`Connection error: ${error.message}`, 'error');
    } else {
      log('Database connection successful', 'success');
    }
  } catch (error: any) {
    testResults.push({
      name: 'Supabase Connection',
      passed: false,
      error: error.message
    });
    log(`Connection failed: ${error.message}`, 'error');
  }

  return testResults;
}

async function testDatabaseTables(): Promise<TestResult[]> {
  logSection('Testing Database Tables');
  const testResults: TestResult[] = [];

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

  const supabase = getSupabaseClient();

  for (const tableName of tables) {
    try {
      // Try to query the table (even if empty, it should work)
      const { data, error } = await supabase.from(tableName).select('*').limit(1);
      
      if (error) {
        // Check if it's a "relation does not exist" error
        if (error.message.includes('does not exist') || error.code === '42P01') {
          testResults.push({
            name: `Table: ${tableName}`,
            passed: false,
            error: 'Table does not exist'
          });
          log(`Table '${tableName}' does not exist`, 'error');
        } else {
          // Other errors (like RLS) are okay - table exists
          testResults.push({
            name: `Table: ${tableName}`,
            passed: true,
            details: 'Table exists (query returned error, but table is accessible)'
          });
          log(`Table '${tableName}' exists`, 'success');
        }
      } else {
        testResults.push({
          name: `Table: ${tableName}`,
          passed: true,
          details: `Table exists with ${data?.length || 0} rows`
        });
        log(`Table '${tableName}' exists and is accessible`, 'success');
      }
    } catch (error: any) {
      testResults.push({
        name: `Table: ${tableName}`,
        passed: false,
        error: error.message
      });
      log(`Error testing table '${tableName}': ${error.message}`, 'error');
    }
  }

  return testResults;
}

async function testTableOperations(): Promise<TestResult[]> {
  logSection('Testing Table Operations (CRUD)');
  const testResults: TestResult[] = [];

  const supabase = getSupabaseClient();
  const testId = `test-${Date.now()}`;

  // Test INSERT
  try {
    const { data: insertData, error: insertError } = await supabase
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

    testResults.push({
      name: 'INSERT Operation (sessions)',
      passed: !insertError,
      error: insertError?.message,
      details: insertData ? 'Record inserted successfully' : undefined
    });
    log(insertError ? `INSERT failed: ${insertError.message}` : 'INSERT operation successful', insertError ? 'error' : 'success');
  } catch (error: any) {
    testResults.push({
      name: 'INSERT Operation',
      passed: false,
      error: error.message
    });
    log(`INSERT error: ${error.message}`, 'error');
  }

  // Test SELECT
  try {
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', testId)
      .single();

    testResults.push({
      name: 'SELECT Operation (sessions)',
      passed: !error && !!data,
      error: error?.message,
      details: data ? 'Record retrieved successfully' : undefined
    });
    log(error ? `SELECT failed: ${error.message}` : 'SELECT operation successful', error ? 'error' : 'success');
  } catch (error: any) {
    testResults.push({
      name: 'SELECT Operation',
      passed: false,
      error: error.message
    });
    log(`SELECT error: ${error.message}`, 'error');
  }

  // Test UPDATE
  try {
    const { data, error } = await supabase
      .from('sessions')
      .update({ metadata: { test: true, updated: true } })
      .eq('id', testId)
      .select()
      .single();

    testResults.push({
      name: 'UPDATE Operation (sessions)',
      passed: !error,
      error: error?.message,
      details: data ? 'Record updated successfully' : undefined
    });
    log(error ? `UPDATE failed: ${error.message}` : 'UPDATE operation successful', error ? 'error' : 'success');
  } catch (error: any) {
    testResults.push({
      name: 'UPDATE Operation',
      passed: false,
      error: error.message
    });
    log(`UPDATE error: ${error.message}`, 'error');
  }

  // Test DELETE (cleanup)
  try {
    const { error } = await supabase
      .from('sessions')
      .delete()
      .eq('id', testId);

    testResults.push({
      name: 'DELETE Operation (sessions)',
      passed: !error,
      error: error?.message,
      details: 'Test record deleted successfully'
    });
    log(error ? `DELETE failed: ${error.message}` : 'DELETE operation successful (test record cleaned up)', error ? 'error' : 'success');
  } catch (error: any) {
    testResults.push({
      name: 'DELETE Operation',
      passed: false,
      error: error.message
    });
    log(`DELETE error: ${error.message}`, 'error');
  }

  return testResults;
}

async function testStorageBuckets(): Promise<TestResult[]> {
  logSection('Testing Storage Buckets');
  const testResults: TestResult[] = [];

  const supabase = getSupabaseClient();
  const buckets = [
    STORAGE_BUCKETS.CALL_RECORDINGS,
    STORAGE_BUCKETS.TEMPLATES,
    STORAGE_BUCKETS.TRANSCRIPTS,
    STORAGE_BUCKETS.ATTACHMENTS
  ];

  for (const bucketName of buckets) {
    try {
      // Try to list files in the bucket (even if empty)
      const { data, error } = await supabase.storage.from(bucketName).list('', {
        limit: 1
      });

      if (error) {
        if (error.message.includes('not found') || error.message.includes('does not exist')) {
          testResults.push({
            name: `Bucket: ${bucketName}`,
            passed: false,
            error: 'Bucket does not exist'
          });
          log(`Bucket '${bucketName}' does not exist`, 'error');
        } else {
          // Other errors might be permission-related, but bucket exists
          testResults.push({
            name: `Bucket: ${bucketName}`,
            passed: true,
            details: 'Bucket exists (may have permission restrictions)'
          });
          log(`Bucket '${bucketName}' exists`, 'success');
        }
      } else {
        testResults.push({
          name: `Bucket: ${bucketName}`,
          passed: true,
          details: `Bucket exists and is accessible`
        });
        log(`Bucket '${bucketName}' exists and is accessible`, 'success');
      }
    } catch (error: any) {
      testResults.push({
        name: `Bucket: ${bucketName}`,
        passed: false,
        error: error.message
      });
      log(`Error testing bucket '${bucketName}': ${error.message}`, 'error');
    }
  }

  return testResults;
}

async function testStorageOperations(): Promise<TestResult[]> {
  logSection('Testing Storage Operations');
  const testResults: TestResult[] = [];

  // Test template upload
  try {
    const testTemplate = {
      name: 'test-template',
      version: '1.0.0',
      test: true
    };

    const uploadResult = await uploadTemplate(testTemplate, 'test-template');
    
    testResults.push({
      name: 'Template Upload',
      passed: uploadResult.success,
      error: uploadResult.error,
      details: uploadResult.path
    });
    log(uploadResult.success ? 'Template upload successful' : `Template upload failed: ${uploadResult.error}`, 
        uploadResult.success ? 'success' : 'error');

    // Test template retrieval
    if (uploadResult.success) {
      const getResult = await getTemplate('test-template');
      testResults.push({
        name: 'Template Retrieval',
        passed: getResult.success,
        error: getResult.error
      });
      log(getResult.success ? 'Template retrieval successful' : `Template retrieval failed: ${getResult.error}`, 
          getResult.success ? 'success' : 'error');
    }
  } catch (error: any) {
    testResults.push({
      name: 'Storage Operations',
      passed: false,
      error: error.message
    });
    log(`Storage operation error: ${error.message}`, 'error');
  }

  return testResults;
}

async function testAdminClient(): Promise<TestResult[]> {
  logSection('Testing Admin Client (Server-side)');
  const testResults: TestResult[] = [];

  try {
    // Only test if we're in a Node.js environment
    if (typeof process !== 'undefined' && typeof window === 'undefined') {
      const adminClient = getSupabaseAdminClient();
      testResults.push({
        name: 'Admin Client Creation',
        passed: true,
        details: 'Admin client created successfully (server-side only)'
      });
      log('Admin client created (server-side)', 'success');
    } else {
      testResults.push({
        name: 'Admin Client Creation',
        passed: true,
        details: 'Skipped (browser environment - admin client is server-side only)'
      });
      log('Admin client test skipped (browser environment)', 'info');
    }
  } catch (error: any) {
    testResults.push({
      name: 'Admin Client',
      passed: false,
      error: error.message
    });
    log(`Admin client error: ${error.message}`, 'error');
  }

  return testResults;
}

async function runAllTests() {
  console.log(`\n${colors.bold}${colors.blue}╔═══════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bold}${colors.blue}║   Supabase Setup Test Suite${colors.reset}`);
  console.log(`${colors.bold}${colors.blue}╚═══════════════════════════════════════════════════════════╝${colors.reset}\n`);

  try {
    // Run all tests
    results.push(...await testEnvironmentVariables());
    results.push(...await testSupabaseConnection());
    results.push(...await testDatabaseTables());
    results.push(...await testTableOperations());
    results.push(...await testStorageBuckets());
    results.push(...await testStorageOperations());
    results.push(...await testAdminClient());

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

    // Exit code
    process.exit(failed > 0 ? 1 : 0);
  } catch (error: any) {
    log(`Fatal error: ${error.message}`, 'error');
    console.error(error);
    process.exit(1);
  }
}

// Run tests
runAllTests();

