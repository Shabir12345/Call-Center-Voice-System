/**
 * Supabase Storage Utilities
 * 
 * Helper functions for storing and retrieving call recordings, templates,
 * and other file-based data in Supabase Storage.
 */

import { getSupabaseClient, getSupabaseAdminClient } from './supabaseClient';

/**
 * Storage bucket names (should match your Supabase Storage buckets)
 */
export const STORAGE_BUCKETS = {
  CALL_RECORDINGS: 'call-recordings',
  TEMPLATES: 'templates',
  TRANSCRIPTS: 'transcripts',
  ATTACHMENTS: 'attachments',
} as const;

/**
 * Upload a call recording to Supabase Storage
 */
export async function uploadCallRecording(
  file: File | Blob,
  fileName: string,
  metadata?: Record<string, any>
): Promise<{ success: boolean; path?: string; error?: string }> {
  try {
    const supabase = getSupabaseClient();
    
    const filePath = `${Date.now()}-${fileName}`;
    
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKETS.CALL_RECORDINGS)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || 'audio/mpeg',
      });

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    // Store metadata if provided
    if (metadata && data.path) {
      await storeRecordingMetadata(data.path, metadata);
    }

    return {
      success: true,
      path: data.path,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to upload call recording',
    };
  }
}

/**
 * Get a public URL for a call recording
 */
export async function getCallRecordingUrl(filePath: string): Promise<string | null> {
  try {
    const supabase = getSupabaseClient();
    
    const { data } = supabase.storage
      .from(STORAGE_BUCKETS.CALL_RECORDINGS)
      .getPublicUrl(filePath);

    return data.publicUrl;
  } catch (error) {
    console.error('Failed to get recording URL:', error);
    return null;
  }
}

/**
 * Download a call recording
 */
export async function downloadCallRecording(
  filePath: string
): Promise<{ success: boolean; data?: Blob; error?: string }> {
  try {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKETS.CALL_RECORDINGS)
      .download(filePath);

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      data: data,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to download call recording',
    };
  }
}

/**
 * Delete a call recording
 */
export async function deleteCallRecording(
  filePath: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = getSupabaseClient();
    
    const { error } = await supabase.storage
      .from(STORAGE_BUCKETS.CALL_RECORDINGS)
      .remove([filePath]);

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to delete call recording',
    };
  }
}

/**
 * List all call recordings
 */
export async function listCallRecordings(
  limit: number = 100
): Promise<{ success: boolean; files?: any[]; error?: string }> {
  try {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKETS.CALL_RECORDINGS)
      .list('', {
        limit,
        offset: 0,
        sortBy: { column: 'created_at', order: 'desc' },
      });

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      files: data || [],
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to list call recordings',
    };
  }
}

/**
 * Store template in Supabase Storage
 */
export async function uploadTemplate(
  templateData: any,
  templateName: string
): Promise<{ success: boolean; path?: string; error?: string }> {
  try {
    const supabase = getSupabaseClient();
    
    const fileContent = JSON.stringify(templateData, null, 2);
    const blob = new Blob([fileContent], { type: 'application/json' });
    const filePath = `${templateName}.json`;
    
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKETS.TEMPLATES)
      .upload(filePath, blob, {
        cacheControl: '3600',
        upsert: true,
        contentType: 'application/json',
      });

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      path: data.path,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to upload template',
    };
  }
}

/**
 * Get template from Supabase Storage
 */
export async function getTemplate(
  templateName: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const supabase = getSupabaseClient();
    
    const filePath = `${templateName}.json`;
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKETS.TEMPLATES)
      .download(filePath);

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    const text = await data.text();
    const templateData = JSON.parse(text);

    return {
      success: true,
      data: templateData,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to get template',
    };
  }
}

/**
 * List all templates
 */
export async function listTemplates(): Promise<{ success: boolean; files?: any[]; error?: string }> {
  try {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKETS.TEMPLATES)
      .list('', {
        limit: 100,
        offset: 0,
        sortBy: { column: 'created_at', order: 'desc' },
      });

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      files: data || [],
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to list templates',
    };
  }
}

/**
 * Store recording metadata in database (assumes you have a 'call_recordings' table)
 */
async function storeRecordingMetadata(
  filePath: string,
  metadata: Record<string, any>
): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    
    // Assuming you have a 'call_recordings' table with columns:
    // id, file_path, caller_id, duration, created_at, metadata
    await supabase.from('call_recordings').insert({
      file_path: filePath,
      ...metadata,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.warn('Failed to store recording metadata:', error);
    // Don't throw - metadata storage is optional
  }
}

