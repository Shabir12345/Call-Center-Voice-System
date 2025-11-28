/**
 * Transcription Exporter
 * 
 * Exports call transcripts in multiple formats (JSON, CSV, TXT, SRT)
 * and provides search functionality across transcripts.
 */

export interface TranscriptEntry {
  role: 'user' | 'agent' | 'system';
  text: string;
  timestamp: number;
  speaker?: string;
}

export interface Transcript {
  id: string;
  sessionId: string;
  startTime: number;
  endTime?: number;
  entries: TranscriptEntry[];
  metadata?: {
    agentId?: string;
    agentName?: string;
    duration?: number;
  };
}

export class TranscriptionExporter {
  /**
   * Export transcript as JSON
   */
  exportAsJSON(transcript: Transcript): string {
    return JSON.stringify(transcript, null, 2);
  }

  /**
   * Export transcript as CSV
   */
  exportAsCSV(transcript: Transcript): string {
    const headers = ['Timestamp', 'Role', 'Speaker', 'Text'];
    const rows = transcript.entries.map(entry => [
      new Date(entry.timestamp).toISOString(),
      entry.role,
      entry.speaker || '',
      `"${entry.text.replace(/"/g, '""')}"` // Escape quotes for CSV
    ]);

    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }

  /**
   * Export transcript as plain text
   */
  exportAsTXT(transcript: Transcript): string {
    const lines: string[] = [];
    
    lines.push(`Call Transcript - Session: ${transcript.sessionId}`);
    lines.push(`Start Time: ${new Date(transcript.startTime).toLocaleString()}`);
    if (transcript.endTime) {
      lines.push(`End Time: ${new Date(transcript.endTime).toLocaleString()}`);
    }
    if (transcript.metadata?.agentName) {
      lines.push(`Agent: ${transcript.metadata.agentName}`);
    }
    lines.push('');
    lines.push('---');
    lines.push('');

    transcript.entries.forEach(entry => {
      const time = new Date(entry.timestamp).toLocaleTimeString();
      const speaker = entry.speaker || (entry.role === 'user' ? 'User' : 'Agent');
      lines.push(`[${time}] ${speaker}: ${entry.text}`);
    });

    return lines.join('\n');
  }

  /**
   * Export transcript as SRT (subtitles)
   */
  exportAsSRT(transcript: Transcript): string {
    const entries: string[] = [];
    let index = 1;
    const startTime = transcript.startTime;

    transcript.entries.forEach((entry, i) => {
      const entryStart = entry.timestamp - startTime;
      const nextEntry = transcript.entries[i + 1];
      const entryEnd = nextEntry ? nextEntry.timestamp - startTime : entryStart + 3000; // Default 3s if last

      const startSRT = this.formatSRTTime(entryStart);
      const endSRT = this.formatSRTTime(entryEnd);

      const speaker = entry.speaker || (entry.role === 'user' ? 'User' : 'Agent');
      const text = entry.text.replace(/\n/g, ' ');

      entries.push(`${index}`);
      entries.push(`${startSRT} --> ${endSRT}`);
      entries.push(`${speaker}: ${text}`);
      entries.push('');

      index++;
    });

    return entries.join('\n');
  }

  /**
   * Format time for SRT (HH:MM:SS,mmm)
   */
  private formatSRTTime(milliseconds: number): string {
    const hours = Math.floor(milliseconds / 3600000);
    const minutes = Math.floor((milliseconds % 3600000) / 60000);
    const seconds = Math.floor((milliseconds % 60000) / 1000);
    const ms = milliseconds % 1000;

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
  }

  /**
   * Search transcripts
   */
  searchTranscripts(
    transcripts: Transcript[],
    query: string,
    options?: {
      caseSensitive?: boolean;
      role?: 'user' | 'agent' | 'system';
      dateRange?: { start: number; end: number };
    }
  ): Transcript[] {
    const lowerQuery = options?.caseSensitive ? query : query.toLowerCase();
    
    return transcripts.filter(transcript => {
      // Date range filter
      if (options?.dateRange) {
        if (transcript.startTime < options.dateRange.start || 
            (transcript.endTime && transcript.endTime > options.dateRange.end)) {
          return false;
        }
      }

      // Search in entries
      return transcript.entries.some(entry => {
        // Role filter
        if (options?.role && entry.role !== options.role) {
          return false;
        }

        // Text search
        const text = options?.caseSensitive ? entry.text : entry.text.toLowerCase();
        return text.includes(lowerQuery);
      });
    });
  }

  /**
   * Get matching entries from a transcript
   */
  getMatchingEntries(
    transcript: Transcript,
    query: string,
    caseSensitive: boolean = false
  ): TranscriptEntry[] {
    const searchText = caseSensitive ? query : query.toLowerCase();
    
    return transcript.entries.filter(entry => {
      const text = caseSensitive ? entry.text : entry.text.toLowerCase();
      return text.includes(searchText);
    });
  }
}

