/**
 * Translator
 * 
 * Translates text between languages using LLM-based translation.
 */

import { SupportedLanguage } from '../types';
import { GoogleGenAI } from '@google/genai';

export class Translator {
  private aiClient: GoogleGenAI | null = null;
  private apiKey?: string;

  constructor(apiKey?: string) {
    if (apiKey) {
      this.apiKey = apiKey;
      this.aiClient = new GoogleGenAI({ apiKey });
    }
  }

  /**
   * Translate text from one language to another
   */
  async translate(
    text: string,
    targetLanguage: SupportedLanguage,
    sourceLanguage?: SupportedLanguage
  ): Promise<string> {
    if (!this.aiClient || !this.apiKey) {
      console.warn('Translation API key not provided, returning original text');
      return text;
    }

    try {
      const targetLangName = this.getLanguageName(targetLanguage);
      const sourceLangName = sourceLanguage ? this.getLanguageName(sourceLanguage) : 'auto-detect';

      const model = this.aiClient.models.generateContent({
        model: 'gemini-2.0-flash-exp',
        contents: [{
          role: 'user',
          parts: [{
            text: `Translate the following text from ${sourceLangName} to ${targetLangName}. Only return the translated text, no explanations or additional text.

Text to translate: "${text}"`
          }]
        }]
      });

      const response = await model.response;
      return response.text().trim();
    } catch (error) {
      console.error('Translation error:', error);
      return text; // Return original on error
    }
  }

  /**
   * Get language name
   */
  private getLanguageName(language: SupportedLanguage): string {
    const names: Record<SupportedLanguage, string> = {
      en: 'English',
      es: 'Spanish',
      fr: 'French',
      de: 'German',
      zh: 'Chinese',
      ja: 'Japanese'
    };
    return names[language] || 'English';
  }
}

