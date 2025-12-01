/**
 * VoiceControls Component
 * 
 * Extracted from TestPanel to improve code organization and reusability.
 * Handles voice call UI controls including start/end call buttons and session duration display.
 */

import React from 'react';
import { Phone, Square, Mic, Zap } from 'lucide-react';

export interface VoiceControlsProps {
  isCallActive: boolean;
  sessionDuration: number;
  apiKeyError: boolean;
  onStartCall: () => void;
  onEndCall: () => void;
  onMute?: () => void;
  isMuted?: boolean;
  disabled?: boolean;
}

/**
 * VoiceControls Component
 * 
 * Displays voice call controls for starting/ending calls and managing session state.
 */
export const VoiceControls: React.FC<VoiceControlsProps> = ({
  isCallActive,
  sessionDuration,
  apiKeyError,
  onStartCall,
  onEndCall,
  onMute,
  isMuted = false,
  disabled = false
}) => {
  // Format session duration as MM:SS
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="p-4 bg-white border-t border-slate-100 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-30">
      {!isCallActive ? (
        <button 
          onClick={onStartCall}
          disabled={apiKeyError || disabled}
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 rounded-xl font-bold shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed transition-all active:scale-[0.98] group"
        >
          <div className="p-1 bg-white/20 rounded-full group-hover:bg-white/30 transition-colors">
            <Phone size={16} className="fill-current" />
          </div>
          Start Simulation
        </button>
      ) : (
        <div className="flex gap-3">
          <button 
            onClick={onEndCall}
            className="flex-1 flex items-center justify-center gap-2 bg-rose-500 hover:bg-rose-600 text-white py-3.5 rounded-xl font-bold shadow-lg shadow-rose-200 transition-all active:scale-[0.98]"
          >
            <Square size={16} fill="currentColor" />
            End Session
          </button>
          {onMute && (
            <button 
              onClick={onMute}
              className={`px-5 rounded-xl flex items-center justify-center transition-colors ${
                isMuted 
                  ? 'bg-rose-100 hover:bg-rose-200 text-rose-600' 
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
              aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              <Mic size={20} className={isMuted ? 'line-through' : ''} />
            </button>
          )}
        </div>
      )}
      
      {/* Session Duration Display */}
      {isCallActive && (
        <div className="flex justify-center mt-3">
          <span className="text-xs font-medium text-slate-600 flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
            <span className="text-[10px] text-slate-400">Duration:</span>
            <span className="font-mono font-bold">{formatDuration(sessionDuration)}</span>
          </span>
        </div>
      )}
      
      {/* Powered by Gemini Badge */}
      <div className="flex justify-center mt-3">
        <span className="text-[9px] font-medium text-slate-400 flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
          <Zap size={8} className="text-amber-400 fill-current" />
          Powered by Gemini 2.5 Flash
        </span>
      </div>
    </div>
  );
};

