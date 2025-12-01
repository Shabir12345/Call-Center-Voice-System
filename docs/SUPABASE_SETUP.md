# Supabase Setup Guide

This guide explains how to configure Supabase for storing all application data including templates, call recordings, and other persistent data.

## Prerequisites

- Supabase project created (Project ID: `zkokdcmejdlnwpbcuixi`)
- Supabase credentials (anon key and service role key)

## Step 1: Create Environment Files

### Create `.env.local` file

Create a file named `.env.local` in the root directory of your project with the following content:

```env
# Supabase Configuration
# ⚠️ SECURITY: This file contains sensitive keys and is gitignored
# Never commit this file to version control!

# Supabase Project Configuration (Client-side)
VITE_SUPABASE_URL=https://zkokdcmejdlnwpbcuixi.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inprb2tkY21lamRsbndwYmN1aXhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5Njc1NDYsImV4cCI6MjA3OTU0MzU0Nn0.lZcC6gi66zhdWcjKsjwnqcWip3ljHY5IloXnQvJtORw

# Server-side Supabase Configuration (for backend only)
# These should only be used in server-side code, never exposed to client
SUPABASE_URL=https://zkokdcmejdlnwpbcuixi.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inprb2tkY21lamRsbndwYmN1aXhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5Njc1NDYsImV4cCI6MjA3OTU0MzU0Nn0.lZcC6gi66zhdWcjKsjwnqcWip3ljHY5IloXnQvJtORw
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inprb2tkY21lamRsbndwYmN1aXhpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mzk2NzU0NiwiZXhwIjoyMDc5NTQzNTQ2fQ.TxEYvRVdQSbMQ3JEXJY-nf8BJG_nRLGdBb4IvD9ICW4

# Gemini API Key (existing)
GEMINI_API_KEY=your_gemini_api_key_here

# Other environment variables
NODE_ENV=development
PORT=3001
WEBHOOK_BASE_URL=http://localhost:3001
```

### Create `.env.example` file (optional, for reference)

Create a file named `.env.example` in the root directory as a template:

```env
# Supabase Configuration
# Copy this file to .env.local and fill in your actual values
# Never commit .env.local to version control!

# Supabase Project Configuration
VITE_SUPABASE_URL=https://zkokdcmejdlnwpbcuixi.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here

# Server-side Supabase Configuration (for backend only)
SUPABASE_URL=https://zkokdcmejdlnwpbcuixi.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Gemini API Key (existing)
GEMINI_API_KEY=your_gemini_api_key_here

# Other environment variables
NODE_ENV=development
PORT=3001
WEBHOOK_BASE_URL=http://localhost:3001
```

## Step 2: Verify Environment Variables

The `.env.local` file is already in `.gitignore`, so your credentials will not be committed to version control.

## Step 3: Using Supabase in Your Code

### Client-Side Usage

```typescript
import { getSupabaseClient } from '@/utils/supabaseClient';

// Get the client (uses anon key - safe for browser)
const supabase = getSupabaseClient();

// Example: Fetch data from a table
const { data, error } = await supabase
  .from('your_table_name')
  .select('*');
```

### Server-Side Usage

```typescript
import { getSupabaseAdminClient } from '@/utils/supabaseClient';

// Get admin client (uses service role key - server-side only)
const supabase = getSupabaseAdminClient();

// Example: Admin operations that bypass RLS
const { data, error } = await supabase
  .from('your_table_name')
  .select('*');
```

## Step 4: Database Integration

The `DatabaseIntegration` class automatically uses Supabase when configured:

```typescript
import { DatabaseIntegration } from '@/utils/integrations/databaseIntegration';

const dbConfig: DatabaseConfig = {
  enabled: true,
  supabaseConfig: {
    tableName: 'your_table_name',
    rlsPolicy: 'your_policy_name' // optional
  },
  // ... other config
};

const db = new DatabaseIntegration(dbConfig);

// Execute queries
const result = await db.executeQuery('SELECT * FROM your_table WHERE id = ?', {
  id: 'some-id'
});
```

## Security Notes

1. **Anon Key**: Safe to expose in client-side code. It respects Row Level Security (RLS) policies.

2. **Service Role Key**: ⚠️ **NEVER expose this to the client!** It bypasses RLS and has admin privileges. Only use in server-side code.

3. **Environment Variables**: 
   - Variables prefixed with `VITE_` are exposed to the client bundle
   - Variables without `VITE_` prefix are only available in server-side code
   - Always use `.env.local` for actual credentials (it's gitignored)

## Testing the Connection

You can test your Supabase connection:

```typescript
import { testSupabaseConnection, isSupabaseConfigured } from '@/utils/supabaseClient';

// Check if configured
if (isSupabaseConfigured()) {
  // Test connection
  const isConnected = await testSupabaseConnection();
  console.log('Supabase connected:', isConnected);
}
```

## Troubleshooting

### Error: "Missing SUPABASE_URL environment variable"

- Make sure `.env.local` exists in the root directory
- Verify the variable names match exactly (case-sensitive)
- Restart your development server after creating/modifying `.env.local`

### Error: "Service role key is not available in browser context"

- This is expected! The service role key should only be used server-side
- Use `getSupabaseClient()` for client-side operations instead

### Connection Issues

- Verify your Supabase project is active
- Check that your project URL and keys are correct
- Ensure your Supabase project has the necessary tables created

## Next Steps

1. Create your database tables in Supabase (you mentioned you already did this via MCP)
2. Set up Row Level Security (RLS) policies for your tables
3. Update your application code to use Supabase for:
   - Storing call recordings
   - Storing templates
   - Storing session data
   - Any other persistent data

## Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript/introduction)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)

