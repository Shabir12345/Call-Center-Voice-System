/**
 * Call Playback Component
 * 
 * Provides UI for playing back recorded calls with timeline scrubbing,
 * speed control, and transcript synchronization.
 */

import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Square, SkipBack, SkipForward, Volume2, VolumeX, Download, Clock } from 'lucide-react';
import { CallRecording } from '../types';

interface CallPlaybackProps {
  recording: CallRecording;
  transcript?: string;
  onClose?: () => void;
}

const CallPlayback: React.FC<CallPlaybackProps> = ({ recording, transcript, onClose }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (recording.audioUrl && !audioRef.current) {
      const audio = new Audio(recording.audioUrl);
      audioRef.current = audio;

      audio.addEventListener('loadedmetadata', () => {
        setDuration(audio.duration);
      });

      audio.addEventListener('timeupdate', () => {
        setCurrentTime(audio.currentTime);
      });

      audio.addEventListener('ended', () => {
        setIsPlaying(false);
        setCurrentTime(0);
      });

      audio.addEventListener('play', () => setIsPlaying(true));
      audio.addEventListener('pause', () => setIsPlaying(false));
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [recording.audioUrl]);

  const togglePlayPause = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const newTime = percentage * duration;

    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const skip = (seconds: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Math.max(0, Math.min(duration, audioRef.current.currentTime + seconds));
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
      setIsMuted(newVolume === 0);
    }
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    if (isMuted) {
      audioRef.current.volume = volume || 0.5;
      setIsMuted(false);
    } else {
      audioRef.current.volume = 0;
      setIsMuted(true);
    }
  };

  const handlePlaybackRateChange = (rate: number) => {
    setPlaybackRate(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleDownload = () => {
    if (recording.audioBlob) {
      const url = URL.createObjectURL(recording.audioBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `call-recording-${recording.id}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-4 w-full max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold text-slate-800 text-sm">Call Recording</h3>
          <p className="text-xs text-slate-500">
            {recording.metadata?.agentName || 'Unknown Agent'} • {new Date(recording.startTime).toLocaleString()}
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-sm"
          >
            Close
          </button>
        )}
      </div>

      {/* Audio Player */}
      <div className="mb-4">
        {/* Progress Bar */}
        <div
          className="w-full h-2 bg-slate-200 rounded-full cursor-pointer mb-2"
          onClick={handleSeek}
        >
          <div
            className="h-full bg-indigo-600 rounded-full transition-all"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>

        {/* Time Display */}
        <div className="flex items-center justify-between text-xs text-slate-500 mb-4">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => skip(-10)}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors"
            title="Rewind 10s"
          >
            <SkipBack size={20} className="text-slate-600" />
          </button>

          <button
            onClick={togglePlayPause}
            className="p-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full transition-colors"
          >
            {isPlaying ? <Pause size={24} /> : <Play size={24} />}
          </button>

          <button
            onClick={() => skip(10)}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors"
            title="Forward 10s"
          >
            <SkipForward size={20} className="text-slate-600" />
          </button>

          <div className="flex items-center gap-2 ml-4">
            <button
              onClick={toggleMute}
              className="p-2 hover:bg-slate-100 rounded-full transition-colors"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <VolumeX size={18} className="text-slate-600" /> : <Volume2 size={18} className="text-slate-600" />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-20"
            />
          </div>

          <div className="flex items-center gap-2 ml-4">
            <span className="text-xs text-slate-500">Speed:</span>
            {[0.5, 0.75, 1, 1.25, 1.5, 2].map(rate => (
              <button
                key={rate}
                onClick={() => handlePlaybackRateChange(rate)}
                className={`px-2 py-1 text-xs rounded ${
                  playbackRate === rate
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {rate}x
              </button>
            ))}
          </div>

          <button
            onClick={handleDownload}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors ml-4"
            title="Download"
          >
            <Download size={18} className="text-slate-600" />
          </button>
        </div>
      </div>

      {/* Transcript */}
      {transcript && (
        <div className="mt-4 p-3 bg-slate-50 rounded border border-slate-200 max-h-48 overflow-y-auto">
          <h4 className="font-semibold text-xs text-slate-700 mb-2">Transcript</h4>
          <p className="text-xs text-slate-600 whitespace-pre-wrap">{transcript}</p>
        </div>
      )}

      {/* Metadata */}
      <div className="mt-4 pt-4 border-t border-slate-200">
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-slate-500">Duration:</span>
            <span className="ml-2 text-slate-700 font-medium">
              {recording.duration ? formatTime(recording.duration / 1000) : 'N/A'}
            </span>
          </div>
          <div>
            <span className="text-slate-500">Session ID:</span>
            <span className="ml-2 text-slate-700 font-mono text-[10px]">{recording.sessionId}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CallPlayback;

