-- Supabase Database Migration Script
-- Call Center Voice System - Tables and Storage Setup
-- Run this script in your Supabase SQL Editor

-- ============================================
-- 1. SESSIONS TABLE
-- ============================================
-- Stores conversation sessions with history and metadata
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

-- Indexes for sessions
CREATE INDEX IF NOT EXISTS idx_sessions_caller_id ON sessions(caller_id);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_thread_id ON sessions(current_thread_id);

-- ============================================
-- 2. CALL_RECORDINGS TABLE
-- ============================================
-- Stores metadata about call recordings (audio files stored in Storage)
CREATE TABLE IF NOT EXISTS call_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL,
  file_path TEXT NOT NULL,
  caller_id TEXT,
  caller_number TEXT,
  duration INTEGER, -- Duration in seconds
  start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_time TIMESTAMPTZ,
  transcript TEXT,
  audio_url TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for call_recordings
CREATE INDEX IF NOT EXISTS idx_call_recordings_session_id ON call_recordings(session_id);
CREATE INDEX IF NOT EXISTS idx_call_recordings_caller_id ON call_recordings(caller_id);
CREATE INDEX IF NOT EXISTS idx_call_recordings_created_at ON call_recordings(created_at);

-- ============================================
-- 3. CUSTOMER_PROFILES TABLE
-- ============================================
-- Stores customer profile information
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

-- Indexes for customer_profiles
CREATE INDEX IF NOT EXISTS idx_customer_profiles_phone ON customer_profiles(phone_number);
CREATE INDEX IF NOT EXISTS idx_customer_profiles_email ON customer_profiles(email);
CREATE INDEX IF NOT EXISTS idx_customer_profiles_tags ON customer_profiles USING GIN(tags);

-- ============================================
-- 4. KNOWLEDGE_BASE TABLE
-- ============================================
-- Stores knowledge base articles
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

-- Indexes for knowledge_base
CREATE INDEX IF NOT EXISTS idx_knowledge_base_category ON knowledge_base(category);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_tags ON knowledge_base USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_title ON knowledge_base USING gin(to_tsvector('english', title));
CREATE INDEX IF NOT EXISTS idx_knowledge_base_content ON knowledge_base USING gin(to_tsvector('english', content));

-- ============================================
-- 5. CALL_SESSIONS TABLE
-- ============================================
-- Stores detailed call session information from phone providers
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

-- Indexes for call_sessions
CREATE INDEX IF NOT EXISTS idx_call_sessions_call_sid ON call_sessions(call_sid);
CREATE INDEX IF NOT EXISTS idx_call_sessions_caller_number ON call_sessions(caller_number);
CREATE INDEX IF NOT EXISTS idx_call_sessions_status ON call_sessions(status);
CREATE INDEX IF NOT EXISTS idx_call_sessions_start_time ON call_sessions(start_time);

-- ============================================
-- 6. TRANSCRIPTS TABLE
-- ============================================
-- Stores conversation transcripts
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

-- Indexes for transcripts
CREATE INDEX IF NOT EXISTS idx_transcripts_session_id ON transcripts(session_id);
CREATE INDEX IF NOT EXISTS idx_transcripts_call_session_id ON transcripts(call_session_id);
CREATE INDEX IF NOT EXISTS idx_transcripts_created_at ON transcripts(created_at);
CREATE INDEX IF NOT EXISTS idx_transcripts_text_search ON transcripts USING gin(to_tsvector('english', transcript_text));

-- ============================================
-- 7. TEMPLATES TABLE (Metadata)
-- ============================================
-- Stores metadata about workflow templates (actual files in Storage)
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

-- Indexes for templates
CREATE INDEX IF NOT EXISTS idx_templates_category ON templates(category);
CREATE INDEX IF NOT EXISTS idx_templates_tags ON templates USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_templates_is_active ON templates(is_active);

-- ============================================
-- 8. CONNECTION_CONTEXT_CARDS TABLE
-- ============================================
-- Stores connection context cards for intent-based routing
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

-- Indexes for connection_context_cards
CREATE INDEX IF NOT EXISTS idx_connection_context_connection_id ON connection_context_cards(connection_id);
CREATE INDEX IF NOT EXISTS idx_connection_context_from_node ON connection_context_cards(from_node);
CREATE INDEX IF NOT EXISTS idx_connection_context_to_node ON connection_context_cards(to_node);
CREATE INDEX IF NOT EXISTS idx_connection_context_enabled ON connection_context_cards(enabled);
CREATE INDEX IF NOT EXISTS idx_connection_context_priority ON connection_context_cards(priority);

-- ============================================
-- 9. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================
-- Enable RLS on all tables
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE connection_context_cards ENABLE ROW LEVEL SECURITY;

-- Basic policies: Allow all operations for authenticated users
-- You can customize these based on your security requirements

-- Sessions: Allow all for authenticated users
CREATE POLICY "Allow all for authenticated users" ON sessions
  FOR ALL USING (auth.role() = 'authenticated');

-- Call Recordings: Allow all for authenticated users
CREATE POLICY "Allow all for authenticated users" ON call_recordings
  FOR ALL USING (auth.role() = 'authenticated');

-- Customer Profiles: Allow all for authenticated users
CREATE POLICY "Allow all for authenticated users" ON customer_profiles
  FOR ALL USING (auth.role() = 'authenticated');

-- Knowledge Base: Allow read for all, write for authenticated
CREATE POLICY "Allow read for all" ON knowledge_base
  FOR SELECT USING (true);
CREATE POLICY "Allow write for authenticated" ON knowledge_base
  FOR ALL USING (auth.role() = 'authenticated');

-- Call Sessions: Allow all for authenticated users
CREATE POLICY "Allow all for authenticated users" ON call_sessions
  FOR ALL USING (auth.role() = 'authenticated');

-- Transcripts: Allow all for authenticated users
CREATE POLICY "Allow all for authenticated users" ON transcripts
  FOR ALL USING (auth.role() = 'authenticated');

-- Templates: Allow read for all, write for authenticated
CREATE POLICY "Allow read for all" ON templates
  FOR SELECT USING (true);
CREATE POLICY "Allow write for authenticated" ON templates
  FOR ALL USING (auth.role() = 'authenticated');

-- Connection Context Cards: Allow read for all, write for authenticated
CREATE POLICY "Allow read for all" ON connection_context_cards
  FOR SELECT USING (true);
CREATE POLICY "Allow write for authenticated" ON connection_context_cards
  FOR ALL USING (auth.role() = 'authenticated');

-- ============================================
-- 10. FUNCTIONS AND TRIGGERS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to auto-update updated_at
CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_call_recordings_updated_at BEFORE UPDATE ON call_recordings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customer_profiles_updated_at BEFORE UPDATE ON customer_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_call_sessions_updated_at BEFORE UPDATE ON call_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transcripts_updated_at BEFORE UPDATE ON transcripts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_connection_context_cards_updated_at BEFORE UPDATE ON connection_context_cards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- COMPLETION MESSAGE
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ Database migration completed successfully!';
  RAISE NOTICE '📊 Created tables: sessions, call_recordings, customer_profiles, knowledge_base, call_sessions, transcripts, templates, connection_context_cards';
  RAISE NOTICE '🔒 Row Level Security (RLS) enabled on all tables';
  RAISE NOTICE '⏰ Auto-update triggers created for updated_at columns';
END $$;

