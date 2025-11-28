/**
 * Language Configuration
 * 
 * Provides language-specific configurations including system prompts.
 */

import { SupportedLanguage, LanguageConfig } from '../types';

export const LANGUAGE_CONFIGS: Record<SupportedLanguage, LanguageConfig> = {
  en: {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    systemPrompt: 'You are a helpful and professional customer service assistant. Speak clearly and concisely.'
  },
  es: {
    code: 'es',
    name: 'Spanish',
    nativeName: 'Español',
    systemPrompt: 'Eres un asistente de servicio al cliente útil y profesional. Habla con claridad y concisión.'
  },
  fr: {
    code: 'fr',
    name: 'French',
    nativeName: 'Français',
    systemPrompt: 'Vous êtes un assistant de service client utile et professionnel. Parlez clairement et de manière concise.'
  },
  de: {
    code: 'de',
    name: 'German',
    nativeName: 'Deutsch',
    systemPrompt: 'Sie sind ein hilfreicher und professioneller Kundenservice-Assistent. Sprechen Sie klar und prägnant.'
  },
  zh: {
    code: 'zh',
    name: 'Chinese',
    nativeName: '中文',
    systemPrompt: '你是一个有用且专业的客户服务助手。说话清晰简洁。'
  },
  ja: {
    code: 'ja',
    name: 'Japanese',
    nativeName: '日本語',
    systemPrompt: 'あなたは親切でプロフェッショナルなカスタマーサービスアシスタントです。明確かつ簡潔に話してください。'
  }
};

export function getLanguageConfig(language: SupportedLanguage): LanguageConfig {
  return LANGUAGE_CONFIGS[language] || LANGUAGE_CONFIGS.en;
}

export function getAllLanguages(): LanguageConfig[] {
  return Object.values(LANGUAGE_CONFIGS);
}

