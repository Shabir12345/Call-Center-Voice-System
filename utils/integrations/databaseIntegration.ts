/**
 * Database Integration
 * 
 * Handles database queries for sub-agents and tool agents.
 * Supports both direct queries and ORM-style operations.
 * Now integrated with Supabase for persistent storage.
 */

import { DatabaseConfig } from '../../types';
import { withRetry } from '../responseValidator';
import { getSupabaseClient, isSupabaseConfigured } from '../supabaseClient';

/**
 * Database query result
 */
export interface DatabaseQueryResult {
  success: boolean;
  data?: any[];
  error?: string;
  rowCount?: number;
}

/**
 * Database Integration handler
 */
export class DatabaseIntegration {
  private config: DatabaseConfig;
  private useSupabase: boolean;

  constructor(config: DatabaseConfig) {
    this.config = config;
    this.useSupabase = isSupabaseConfigured() && this.config.supabaseConfig?.tableName;
  }

  /**
   * Execute database query
   * Supports both Supabase queries and fallback to local knowledge base
   */
  async executeQuery(
    query: string,
    parameters?: Record<string, any>
  ): Promise<DatabaseQueryResult> {
    if (!this.config.enabled) {
      return {
        success: false,
        error: 'Database integration is disabled'
      };
    }

    try {
      // If Supabase is configured and table name is specified, use Supabase
      if (this.useSupabase && this.config.supabaseConfig?.tableName) {
        return await this.executeSupabaseQuery(query, parameters);
      }

      // Fallback to local knowledge base search
      if (query.toLowerCase().includes('select') || query.toLowerCase().includes('search')) {
        return await this.searchKnowledgeBase(query, parameters);
      }

      return {
        success: false,
        error: 'Database query execution not fully implemented'
      };

    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Database query failed'
      };
    }
  }

  /**
   * Execute query against Supabase
   */
  private async executeSupabaseQuery(
    query: string,
    parameters?: Record<string, any>
  ): Promise<DatabaseQueryResult> {
    try {
      const supabase = getSupabaseClient();
      const tableName = this.config.supabaseConfig?.tableName;

      if (!tableName) {
        throw new Error('Supabase table name not configured');
      }

      // Parse simple SELECT queries
      if (query.toLowerCase().trim().startsWith('select')) {
        let queryBuilder = supabase.from(tableName).select('*');

        // Apply filters from parameters
        if (parameters) {
          for (const [key, value] of Object.entries(parameters)) {
            if (value !== undefined && value !== null) {
              queryBuilder = queryBuilder.eq(key, value);
            }
          }
        }

        const { data, error } = await queryBuilder;

        if (error) {
          return {
            success: false,
            error: error.message,
            rowCount: 0
          };
        }

        return {
          success: true,
          data: data || [],
          rowCount: data?.length || 0
        };
      }

      // For INSERT, UPDATE, DELETE operations
      if (query.toLowerCase().trim().startsWith('insert')) {
        if (!parameters || !parameters.data) {
          return {
            success: false,
            error: 'INSERT query requires data parameter'
          };
        }

        const { data, error } = await supabase
          .from(tableName)
          .insert(parameters.data)
          .select();

        if (error) {
          return {
            success: false,
            error: error.message,
            rowCount: 0
          };
        }

        return {
          success: true,
          data: data || [],
          rowCount: data?.length || 0
        };
      }

      if (query.toLowerCase().trim().startsWith('update')) {
        if (!parameters || !parameters.data) {
          return {
            success: false,
            error: 'UPDATE query requires data parameter'
          };
        }

        let queryBuilder = supabase.from(tableName).update(parameters.data);

        // Apply WHERE conditions
        if (parameters.where) {
          for (const [key, value] of Object.entries(parameters.where)) {
            queryBuilder = queryBuilder.eq(key, value);
          }
        }

        const { data, error } = await queryBuilder.select();

        if (error) {
          return {
            success: false,
            error: error.message,
            rowCount: 0
          };
        }

        return {
          success: true,
          data: data || [],
          rowCount: data?.length || 0
        };
      }

      if (query.toLowerCase().trim().startsWith('delete')) {
        let queryBuilder = supabase.from(tableName).delete();

        // Apply WHERE conditions
        if (parameters?.where) {
          for (const [key, value] of Object.entries(parameters.where)) {
            queryBuilder = queryBuilder.eq(key, value);
          }
        }

        const { data, error } = await queryBuilder.select();

        if (error) {
          return {
            success: false,
            error: error.message,
            rowCount: 0
          };
        }

        return {
          success: true,
          data: data || [],
          rowCount: data?.length || 0
        };
      }

      return {
        success: false,
        error: 'Unsupported query type. Supported: SELECT, INSERT, UPDATE, DELETE'
      };

    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Supabase query failed',
        rowCount: 0
      };
    }
  }

  /**
   * Search knowledge base
   */
  private async searchKnowledgeBase(
    query: string,
    parameters?: Record<string, any>
  ): Promise<DatabaseQueryResult> {
    const results: any[] = [];

    // Search in knowledge base
    if (this.config.knowledgeBase) {
      for (const item of this.config.knowledgeBase) {
        const searchText = query.toLowerCase();
        if (item.title.toLowerCase().includes(searchText) ||
            item.content.toLowerCase().includes(searchText)) {
          results.push({
            id: item.id,
            title: item.title,
            content: item.content,
            type: item.type
          });
        }
      }
    }

    // Search in static data
    if (this.config.staticData && parameters) {
      for (const item of this.config.staticData) {
        if (parameters.key && item.key === parameters.key) {
          results.push({
            id: item.id,
            key: item.key,
            value: item.value
          });
        }
      }
    }

    return {
      success: true,
      data: results,
      rowCount: results.length
    };
  }

  /**
   * Get knowledge base item by ID
   * Tries Supabase first, then falls back to local knowledge base
   */
  async getKnowledgeItem(id: string): Promise<any | null> {
    // Try Supabase first if configured
    if (this.useSupabase && this.config.supabaseConfig?.tableName) {
      try {
        const supabase = getSupabaseClient();
        const tableName = this.config.supabaseConfig.tableName;
        
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .eq('id', id)
          .single();

        if (!error && data) {
          return data;
        }
      } catch (error) {
        console.warn('Failed to fetch from Supabase, falling back to local:', error);
      }
    }

    // Fallback to local knowledge base
    if (!this.config.knowledgeBase) {
      return null;
    }

    return this.config.knowledgeBase.find(item => item.id === id) || null;
  }

  /**
   * Get static data by key
   */
  async getStaticData(key: string): Promise<string | null> {
    if (!this.config.staticData) {
      return null;
    }

    const item = this.config.staticData.find(item => item.key === key);
    return item ? item.value : null;
  }

  /**
   * Vector search (for vector database support)
   */
  async vectorSearch(
    query: string,
    topK?: number,
    threshold?: number
  ): Promise<DatabaseQueryResult> {
    const settings = this.config.vectorSettings || {};
    const k = topK || settings.topK || 5;
    const thresh = threshold || settings.threshold || 0.7;

    // Simulate vector search
    // In production, this would use actual vector database
    const results: any[] = [];

    if (this.config.knowledgeBase) {
      // Simple keyword matching as simulation
      const queryLower = query.toLowerCase();
      for (const item of this.config.knowledgeBase.slice(0, k)) {
        if (item.content.toLowerCase().includes(queryLower)) {
          results.push({
            id: item.id,
            title: item.title,
            content: item.content,
            similarity: 0.85 // Simulated similarity score
          });
        }
      }
    }

    return {
      success: true,
      data: results.filter(r => (r.similarity || 0) >= thresh),
      rowCount: results.length
    };
  }
}

