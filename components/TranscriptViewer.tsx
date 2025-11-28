/**
 * Transcript Viewer Component
 * 
 * Displays call transcripts with search functionality and export options.
 */

import React, { useState, useMemo } from 'react';
import { Search, Download, FileText, FileJson, FileSpreadsheet, Film, X } from 'lucide-react';
import { Transcript, TranscriptEntry } from '../utils/transcriptionExporter';
import { TranscriptionExporter } from '../utils/transcriptionExporter';

interface TranscriptViewerProps {
  transcript: Transcript;
  onClose?: () => void;
}

const TranscriptViewer: React.FC<TranscriptViewerProps> = ({ transcript, transcript: transcriptData, onClose }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedEntries, setHighlightedEntries] = useState<Set<number>>(new Set());
  const exporter = new TranscriptionExporter();

  const filteredEntries = useMemo(() => {
    if (!searchQuery.trim()) {
      return transcript.entries;
    }

    const query = searchQuery.toLowerCase();
    const matching: Set<number> = new Set();

    const filtered = transcript.entries.filter((entry, index) => {
      const matches = entry.text.toLowerCase().includes(query);
      if (matches) {
        matching.add(index);
      }
      return matches;
    });

    setHighlightedEntries(matching);
    return filtered;
  }, [searchQuery, transcript.entries]);

  const handleExport = (format: 'json' | 'csv' | 'txt' | 'srt') => {
    let content: string;
    let filename: string;
    let mimeType: string;

    switch (format) {
      case 'json':
        content = exporter.exportAsJSON(transcript);
        filename = `transcript-${transcript.id}.json`;
        mimeType = 'application/json';
        break;
      case 'csv':
        content = exporter.exportAsCSV(transcript);
        filename = `transcript-${transcript.id}.csv`;
        mimeType = 'text/csv';
        break;
      case 'txt':
        content = exporter.exportAsTXT(transcript);
        filename = `transcript-${transcript.id}.txt`;
        mimeType = 'text/plain';
        break;
      case 'srt':
        content = exporter.exportAsSRT(transcript);
        filename = `transcript-${transcript.id}.srt`;
        mimeType = 'text/srt';
        break;
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-4 w-full max-w-4xl max-h-[80vh] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-200">
        <div>
          <h3 className="font-bold text-slate-800 text-sm">Call Transcript</h3>
          <p className="text-xs text-slate-500">
            {transcript.metadata?.agentName || 'Unknown Agent'} • {new Date(transcript.startTime).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Export Buttons */}
          <div className="flex items-center gap-1 border-r border-slate-200 pr-2">
            <button
              onClick={() => handleExport('json')}
              className="p-2 hover:bg-slate-100 rounded transition-colors"
              title="Export as JSON"
            >
              <FileJson size={16} className="text-slate-600" />
            </button>
            <button
              onClick={() => handleExport('csv')}
              className="p-2 hover:bg-slate-100 rounded transition-colors"
              title="Export as CSV"
            >
              <FileSpreadsheet size={16} className="text-slate-600" />
            </button>
            <button
              onClick={() => handleExport('txt')}
              className="p-2 hover:bg-slate-100 rounded transition-colors"
              title="Export as TXT"
            >
              <FileText size={16} className="text-slate-600" />
            </button>
            <button
              onClick={() => handleExport('srt')}
              className="p-2 hover:bg-slate-100 rounded transition-colors"
              title="Export as SRT"
            >
              <Film size={16} className="text-slate-600" />
            </button>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded transition-colors"
            >
              <X size={16} className="text-slate-600" />
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search transcript..."
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
        {searchQuery && (
          <p className="text-xs text-slate-500 mt-1">
            Found {filteredEntries.length} of {transcript.entries.length} entries
          </p>
        )}
      </div>

      {/* Transcript Content */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-2">
        {filteredEntries.length === 0 ? (
          <div className="text-center text-slate-400 py-8">
            {searchQuery ? 'No matching entries found' : 'No transcript entries'}
          </div>
        ) : (
          filteredEntries.map((entry, index) => {
            const isUser = entry.role === 'user';
            const isHighlighted = highlightedEntries.has(transcript.entries.indexOf(entry));

            return (
              <div
                key={`${entry.timestamp}-${index}`}
                className={`p-3 rounded-lg border ${
                  isUser
                    ? 'bg-indigo-50 border-indigo-200 ml-8'
                    : 'bg-slate-50 border-slate-200 mr-8'
                } ${isHighlighted ? 'ring-2 ring-amber-400' : ''}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-semibold ${
                    isUser ? 'text-indigo-700' : 'text-slate-700'
                  }`}>
                    {entry.speaker || (isUser ? 'User' : 'Agent')}
                  </span>
                  <span className="text-xs text-slate-500">
                    {formatTime(entry.timestamp)}
                  </span>
                </div>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">
                  {entry.text}
                </p>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Stats */}
      <div className="mt-4 pt-4 border-t border-slate-200">
        <div className="grid grid-cols-3 gap-4 text-xs">
          <div>
            <span className="text-slate-500">Total Entries:</span>
            <span className="ml-2 text-slate-700 font-medium">{transcript.entries.length}</span>
          </div>
          <div>
            <span className="text-slate-500">Duration:</span>
            <span className="ml-2 text-slate-700 font-medium">
              {transcript.endTime && transcript.startTime
                ? `${Math.round((transcript.endTime - transcript.startTime) / 1000)}s`
                : 'N/A'}
            </span>
          </div>
          <div>
            <span className="text-slate-500">Session ID:</span>
            <span className="ml-2 text-slate-700 font-mono text-[10px]">{transcript.sessionId}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TranscriptViewer;

