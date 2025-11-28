/**
 * Language Detector
 * 
 * Automatically detects the language of user input.
 */

import { SupportedLanguage, LanguageConfig } from '../types';

export class LanguageDetector {
  private languagePatterns: Map<SupportedLanguage, RegExp[]> = new Map([
    ['en', [
      /\b(the|and|or|but|in|on|at|to|for|of|with|by)\b/gi,
      /\b(is|are|was|were|be|been|being)\b/gi,
      /\b(you|your|yours|we|our|ours|they|their|theirs)\b/gi
    ]],
    ['es', [
      /\b(el|la|los|las|un|una|unos|unas)\b/gi,
      /\b(es|son|era|eran|ser|estar)\b/gi,
      /\b(tú|tu|tus|nosotros|nuestro|ellos|su|sus)\b/gi,
      /\b(que|de|a|en|por|para|con|sin)\b/gi
    ]],
    ['fr', [
      /\b(le|la|les|un|une|des|du|de|des)\b/gi,
      /\b(est|sont|était|étaient|être|avoir)\b/gi,
      /\b(vous|votre|nos|notre|ils|leur|leurs)\b/gi,
      /\b(que|de|à|en|par|pour|avec|sans)\b/gi
    ]],
    ['de', [
      /\b(der|die|das|ein|eine|einen|eines)\b/gi,
      /\b(ist|sind|war|waren|sein|haben)\b/gi,
      /\b(du|dein|deine|wir|unser|ihr|ihre)\b/gi,
      /\b(und|oder|aber|in|auf|mit|von|zu)\b/gi
    ]],
    ['zh', [
      /[\u4e00-\u9fff]/g,
      /\b(的|了|在|是|我|你|他|她|它|我们|你们|他们)\b/g
    ]],
    ['ja', [
      /[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/g,
      /\b(の|は|が|を|に|へ|と|で|から|まで)\b/g
    ]]
  ]);

  /**
   * Detect language from text
   */
  detectLanguage(text: string): { language: SupportedLanguage; confidence: number } {
    const scores: Map<SupportedLanguage, number> = new Map();
    
    // Initialize scores
    (['en', 'es', 'fr', 'de', 'zh', 'ja'] as SupportedLanguage[]).forEach(lang => {
      scores.set(lang, 0);
    });

    const lowerText = text.toLowerCase();
    const words = lowerText.split(/\s+/);
    const totalWords = words.length;

    // Score each language
    this.languagePatterns.forEach((patterns, language) => {
      let score = 0;
      patterns.forEach(pattern => {
        const matches = lowerText.match(pattern);
        if (matches) {
          score += matches.length;
        }
      });
      scores.set(language, score);
    });

    // Find language with highest score
    let maxScore = 0;
    let detectedLanguage: SupportedLanguage = 'en';
    
    scores.forEach((score, language) => {
      if (score > maxScore) {
        maxScore = score;
        detectedLanguage = language;
      }
    });

    // Calculate confidence (simple heuristic)
    const confidence = totalWords > 0 
      ? Math.min(1, maxScore / (totalWords * 0.3))
      : 0.5;

    return {
      language: detectedLanguage,
      confidence: Math.max(0.3, confidence) // Minimum 30% confidence
    };
  }

  /**
   * Detect language with fallback
   */
  detectLanguageWithFallback(text: string, fallback: SupportedLanguage = 'en'): SupportedLanguage {
    const result = this.detectLanguage(text);
    return result.confidence > 0.5 ? result.language : fallback;
  }
}

