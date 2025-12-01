/**
 * Google Gemini Live API Client
 * 
 * Handles WebSocket connection via SDK, Audio streaming (In/Out), and Tool Definitions.
 * 
 * This client manages the real-time voice communication with Google's Gemini Live API,
 * including audio input/output streaming, transcription, and tool call handling.
 * 
 * Architecture:
 * - Uses WebSocket connection for real-time bidirectional communication
 * - Handles audio encoding/decoding (PCM format, 16kHz sample rate)
 * - Manages tool call lifecycle (request -> execution -> response)
 * - Provides transcription callbacks for both user and model speech
 */
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { RateLimiter, RateLimitConfig, RateLimitError } from './rateLimiter';
import { CircuitBreaker, CircuitState } from './circuitBreaker';

export interface GeminiConfig {
  apiKey: string;
  voiceName: string;
  systemInstruction: string;
  tools?: any[];
  // Optional resilience features
  rateLimiter?: RateLimiter;
  rateLimitConfig?: RateLimitConfig;
  circuitBreaker?: CircuitBreaker;
  onRateLimit?: (retryAfter: number) => void;
  onCircuitOpen?: () => void;
}

export interface ToolCallResponse {
    id: string;
    result: any;
}

export class GeminiClient {
  private client: GoogleGenAI;
  private session: any = null;
  private config: GeminiConfig;
  private audioContext: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private inputSource: MediaStreamAudioSourceNode | null = null;
  private isSessionOpen: boolean = false;
  private sessionOpenPromise: Promise<void> | null = null;
  private sessionOpenResolver: (() => void) | null = null;
  private isDisconnecting: boolean = false;
  
  // Resilience features
  private rateLimiter?: RateLimiter;
  private circuitBreaker?: CircuitBreaker;
  private readonly RATE_LIMIT_IDENTIFIER = 'gemini_api';
  
  public onAudioData: ((audioData: ArrayBuffer) => void) | null = null;
  // Updated signature: returns Promise with results to send back to model
  public onToolCall: ((toolCalls: any[]) => Promise<ToolCallResponse[]>) | null = null;
  public onDisconnect: (() => void) | null = null;
  
  // New Transcription Callback
  public onTranscription: ((text: string, role: 'user' | 'model', isFinal: boolean) => void) | null = null;

  constructor(config: GeminiConfig) {
    this.config = config;
    this.client = new GoogleGenAI({ apiKey: config.apiKey });
    
    // Initialize rate limiter if provided
    if (config.rateLimiter) {
      this.rateLimiter = config.rateLimiter;
    }
    
    // Initialize circuit breaker if provided
    if (config.circuitBreaker) {
      this.circuitBreaker = config.circuitBreaker;
      
      // Set up circuit breaker callbacks
      // IMPORTANT: Save the original getState method before overriding to avoid infinite recursion
      if (config.onCircuitOpen) {
        const originalGetState = this.circuitBreaker.getState.bind(this.circuitBreaker);
        this.circuitBreaker.getState = () => {
          const state = originalGetState();
          if (state === CircuitState.OPEN && config.onCircuitOpen) {
            config.onCircuitOpen();
          }
          return state;
        };
      }
    }
  }

  async connect() {
    // Check rate limit before connecting
    if (this.rateLimiter) {
      const rateLimitResult = this.rateLimiter.check(
        this.RATE_LIMIT_IDENTIFIER,
        this.config.rateLimitConfig
      );
      
      if (!rateLimitResult.allowed) {
        const error = new RateLimitError(
          `Gemini API rate limit exceeded. Retry after ${rateLimitResult.retryAfter} seconds.`,
          rateLimitResult
        );
        
        if (this.config.onRateLimit) {
          this.config.onRateLimit(rateLimitResult.retryAfter || 60);
        }
        
        throw error;
      }
    }

    // Check circuit breaker
    if (this.circuitBreaker) {
      const state = this.circuitBreaker.getState();
      if (state === CircuitState.OPEN) {
        if (this.config.onCircuitOpen) {
          this.config.onCircuitOpen();
        }
        throw new Error('Circuit breaker is OPEN - Gemini API unavailable');
      }
    }

    const config: any = {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: this.config.voiceName
          }
        }
      },
      // Strictly format systemInstruction as Content to avoid handshake errors
      systemInstruction: { parts: [{ text: this.config.systemInstruction }] },
      // Enable Transcriptions
      inputAudioTranscription: {},
      outputAudioTranscription: {}
    };

    // Only include tools if they exist and are not empty
    if (this.config.tools && this.config.tools.length > 0) {
      config.tools = [{ functionDeclarations: this.config.tools }];
    }

    // Create a promise that resolves when the session is open
    this.sessionOpenPromise = new Promise((resolve) => {
      this.sessionOpenResolver = resolve;
    });
    this.isSessionOpen = false;

    try {
        // Wrap connection in circuit breaker if available
        const connectFn = async () => {
          const session = await this.client.live.connect({
            model: 'gemini-2.5-flash-native-audio-preview-09-2025',
            callbacks: {
              onopen: () => {
                console.log('Gemini Live Connected');
                // Log session object structure for debugging
                if (this.session) {
                  console.log('Session object methods:', Object.keys(this.session));
                  console.log('Session object:', this.session);
                }
                this.isSessionOpen = true;
                if (this.sessionOpenResolver) {
                  this.sessionOpenResolver();
                  this.sessionOpenResolver = null;
                }
              },
              onmessage: (message: LiveServerMessage) => {
                this.handleMessage(message);
              },
              onclose: (event) => {
                console.log('Gemini Live Closed');
                console.log('Close event:', event);
                this.isSessionOpen = false;
                this.isDisconnecting = true;
                // Log close reason if available
                if (event) {
                  console.log('Close event details:', {
                    code: event.code,
                    reason: event.reason,
                    wasClean: event.wasClean
                  });
                } else {
                  console.log('Close event is null/undefined');
                }
                // Log stack trace to see what triggered the close
                console.trace('Connection closed from:');
                if (this.onDisconnect) this.onDisconnect();
              },
              onerror: (err) => {
                console.error('Gemini Live Error:', err);
                this.isSessionOpen = false;
                // Log more details about the error
                if (err instanceof Error) {
                  console.error('Error details:', err.message, err.stack);
                } else {
                  console.error('Error object:', JSON.stringify(err, null, 2));
                }
              }
            },
            config: config
          });
          return session;
        };

        // Execute with circuit breaker if available
        if (this.circuitBreaker) {
          this.session = await this.circuitBreaker.execute(
            connectFn,
            () => {
              // Fallback: throw error
              throw new Error('Circuit breaker: Gemini API connection failed - service unavailable');
            }
          );
        } else {
          this.session = await connectFn();
        }
        
        // Wait for the session to be fully open before returning
        await this.sessionOpenPromise;
    } catch (err) {
        console.error("Gemini Connect Error:", err);
        this.isSessionOpen = false;
        
        // Report to circuit breaker if available
        if (this.circuitBreaker && err instanceof Error) {
          // Circuit breaker tracks failures automatically in execute()
        }
        
        throw err;
    }
  }

  private async handleMessage(message: LiveServerMessage) {
    // 1. Handle Audio (serverContent)
    const part = message.serverContent?.modelTurn?.parts?.[0];
    if (part?.inlineData?.data) {
      const base64Audio = part.inlineData.data;
      const audioData = this.base64ToArrayBuffer(base64Audio);
      if (this.onAudioData) {
        this.onAudioData(audioData);
      }
    }

    // 2. Handle Transcription
    // User Input Transcription
    if (message.serverContent?.inputTranscription) {
        const text = message.serverContent.inputTranscription.text;
        if (text && this.onTranscription) {
            this.onTranscription(text, 'user', true); 
        }
    }
    
    // Model Output Transcription
    if (message.serverContent?.outputTranscription) {
        const text = message.serverContent.outputTranscription.text;
        if (text && this.onTranscription) {
            // Send chunk with isFinal=false so UI accumulates it
            this.onTranscription(text, 'model', false); 
        }
    }

    // 3. Handle Turn Complete (Flush Model Transcript)
    if (message.serverContent?.turnComplete) {
        if (this.onTranscription) {
             // Send empty text with isFinal=true to signal UI to log the accumulated text
             this.onTranscription("", 'model', true);
        }
    }
    
    // Handle Interruption (Flush what we have)
    if (message.serverContent?.interrupted) {
        if (this.onTranscription) {
             this.onTranscription("", 'model', true);
        }
    }

    // 4. Handle Tool Calls
    if (message.toolCall) {
        let functionResponses: any[] = [];

        if (this.onToolCall) {
            // Wait for host application to process logic (visuals, DB lookups, etc)
            const results = await this.onToolCall(message.toolCall.functionCalls);
            
            // Map results back to the structure Gemini expects
            functionResponses = results.map(r => ({
                id: r.id,
                name: message.toolCall?.functionCalls.find((fc: any) => fc.id === r.id)?.name,
                response: { result: r.result }
            }));
        } else {
            // Fallback if no handler
            functionResponses = message.toolCall.functionCalls.map((fc: any) => ({
                id: fc.id,
                name: fc.name,
                response: { result: { status: "ok" } } 
            }));
        }
        
        // Send data back to Gemini so it can generate the spoken response
        this.session.sendToolResponse({
            functionResponses: functionResponses
        });
    }
  }

  // --- Send Text (Trigger) ---
  async sendText(text: string) {
      // Check rate limit before sending
      if (this.rateLimiter) {
        const rateLimitResult = this.rateLimiter.check(
          this.RATE_LIMIT_IDENTIFIER,
          this.config.rateLimitConfig
        );
        
        if (!rateLimitResult.allowed) {
          if (this.config.onRateLimit) {
            this.config.onRateLimit(rateLimitResult.retryAfter || 60);
          }
          throw new RateLimitError(
            `Rate limit exceeded. Retry after ${rateLimitResult.retryAfter} seconds.`,
            rateLimitResult
          );
        }
      }

      // Ensure session is active and open before sending
      if (!this.session) {
          console.warn("Session not ready");
          return;
      }

      // Wait for session to be fully open if not already
      if (!this.isSessionOpen && this.sessionOpenPromise) {
          console.log('Waiting for session to be fully open before sending text...');
          await this.sessionOpenPromise;
      }

      if (!this.isSessionOpen) {
          console.warn("Session not open, cannot send text");
          return;
      }

      try {
        // Wrap send in circuit breaker if available
        const sendFn = async () => {
          // Try the send method first (similar to audio handling)
          if (typeof this.session.send === 'function') {
              this.session.send([{ text: text }], true);
          } else if (typeof this.session.sendRealtimeInput === 'function') {
              // Fallback to sendRealtimeInput if send doesn't work
              this.session.sendRealtimeInput({
                  text: text
              });
          } else {
              // Log available methods for debugging
              const availableMethods = Object.keys(this.session).filter(key => typeof this.session[key] === 'function');
              console.error('No valid send method found on session. Available methods:', availableMethods);
              console.error('Session object:', this.session);
              throw new Error('No valid send method found on session');
          }
        };

        // Execute with circuit breaker if available
        if (this.circuitBreaker) {
          await this.circuitBreaker.execute(
            sendFn,
            () => {
              throw new Error('Circuit breaker: Cannot send text - service unavailable');
            }
          );
        } else {
          await sendFn();
        }
      } catch (e) {
          console.error("Failed to send text to Live Session:", e);
          // Log more details about the error
          if (e instanceof Error) {
              console.error('Error details:', e.message, e.stack);
          } else {
              console.error('Error object:', JSON.stringify(e, null, 2));
          }
          throw e; // Re-throw so caller knows it failed
      }
  }

  // --- Audio Input Handling ---

  async startRecording() {
    if (!this.session) {
      console.error('Cannot start recording: Session not connected');
      throw new Error('Session not connected');
    }
    
    // Wait for session to be open if not already
    if (!this.isSessionOpen && this.sessionOpenPromise) {
      console.log('Waiting for session to be fully open...');
      await this.sessionOpenPromise;
    }
    
    if (!this.isSessionOpen) {
      console.error('Cannot start recording: Session not open');
      throw new Error('Session not open');
    }

    // Add a small delay to ensure session is fully ready
    console.log('Session is open, waiting 100ms before starting audio...');
    await new Promise(resolve => setTimeout(resolve, 100));

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    // Note: We try to ask for 16000, but browser might reject or ignore. We must check actual rate.
    this.audioContext = new AudioContextClass({ sampleRate: 16000 }); 
    
    try {
      // Get stream
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, sampleRate: 16000 } });
      
      await this.audioContext.resume();

      this.inputSource = this.audioContext.createMediaStreamSource(this.stream);
      
      // Use ScriptProcessor as per Google GenAI guidelines example
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
      
      const sourceSampleRate = this.audioContext.sampleRate;
      const targetSampleRate = 16000;

      this.processor.onaudioprocess = (e) => {
        // Check session validity first
        if (!this.session || !this.isSessionOpen || this.isDisconnecting) {
          if (this.isDisconnecting) {
            console.warn('Session is disconnecting, skipping audio chunk');
          } else {
            console.warn('Session not ready, skipping audio chunk');
          }
          return;
        }

        const inputData = e.inputBuffer.getChannelData(0);
        
        // Robust Downsampling: Ensure we always send 16kHz to Gemini
        let finalData = inputData;
        if (sourceSampleRate !== targetSampleRate) {
            finalData = this.downsampleBuffer(inputData, sourceSampleRate, targetSampleRate);
        }

        // Convert Float32 to Int16 PCM
        const pcmData = this.floatTo16BitPCM(finalData);
        const base64Audio = this.arrayBufferToBase64(pcmData);
        
        try {
          // Try the send method first (similar to sendText)
          if (typeof this.session.send === 'function') {
            this.session.send([{
              media: {
                mimeType: "audio/pcm;rate=16000",
                data: base64Audio
              }
            }], false); // false = not final chunk
          } else if (typeof this.session.sendRealtimeInput === 'function') {
            // Fallback to sendRealtimeInput if send doesn't work
            this.session.sendRealtimeInput({ 
                media: {
                    mimeType: "audio/pcm;rate=16000",
                    data: base64Audio
                }
            });
          } else {
            console.error('No valid send method found on session. Available methods:', Object.keys(this.session));
          }
        } catch (error) {
          console.error('Error sending audio to Gemini:', error);
          console.error('Error details:', {
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            sessionState: {
              hasSession: !!this.session,
              isOpen: this.isSessionOpen,
              sessionType: typeof this.session
            }
          });
          // Don't disconnect on error, just log it
        }
      };

      this.inputSource.connect(this.processor);
      // Create a dummy destination to avoid feedback - don't connect to actual speakers
      // ScriptProcessorNode requires a destination, so we use a GainNode with 0 gain
      const dummyGain = this.audioContext.createGain();
      dummyGain.gain.value = 0; // Mute the output
      this.processor.connect(dummyGain);
      dummyGain.connect(this.audioContext.destination);
    } catch (error) {
      console.error('Error starting recording:', error);
      // Clean up on error
      this.stopRecording();
      throw error;
    }
  }

  stopRecording() {
    if (this.processor) {
        this.processor.disconnect();
        this.processor.onaudioprocess = null;
        this.processor = null;
    }
    if (this.inputSource) {
        this.inputSource.disconnect();
        this.inputSource = null;
    }
    if (this.stream) {
        this.stream.getTracks().forEach(track => track.stop());
        this.stream = null;
    }
    if (this.audioContext) {
        this.audioContext.close();
        this.audioContext = null;
    }
  }

  disconnect() {
    this.isDisconnecting = true;
    this.stopRecording();
    this.isSessionOpen = false;
    if (this.session) {
        try {
            this.session.close();
        } catch (e) {
            console.warn("Error closing Gemini session:", e);
        }
        this.session = null;
    }
    // Reset session open promise
    this.sessionOpenPromise = null;
    this.sessionOpenResolver = null;
    this.isDisconnecting = false;
  }

  // --- Helpers ---

  private downsampleBuffer(buffer: Float32Array, sampleRate: number, outSampleRate: number): Float32Array {
    if (outSampleRate === sampleRate) {
      return buffer;
    }
    if (outSampleRate > sampleRate) {
      // Upsampling not supported in this simple implementation
      return buffer;
    }
    const sampleRateRatio = sampleRate / outSampleRate;
    const newLength = Math.round(buffer.length / sampleRateRatio);
    const result = new Float32Array(newLength);
    let offsetResult = 0;
    let offsetBuffer = 0;
    while (offsetResult < result.length) {
      const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
      // Use average value of skipped samples
      let accum = 0, count = 0;
      for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
        accum += buffer[i];
        count++;
      }
      result[offsetResult] = count > 0 ? accum / count : 0; // Simple averaging (decimation + LPF ish)
      offsetResult++;
      offsetBuffer = nextOffsetBuffer;
    }
    return result;
  }

  private floatTo16BitPCM(output: Float32Array) {
    const buffer = new ArrayBuffer(output.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < output.length; i++) {
      let s = Math.max(-1, Math.min(1, output[i]));
      view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
    return buffer;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  private base64ToArrayBuffer(base64: string) {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Get rate limit status for Gemini API
   */
  getRateLimitStatus(): { allowed: boolean; remaining: number; resetTime: number; retryAfter?: number } | null {
    if (!this.rateLimiter) {
      return null;
    }
    
    const result = this.rateLimiter.check(this.RATE_LIMIT_IDENTIFIER, this.config.rateLimitConfig);
    return {
      allowed: result.allowed,
      remaining: result.remaining,
      resetTime: result.resetTime,
      retryAfter: result.retryAfter
    };
  }

  /**
   * Get circuit breaker status
   */
  getCircuitBreakerStatus(): { state: string; stats?: any } | null {
    if (!this.circuitBreaker) {
      return null;
    }
    
    return {
      state: this.circuitBreaker.getState(),
      stats: this.circuitBreaker.getStats()
    };
  }
}