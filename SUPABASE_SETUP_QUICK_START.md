# Supabase Setup - Quick Start Guide

## 🚀 Quick Setup Steps

### 1. Create Database Tables (5 minutes)

1. Open your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project (Project ID: `zkokdcmejdlnwpbcuixi`)
3. Click **"SQL Editor"** in the left sidebar
4. Click **"New query"**
5. Open the file `supabase_migration.sql` in your project
6. **Copy the entire contents** and paste into the SQL Editor
7. Click **"Run"** (or press `Ctrl+Enter`)
8. Wait for success messages ✅

### 2. Create Storage Buckets (3 minutes)

1. In Supabase Dashboard, click **"Storage"** in the left sidebar
2. Click **"New bucket"** and create these 4 buckets:

   | Bucket Name | Public? | File Size Limit | Purpose |
   |------------|---------|----------------|---------|
   | `call-recordings` | Optional | 100 MB | Audio files |
   | `templates` | Yes | 10 MB | Template JSON files |
   | `transcripts` | No | 50 MB | Transcript files |
   | `attachments` | No | 100 MB | Other attachments |

3. For each bucket:
   - Enter the name
   - Check/uncheck "Public bucket" as shown above
   - Set file size limit
   - Click **"Create bucket"**

### 3. Verify Setup (2 minutes)

1. **Check Tables**: Go to "Table Editor" - you should see 8 tables
2. **Check Storage**: Go to "Storage" - you should see 4 buckets

## 📋 What Gets Created

### Database Tables (8 total):
- ✅ `sessions` - Conversation sessions
- ✅ `call_recordings` - Call recording metadata
- ✅ `customer_profiles` - Customer information
- ✅ `knowledge_base` - Knowledge articles
- ✅ `call_sessions` - Phone call sessions
- ✅ `transcripts` - Conversation transcripts
- ✅ `templates` - Workflow templates metadata
- ✅ `connection_context_cards` - Intent routing context

### Storage Buckets (4 total):
- ✅ `call-recordings` - For audio files
- ✅ `templates` - For template JSON files
- ✅ `transcripts` - For transcript files
- ✅ `attachments` - For other files

## 🔒 Security Features Included

- ✅ Row Level Security (RLS) enabled on all tables
- ✅ Basic access policies configured
- ✅ Auto-updating `updated_at` timestamps
- ✅ Proper indexes for performance

## 📚 Detailed Instructions

For step-by-step instructions with SQL snippets, see:
- **`docs/SUPABASE_TABLES_SETUP.md`** - Complete setup guide

## ✅ Test Your Setup

After setup, test the connection:

```typescript
import { getSupabaseClient } from '@/utils/supabaseClient';

const supabase = getSupabaseClient();
const { data, error } = await supabase.from('sessions').select('count').limit(1);

if (!error) {
  console.log('✅ Supabase is working!');
}
```

## 🆘 Need Help?

- **Full setup guide**: `docs/SUPABASE_TABLES_SETUP.md`
- **General Supabase setup**: `docs/SUPABASE_SETUP.md`
- **Migration SQL file**: `supabase_migration.sql`

---

**Total setup time: ~10 minutes** ⏱️

