/**
 * Call Recorder
 * 
 * Records audio streams from calls and stores them for playback and analysis.
 * Supports recording both user and agent audio, storing in IndexedDB, and exporting as audio files.
 */

import { CallRecording } from '../types';

export interface RecordingOptions {
  sessionId: string;
  agentId?: string;
  agentName?: string;
  callerId?: string;
  sampleRate?: number;
  channels?: number;
}

export class CallRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private recording: CallRecording | null = null;
  private audioContext: AudioContext | null = null;
  private inputStream: MediaStream | null = null;
  private outputStream: MediaStreamAudioDestinationNode | null = null;
  private isRecording: boolean = false;
  private startTime: number = 0;

  /**
   * Start recording a call
   */
  async startRecording(options: RecordingOptions): Promise<CallRecording> {
    if (this.isRecording) {
      throw new Error('Recording already in progress');
    }

    try {
      // Create audio context
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioContextClass({ sampleRate: options.sampleRate || 24000 });
      
      // Create destination node to capture audio
      this.outputStream = this.audioContext.createMediaStreamDestination();
      
      // Get user's microphone input
      this.inputStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: options.channels || 1,
          sampleRate: options.sampleRate || 24000
        } 
      });

      // Create MediaRecorder to record the combined stream
      const combinedStream = new MediaStream([
        ...this.inputStream.getAudioTracks(),
        ...this.outputStream.stream.getAudioTracks()
      ]);

      this.mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      this.audioChunks = [];
      
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        this.finishRecording();
      };

      // Create recording object
      this.recording = {
        id: `recording_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        sessionId: options.sessionId,
        startTime: Date.now(),
        metadata: {
          agentId: options.agentId,
          agentName: options.agentName,
          callerId: options.callerId
        }
      };

      this.startTime = Date.now();
      this.isRecording = true;
      this.mediaRecorder.start(1000); // Collect data every second

      return this.recording;
    } catch (error) {
      console.error('Error starting recording:', error);
      throw new Error(`Failed to start recording: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Add audio data from agent (output audio)
   */
  addAgentAudio(audioData: ArrayBuffer): void {
    if (!this.isRecording || !this.audioContext || !this.outputStream) {
      return;
    }

    try {
      // Convert ArrayBuffer to AudioBuffer and play through destination
      this.audioContext.decodeAudioData(audioData.slice(0)).then((audioBuffer) => {
        const source = this.audioContext!.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(this.outputStream!);
        source.start();
      }).catch(err => {
        console.warn('Failed to decode agent audio for recording:', err);
      });
    } catch (error) {
      console.warn('Error adding agent audio to recording:', error);
    }
  }

  /**
   * Stop recording
   */
  stopRecording(): CallRecording | null {
    if (!this.isRecording || !this.mediaRecorder) {
      return null;
    }

    this.isRecording = false;
    this.mediaRecorder.stop();
    
    // Stop all tracks
    if (this.inputStream) {
      this.inputStream.getTracks().forEach(track => track.stop());
      this.inputStream = null;
    }

    if (this.audioContext) {
      this.audioContext.close().catch(console.error);
      this.audioContext = null;
    }

    this.outputStream = null;

    return this.recording;
  }

  /**
   * Finish recording and create final blob
   */
  private finishRecording(): void {
    if (!this.recording) return;

    const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm;codecs=opus' });
    const duration = Date.now() - this.startTime;

    this.recording.endTime = Date.now();
    this.recording.duration = duration;
    this.recording.audioBlob = audioBlob;
    this.recording.audioUrl = URL.createObjectURL(audioBlob);

    // Store in IndexedDB
    this.storeRecording(this.recording).catch(console.error);
  }

  /**
   * Store recording in IndexedDB
   */
  private async storeRecording(recording: CallRecording): Promise<void> {
    try {
      const db = await this.openDatabase();
      const transaction = db.transaction(['recordings'], 'readwrite');
      const store = transaction.objectStore('recordings');
      
      // Convert blob to array buffer for storage
      if (recording.audioBlob) {
        const arrayBuffer = await recording.audioBlob.arrayBuffer();
        const recordingData = {
          ...recording,
          audioData: arrayBuffer,
          audioBlob: undefined, // Don't store blob directly
          audioUrl: undefined // Will be regenerated on retrieval
        };
        await store.put(recordingData);
      }
    } catch (error) {
      console.error('Error storing recording:', error);
    }
  }

  /**
   * Open IndexedDB database
   */
  private async openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('CallRecordingsDB', 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('recordings')) {
          const store = db.createObjectStore('recordings', { keyPath: 'id' });
          store.createIndex('sessionId', 'sessionId', { unique: false });
          store.createIndex('startTime', 'startTime', { unique: false });
        }
      };
    });
  }

  /**
   * Get recording by ID
   */
  async getRecording(recordingId: string): Promise<CallRecording | null> {
    try {
      const db = await this.openDatabase();
      const transaction = db.transaction(['recordings'], 'readonly');
      const store = transaction.objectStore('recordings');
      const request = store.get(recordingId);

      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          const data = request.result;
          if (!data) {
            resolve(null);
            return;
          }

          // Reconstruct blob from array buffer
          if (data.audioData) {
            const blob = new Blob([data.audioData], { type: 'audio/webm;codecs=opus' });
            const recording: CallRecording = {
              ...data,
              audioBlob: blob,
              audioUrl: URL.createObjectURL(blob),
              audioData: undefined
            };
            resolve(recording);
          } else {
            resolve(data);
          }
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Error getting recording:', error);
      return null;
    }
  }

  /**
   * Get all recordings for a session
   */
  async getSessionRecordings(sessionId: string): Promise<CallRecording[]> {
    try {
      const db = await this.openDatabase();
      const transaction = db.transaction(['recordings'], 'readonly');
      const store = transaction.objectStore('recordings');
      const index = store.index('sessionId');
      const request = index.getAll(sessionId);

      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          const recordings = request.result.map((data: any) => {
            if (data.audioData) {
              const blob = new Blob([data.audioData], { type: 'audio/webm;codecs=opus' });
              return {
                ...data,
                audioBlob: blob,
                audioUrl: URL.createObjectURL(blob),
                audioData: undefined
              };
            }
            return data;
          });
          resolve(recordings);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Error getting session recordings:', error);
      return [];
    }
  }

  /**
   * Delete recording
   */
  async deleteRecording(recordingId: string): Promise<void> {
    try {
      const db = await this.openDatabase();
      const transaction = db.transaction(['recordings'], 'readwrite');
      const store = transaction.objectStore('recordings');
      await store.delete(recordingId);
    } catch (error) {
      console.error('Error deleting recording:', error);
      throw error;
    }
  }

  /**
   * Export recording as WAV file
   */
  async exportAsWAV(recording: CallRecording): Promise<Blob> {
    if (!recording.audioBlob) {
      throw new Error('Recording has no audio data');
    }

    // For now, return the original blob
    // In production, you might want to convert WebM to WAV
    return recording.audioBlob;
  }

  /**
   * Get current recording status
   */
  getCurrentRecording(): CallRecording | null {
    return this.recording;
  }

  /**
   * Check if currently recording
   */
  isCurrentlyRecording(): boolean {
    return this.isRecording;
  }
}

