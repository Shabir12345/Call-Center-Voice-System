/**
 * Intent Recognizer
 * 
 * Enhanced intent recognition using LLM or pattern matching.
 * Can be extended to use actual NLU services.
 */

import { ConversationContext } from '../types';
import { GoogleGenAI } from '@google/genai';

/**
 * Intent recognition result
 */
export interface IntentRecognitionResult {
  intent: string;
  task: string;
  parameters: Record<string, any>;
  confidence: number;
  extractedEntities?: Record<string, any>;
}

/**
 * Intent Recognizer class
 */
export class IntentRecognizer {
  private genAI: GoogleGenAI | null = null;
  private apiKey: string | null = null;
  private useLLM: boolean = false;
  private intentPatterns: Map<string, RegExp[]> = new Map();

  constructor(apiKey?: string) {
    if (apiKey) {
      this.apiKey = apiKey;
      this.genAI = new GoogleGenAI({ apiKey });
      this.useLLM = true;
    }
    this.initializePatterns();
  }

  /**
   * Initialize intent patterns for pattern matching
   */
  private initializePatterns(): void {
    // Reservation patterns
    this.intentPatterns.set('confirm_reservation', [
      /confirm.*reservation/i,
      /check.*reservation/i,
      /verify.*reservation/i,
      /my.*reservation/i
    ]);

    this.intentPatterns.set('modify_reservation', [
      /modify.*reservation/i,
      /change.*reservation/i,
      /update.*reservation/i,
      /edit.*reservation/i
    ]);

    this.intentPatterns.set('cancel_reservation', [
      /cancel.*reservation/i,
      /delete.*reservation/i,
      /remove.*reservation/i
    ]);

    // Billing patterns
    this.intentPatterns.set('get_billing_info', [
      /bill/i,
      /billing/i,
      /invoice/i,
      /payment/i,
      /charge/i
    ]);

    // Support patterns
    this.intentPatterns.set('create_support_ticket', [
      /support/i,
      /help/i,
      /issue/i,
      /problem/i,
      /ticket/i
    ]);
  }

  /**
   * Parse intent from caller input
   */
  async parse(
    callerInput: string,
    context: ConversationContext
  ): Promise<IntentRecognitionResult> {
    if (this.useLLM && this.genAI) {
      return await this.parseWithLLM(callerInput, context);
    } else {
      return this.parseWithPatterns(callerInput, context);
    }
  }

  /**
   * Parse intent using LLM
   */
  private async parseWithLLM(
    callerInput: string,
    context: ConversationContext
  ): Promise<IntentRecognitionResult> {
    if (!this.genAI) {
      return this.parseWithPatterns(callerInput, context);
    }

    try {
      const model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

      const prompt = `Analyze the following user input and determine the intent.

User Input: "${callerInput}"

Available Intents:
- confirm_reservation: User wants to confirm or check a reservation
- modify_reservation: User wants to modify or change a reservation
- cancel_reservation: User wants to cancel a reservation
- get_billing_info: User wants billing or payment information
- create_support_ticket: User needs support or wants to create a ticket

Return a JSON object with:
{
  "intent": "intent_name",
  "task": "task_name",
  "parameters": {},
  "confidence": 0.0-1.0,
  "extractedEntities": {}
}

Extract any entities like reservation numbers, names, dates, etc. into extractedEntities.`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Parse JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          intent: parsed.intent || 'unknown',
          task: parsed.task || parsed.intent || 'unknown',
          parameters: parsed.parameters || {},
          confidence: parsed.confidence || 0.5,
          extractedEntities: parsed.extractedEntities || {}
        };
      }

      return this.parseWithPatterns(callerInput, context);

    } catch (error) {
      console.error('LLM intent recognition failed, falling back to patterns:', error);
      return this.parseWithPatterns(callerInput, context);
    }
  }

  /**
   * Parse intent using pattern matching
   */
  private parseWithPatterns(
    callerInput: string,
    context: ConversationContext
  ): IntentRecognitionResult {
    const inputLower = callerInput.toLowerCase();
    let bestMatch: { intent: string; confidence: number } | null = null;

    // Check each intent pattern
    for (const [intent, patterns] of this.intentPatterns.entries()) {
      for (const pattern of patterns) {
        if (pattern.test(callerInput)) {
          const confidence = this.calculatePatternConfidence(callerInput, pattern);
          if (!bestMatch || confidence > bestMatch.confidence) {
            bestMatch = { intent, confidence };
          }
        }
      }
    }

    if (bestMatch) {
      // Extract entities
      const entities = this.extractEntities(callerInput, bestMatch.intent);

      return {
        intent: bestMatch.intent,
        task: bestMatch.intent,
        parameters: entities,
        confidence: bestMatch.confidence,
        extractedEntities: entities
      };
    }

    // Default to unknown
    return {
      intent: 'unknown',
      task: 'unknown',
      parameters: {},
      confidence: 0.1
    };
  }

  /**
   * Calculate pattern match confidence
   */
  private calculatePatternConfidence(input: string, pattern: RegExp): number {
    const match = input.match(pattern);
    if (!match) return 0;

    // Higher confidence for longer matches
    const matchLength = match[0].length;
    const inputLength = input.length;
    return Math.min(0.9, 0.5 + (matchLength / inputLength) * 0.4);
  }

  /**
   * Extract entities from input
   */
  private extractEntities(input: string, intent: string): Record<string, any> {
    const entities: Record<string, any> = {};

    // Extract reservation number (6 alphanumeric characters)
    const reservationMatch = input.match(/\b[A-Z0-9]{6}\b/);
    if (reservationMatch) {
      entities.reservation_number = reservationMatch[0];
    }

    // Extract dates
    const dateMatch = input.match(/\b(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2})\b/);
    if (dateMatch) {
      entities.date = dateMatch[0];
    }

    // Extract amounts/money
    const amountMatch = input.match(/\$?(\d+\.?\d*)/);
    if (amountMatch) {
      entities.amount = parseFloat(amountMatch[1]);
    }

    // Extract account IDs
    const accountMatch = input.match(/account[:\s]+(\w+)/i);
    if (accountMatch) {
      entities.account_id = accountMatch[1];
    }

    return entities;
  }

  /**
   * Add custom intent pattern
   */
  addIntentPattern(intent: string, patterns: RegExp[]): void {
    const existing = this.intentPatterns.get(intent) || [];
    this.intentPatterns.set(intent, [...existing, ...patterns]);
  }
}

