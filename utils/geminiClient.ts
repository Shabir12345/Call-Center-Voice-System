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

export interface GeminiConfig {
  apiKey: string;
  voiceName: string;
  systemInstruction: string;
  tools?: any[];
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
  
  public onAudioData: ((audioData: ArrayBuffer) => void) | null = null;
  // Updated signature: returns Promise with results to send back to model
  public onToolCall: ((toolCalls: any[]) => Promise<ToolCallResponse[]>) | null = null;
  public onDisconnect: (() => void) | null = null;
  
  // New Transcription Callback
  public onTranscription: ((text: string, role: 'user' | 'model', isFinal: boolean) => void) | null = null;

  constructor(config: GeminiConfig) {
    this.config = config;
    this.client = new GoogleGenAI({ apiKey: config.apiKey });
  }

  async connect() {
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

    try {
        this.session = await this.client.live.connect({
          model: 'gemini-2.5-flash-native-audio-preview-09-2025',
          callbacks: {
            onopen: () => {
              console.log('Gemini Live Connected');
            },
            onmessage: (message: LiveServerMessage) => {
              this.handleMessage(message);
            },
            onclose: () => {
              console.log('Gemini Live Closed');
              if (this.onDisconnect) this.onDisconnect();
            },
            onerror: (err) => {
              console.error('Gemini Live Error:', err);
            }
          },
          config: config
        });
    } catch (err) {
        console.error("Gemini Connect Error:", err);
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
      // Ensure session is active before sending
      if (this.session) {
          try {
             // In the new Live API, we might need to send text as a "user turn" or "client content"
             // However, for system triggers (like prompts), we often use send() with text parts.
             this.session.send([{ text: text }], true); 
          } catch (e) {
              console.warn("Failed to send text to Live Session:", e);
          }
      } else {
          console.warn("Session not ready or send method missing");
      }
  }

  // --- Audio Input Handling ---

  async startRecording() {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    // Note: We try to ask for 16000, but browser might reject or ignore. We must check actual rate.
    this.audioContext = new AudioContextClass({ sampleRate: 16000 }); 
    
    // Get stream
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, sampleRate: 16000 } });
    
    await this.audioContext.resume();

    this.inputSource = this.audioContext.createMediaStreamSource(this.stream);
    
    // Use ScriptProcessor as per Google GenAI guidelines example
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
    
    const sourceSampleRate = this.audioContext.sampleRate;
    const targetSampleRate = 16000;

    this.processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      
      // Robust Downsampling: Ensure we always send 16kHz to Gemini
      let finalData = inputData;
      if (sourceSampleRate !== targetSampleRate) {
          finalData = this.downsampleBuffer(inputData, sourceSampleRate, targetSampleRate);
      }

      // Convert Float32 to Int16 PCM
      const pcmData = this.floatTo16BitPCM(finalData);
      const base64Audio = this.arrayBufferToBase64(pcmData);
      
      // Check session validity inside the loop to avoid stale closure issues or race conditions
      if (this.session) {
        this.session.sendRealtimeInput({ 
            media: {
                mimeType: "audio/pcm;rate=16000",
                data: base64Audio
            }
        });
      }
    };

    this.inputSource.connect(this.processor);
    this.processor.connect(this.audioContext.destination);
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
    this.stopRecording();
    if (this.session) {
        try {
            this.session.close();
        } catch (e) {
            console.warn("Error closing Gemini session:", e);
        }
        this.session = null;
    }
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
}