/**
 * Transcription Storage
 * 
 * Stores and retrieves transcripts using IndexedDB.
 */

import { Transcript } from './transcriptionExporter';

export class TranscriptionStorage {
  private dbName = 'CallTranscriptsDB';
  private version = 1;

  /**
   * Open database
   */
  private async openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains('transcripts')) {
          const store = db.createObjectStore('transcripts', { keyPath: 'id' });
          store.createIndex('sessionId', 'sessionId', { unique: false });
          store.createIndex('startTime', 'startTime', { unique: false });
          store.createIndex('agentId', 'metadata.agentId', { unique: false });
        }
      };
    });
  }

  /**
   * Save transcript
   */
  async saveTranscript(transcript: Transcript): Promise<void> {
    try {
      const db = await this.openDatabase();
      const transaction = db.transaction(['transcripts'], 'readwrite');
      const store = transaction.objectStore('transcripts');
      await store.put(transcript);
    } catch (error) {
      console.error('Error saving transcript:', error);
      throw error;
    }
  }

  /**
   * Get transcript by ID
   */
  async getTranscript(transcriptId: string): Promise<Transcript | null> {
    try {
      const db = await this.openDatabase();
      const transaction = db.transaction(['transcripts'], 'readonly');
      const store = transaction.objectStore('transcripts');
      const request = store.get(transcriptId);

      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Error getting transcript:', error);
      return null;
    }
  }

  /**
   * Get transcripts for a session
   */
  async getSessionTranscripts(sessionId: string): Promise<Transcript[]> {
    try {
      const db = await this.openDatabase();
      const transaction = db.transaction(['transcripts'], 'readonly');
      const store = transaction.objectStore('transcripts');
      const index = store.index('sessionId');
      const request = index.getAll(sessionId);

      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Error getting session transcripts:', error);
      return [];
    }
  }

  /**
   * Get all transcripts
   */
  async getAllTranscripts(limit?: number): Promise<Transcript[]> {
    try {
      const db = await this.openDatabase();
      const transaction = db.transaction(['transcripts'], 'readonly');
      const store = transaction.objectStore('transcripts');
      const index = store.index('startTime');
      const request = index.getAll();

      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          let transcripts = request.result || [];
          // Sort by start time (newest first)
          transcripts.sort((a, b) => b.startTime - a.startTime);
          if (limit) {
            transcripts = transcripts.slice(0, limit);
          }
          resolve(transcripts);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Error getting all transcripts:', error);
      return [];
    }
  }

  /**
   * Delete transcript
   */
  async deleteTranscript(transcriptId: string): Promise<void> {
    try {
      const db = await this.openDatabase();
      const transaction = db.transaction(['transcripts'], 'readwrite');
      const store = transaction.objectStore('transcripts');
      await store.delete(transcriptId);
    } catch (error) {
      console.error('Error deleting transcript:', error);
      throw error;
    }
  }

  /**
   * Clear all transcripts
   */
  async clearAll(): Promise<void> {
    try {
      const db = await this.openDatabase();
      const transaction = db.transaction(['transcripts'], 'readwrite');
      const store = transaction.objectStore('transcripts');
      await store.clear();
    } catch (error) {
      console.error('Error clearing transcripts:', error);
      throw error;
    }
  }
}

