/**
 * useVoiceSession Hook
 * 
 * Custom hook for managing voice session state and lifecycle.
 * Extracted from TestPanel to improve code organization and reusability.
 * 
 * Handles:
 * - Voice call state (active/inactive)
 * - Session duration tracking
 * - Audio context management
 * - Gemini client lifecycle
 * - Cleanup on unmount
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { GeminiClient } from '../utils/geminiClient';

export interface VoiceSessionState {
  isCallActive: boolean;
  sessionDuration: number;
  activeAgentId: string | null;
}

export interface VoiceSessionCallbacks {
  onCallStart?: () => void;
  onCallEnd?: () => void;
  onError?: (error: Error) => void;
}

export interface UseVoiceSessionOptions {
  apiKey?: string;
  callbacks?: VoiceSessionCallbacks;
}

export const useVoiceSession = (options: UseVoiceSessionOptions = {}) => {
  const { apiKey, callbacks } = options;
  
  const [isCallActive, setIsCallActive] = useState(false);
  const [sessionDuration, setSessionDuration] = useState(0);
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null);
  
  const geminiRef = useRef<GeminiClient | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const animationRef = useRef<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      endCall();
    };
  }, []);

  /**
   * Start a voice call session
   */
  const startCall = useCallback(async (masterNodeId: string, establishSessionFn: (nodeId: string, isHandoff: boolean) => Promise<void>) => {
    if (!apiKey) {
      callbacks?.onError?.(new Error('API key not provided'));
      return;
    }

    if (isCallActive) {
      return; // Already active
    }

    // Check microphone permissions
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop()); // Release immediately
    } catch (e) {
      const error = new Error('Microphone permission denied or unavailable');
      callbacks?.onError?.(error);
      return;
    }

    setIsCallActive(true);
    setSessionDuration(0);
    setActiveAgentId(masterNodeId);

    // Start duration timer
    durationIntervalRef.current = setInterval(() => {
      setSessionDuration(prev => prev + 1);
    }, 1000);

    // Initialize audio context
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    audioContextRef.current = new AudioContextClass({ sampleRate: 24000 });
    nextStartTimeRef.current = audioContextRef.current.currentTime;
    
    const analyser = audioContextRef.current.createAnalyser();
    analyser.fftSize = 256;
    analyserRef.current = analyser;

    try {
      await establishSessionFn(masterNodeId, false);
      callbacks?.onCallStart?.();
    } catch (err) {
      console.error("Session failed:", err);
      callbacks?.onError?.(err instanceof Error ? err : new Error('Session establishment failed'));
      endCall();
    }
  }, [apiKey, isCallActive, callbacks]);

  /**
   * End the voice call session
   */
  const endCall = useCallback(() => {
    // Disconnect Gemini client
    if (geminiRef.current) {
      geminiRef.current.disconnect();
      geminiRef.current = null;
    }

    // Clear duration interval
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    // Close audio context
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch (e) {
        // Ignore errors on close
      }
      audioContextRef.current = null;
    }

    // Cancel animation frame
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = 0;
    }

    setIsCallActive(false);
    setActiveAgentId(null);
    setSessionDuration(0);
    
    callbacks?.onCallEnd?.();
  }, [callbacks]);

  /**
   * Get current session state
   */
  const getSessionState = useCallback((): VoiceSessionState => {
    return {
      isCallActive,
      sessionDuration,
      activeAgentId
    };
  }, [isCallActive, sessionDuration, activeAgentId]);

  return {
    // State
    isCallActive,
    sessionDuration,
    activeAgentId,
    
    // Refs (exposed for external use if needed)
    geminiRef,
    audioContextRef,
    analyserRef,
    nextStartTimeRef,
    
    // Methods
    startCall,
    endCall,
    getSessionState,
    setActiveAgentId
  };
};

