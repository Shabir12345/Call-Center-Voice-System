# Supabase Tables and Storage Setup Guide

This guide will help you create all the necessary database tables and storage buckets for your call center voice system.

## Step 1: Create Database Tables

### Option A: Run the Complete Migration Script (Recommended)

1. **Open your Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Select your project (Project ID: `zkokdcmejdlnwpbcuixi`)

2. **Navigate to SQL Editor**
   - Click on "SQL Editor" in the left sidebar
   - Click "New query"

3. **Copy and Paste the Migration Script**
   - Open the file `supabase_migration.sql` in your project
   - Copy the entire contents
   - Paste it into the SQL Editor in Supabase

4. **Run the Script**
   - Click "Run" or press `Ctrl+Enter` (Windows) / `Cmd+Enter` (Mac)
   - Wait for the script to complete
   - You should see success messages for each table created

### Option B: Create Tables One by One

If you prefer to create tables individually, follow these steps:

#### 1. Sessions Table
```sql
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  caller_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  current_thread_id TEXT NOT NULL,
  history JSONB DEFAULT '[]'::jsonb,
  context JSONB DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  session_memory JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_sessions_caller_id ON sessions(caller_id);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_thread_id ON sessions(current_thread_id);
```

#### 2. Call Recordings Table
```sql
CREATE TABLE IF NOT EXISTS call_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL,
  file_path TEXT NOT NULL,
  caller_id TEXT,
  caller_number TEXT,
  duration INTEGER,
  start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_time TIMESTAMPTZ,
  transcript TEXT,
  audio_url TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_call_recordings_session_id ON call_recordings(session_id);
CREATE INDEX IF NOT EXISTS idx_call_recordings_caller_id ON call_recordings(caller_id);
CREATE INDEX IF NOT EXISTS idx_call_recordings_created_at ON call_recordings(created_at);
```

#### 3. Customer Profiles Table
```sql
CREATE TABLE IF NOT EXISTS customer_profiles (
  id TEXT PRIMARY KEY,
  phone_number TEXT,
  email TEXT,
  name TEXT,
  company TEXT,
  tags TEXT[] DEFAULT '{}',
  custom_fields JSONB DEFAULT '{}'::jsonb,
  last_contact TIMESTAMPTZ,
  contact_history JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_profiles_phone ON customer_profiles(phone_number);
CREATE INDEX IF NOT EXISTS idx_customer_profiles_email ON customer_profiles(email);
CREATE INDEX IF NOT EXISTS idx_customer_profiles_tags ON customer_profiles USING GIN(tags);
```

#### 4. Knowledge Base Table
```sql
CREATE TABLE IF NOT EXISTS knowledge_base (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  type TEXT DEFAULT 'text' CHECK (type IN ('text', 'snippet')),
  category TEXT,
  tags TEXT[] DEFAULT '{}',
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  views INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_base_category ON knowledge_base(category);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_tags ON knowledge_base USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_title ON knowledge_base USING gin(to_tsvector('english', title));
CREATE INDEX IF NOT EXISTS idx_knowledge_base_content ON knowledge_base USING gin(to_tsvector('english', content));
```

#### 5. Call Sessions Table
```sql
CREATE TABLE IF NOT EXISTS call_sessions (
  session_id TEXT PRIMARY KEY,
  call_sid TEXT UNIQUE,
  provider TEXT NOT NULL,
  caller_number TEXT NOT NULL,
  called_number TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ringing', 'in-progress', 'completed', 'failed', 'busy', 'no-answer', 'canceled')),
  start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_time TIMESTAMPTZ,
  transcription_segments JSONB DEFAULT '[]'::jsonb,
  conversation_history JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_call_sessions_call_sid ON call_sessions(call_sid);
CREATE INDEX IF NOT EXISTS idx_call_sessions_caller_number ON call_sessions(caller_number);
CREATE INDEX IF NOT EXISTS idx_call_sessions_status ON call_sessions(status);
CREATE INDEX IF NOT EXISTS idx_call_sessions_start_time ON call_sessions(start_time);
```

#### 6. Transcripts Table
```sql
CREATE TABLE IF NOT EXISTS transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL,
  call_session_id TEXT REFERENCES call_sessions(session_id) ON DELETE SET NULL,
  transcript_text TEXT NOT NULL,
  segments JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transcripts_session_id ON transcripts(session_id);
CREATE INDEX IF NOT EXISTS idx_transcripts_call_session_id ON transcripts(call_session_id);
CREATE INDEX IF NOT EXISTS idx_transcripts_created_at ON transcripts(created_at);
CREATE INDEX IF NOT EXISTS idx_transcripts_text_search ON transcripts USING gin(to_tsvector('english', transcript_text));
```

#### 7. Templates Table
```sql
CREATE TABLE IF NOT EXISTS templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  file_path TEXT NOT NULL,
  template_data JSONB,
  category TEXT,
  tags TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_templates_category ON templates(category);
CREATE INDEX IF NOT EXISTS idx_templates_tags ON templates USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_templates_is_active ON templates(is_active);
```

#### 8. Connection Context Cards Table
```sql
CREATE TABLE IF NOT EXISTS connection_context_cards (
  id TEXT PRIMARY KEY,
  connection_id TEXT NOT NULL,
  name TEXT NOT NULL,
  from_node TEXT NOT NULL,
  to_node TEXT NOT NULL,
  priority INTEGER DEFAULT 0,
  enabled BOOLEAN DEFAULT true,
  purpose TEXT,
  when_to_use TEXT,
  when_not_to_use TEXT,
  example_phrases TEXT[] DEFAULT '{}',
  preconditions JSONB DEFAULT '[]'::jsonb,
  risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high')) DEFAULT 'low',
  risk_notes TEXT,
  requires_confirmation BOOLEAN DEFAULT false,
  system_prompt_additions TEXT,
  usage_examples TEXT[] DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_connection_context_connection_id ON connection_context_cards(connection_id);
CREATE INDEX IF NOT EXISTS idx_connection_context_from_node ON connection_context_cards(from_node);
CREATE INDEX IF NOT EXISTS idx_connection_context_to_node ON connection_context_cards(to_node);
CREATE INDEX IF NOT EXISTS idx_connection_context_enabled ON connection_context_cards(enabled);
CREATE INDEX IF NOT EXISTS idx_connection_context_priority ON connection_context_cards(priority);
```

## Step 2: Enable Row Level Security (RLS)

After creating the tables, enable RLS and create policies. The migration script includes these, but if you created tables manually, run:

```sql
-- Enable RLS on all tables
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE connection_context_cards ENABLE ROW LEVEL SECURITY;

-- Create basic policies (allow all for authenticated users)
-- You can customize these based on your needs

CREATE POLICY "Allow all for authenticated users" ON sessions
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all for authenticated users" ON call_recordings
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all for authenticated users" ON customer_profiles
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow read for all" ON knowledge_base
  FOR SELECT USING (true);
CREATE POLICY "Allow write for authenticated" ON knowledge_base
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all for authenticated users" ON call_sessions
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all for authenticated users" ON transcripts
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow read for all" ON templates
  FOR SELECT USING (true);
CREATE POLICY "Allow write for authenticated" ON templates
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow read for all" ON connection_context_cards
  FOR SELECT USING (true);
CREATE POLICY "Allow write for authenticated" ON connection_context_cards
  FOR ALL USING (auth.role() = 'authenticated');
```

## Step 3: Create Storage Buckets

1. **Navigate to Storage**
   - In your Supabase dashboard, click on "Storage" in the left sidebar

2. **Create Each Bucket**

   Click "New bucket" and create the following buckets:

   ### Bucket 1: `call-recordings`
   - **Name**: `call-recordings`
   - **Public bucket**: ✅ Yes (if you want public URLs) or ❌ No (if you want private)
   - **File size limit**: 100 MB (or adjust based on your needs)
   - **Allowed MIME types**: `audio/*` (or leave empty for all types)
   - Click "Create bucket"

   ### Bucket 2: `templates`
   - **Name**: `templates`
   - **Public bucket**: ✅ Yes (recommended for templates)
   - **File size limit**: 10 MB
   - **Allowed MIME types**: `application/json` (or leave empty)
   - Click "Create bucket"

   ### Bucket 3: `transcripts`
   - **Name**: `transcripts`
   - **Public bucket**: ❌ No (keep transcripts private)
   - **File size limit**: 50 MB
   - **Allowed MIME types**: `text/*, application/json` (or leave empty)
   - Click "Create bucket"

   ### Bucket 4: `attachments`
   - **Name**: `attachments`
   - **Public bucket**: ❌ No (keep attachments private)
   - **File size limit**: 100 MB
   - **Allowed MIME types**: (leave empty for all types)
   - Click "Create bucket"

3. **Set Storage Policies (Optional but Recommended)**

   For each bucket, you can set up policies to control access:

   - Go to the bucket
   - Click on "Policies" tab
   - Create policies based on your security requirements

   Example policy for `call-recordings` (allow authenticated users to upload):
   ```sql
   -- Allow authenticated users to upload
   CREATE POLICY "Allow authenticated uploads" ON storage.objects
     FOR INSERT WITH CHECK (
       bucket_id = 'call-recordings' AND
       auth.role() = 'authenticated'
     );

   -- Allow authenticated users to read
   CREATE POLICY "Allow authenticated reads" ON storage.objects
     FOR SELECT USING (
       bucket_id = 'call-recordings' AND
       auth.role() = 'authenticated'
     );
   ```

## Step 4: Verify Setup

### Verify Tables
1. Go to "Table Editor" in Supabase dashboard
2. You should see all 8 tables listed:
   - sessions
   - call_recordings
   - customer_profiles
   - knowledge_base
   - call_sessions
   - transcripts
   - templates
   - connection_context_cards

### Verify Storage Buckets
1. Go to "Storage" in Supabase dashboard
2. You should see all 4 buckets:
   - call-recordings
   - templates
   - transcripts
   - attachments

## Step 5: Test the Connection

You can test if everything is working by running this in your application:

```typescript
import { getSupabaseClient } from '@/utils/supabaseClient';

const supabase = getSupabaseClient();

// Test query
const { data, error } = await supabase
  .from('sessions')
  .select('count')
  .limit(1);

if (error) {
  console.error('Connection test failed:', error);
} else {
  console.log('✅ Supabase connection successful!');
}
```

## Troubleshooting

### "Table already exists" Error
- This is fine! The `IF NOT EXISTS` clause prevents errors
- You can safely run the migration script multiple times

### RLS Policy Errors
- Make sure you've enabled RLS on the table first
- Check that your policies match your authentication setup

### Storage Bucket Access Issues
- Check bucket policies in the Storage section
- Verify your service role key is being used for admin operations
- Check that bucket names match exactly (case-sensitive)

## Next Steps

After setting up tables and storage:

1. ✅ Verify your `.env.local` file has the correct Supabase credentials
2. ✅ Test database connections using the code examples above
3. ✅ Start using Supabase in your application code
4. ✅ Consider setting up additional RLS policies based on your security requirements

## Need Help?

- Check `docs/SUPABASE_SETUP.md` for general Supabase setup
- Review Supabase documentation: https://supabase.com/docs
- Check the SQL migration script: `supabase_migration.sql`

