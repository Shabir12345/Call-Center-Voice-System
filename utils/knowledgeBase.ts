/**
 * Knowledge Base Manager
 * 
 * Manages knowledge base articles and provides search functionality.
 */

import { KnowledgeBaseArticle } from '../types';

export interface SearchResult {
  article: KnowledgeBaseArticle;
  score: number;
  matchedSnippets?: string[];
}

export type SearchType = 'keyword' | 'vector';

export class KnowledgeBaseManager {
  private articles: Map<string, KnowledgeBaseArticle> = new Map();
  private searchType: SearchType = 'keyword';

  /**
   * Add article to knowledge base
   */
  addArticle(article: KnowledgeBaseArticle): void {
    this.articles.set(article.id, article);
    if (article.views === undefined) {
      article.views = 0;
    }
  }

  /**
   * Get article by ID
   */
  getArticle(articleId: string): KnowledgeBaseArticle | null {
    return this.articles.get(articleId) || null;
  }

  /**
   * Search articles
   */
  search(query: string, options?: {
    limit?: number;
    category?: string;
    tags?: string[];
  }): SearchResult[] {
    const results: SearchResult[] = [];
    const lowerQuery = query.toLowerCase();
    const queryWords = lowerQuery.split(/\s+/).filter(w => w.length > 2);

    this.articles.forEach(article => {
      // Category filter
      if (options?.category && article.category !== options.category) {
        return;
      }

      // Tags filter
      if (options?.tags && options.tags.length > 0) {
        const hasTag = options.tags.some(tag => article.tags?.includes(tag));
        if (!hasTag) return;
      }

      let score = 0;
      const matchedSnippets: string[] = [];

      // Title match (higher weight)
      const titleLower = article.title.toLowerCase();
      queryWords.forEach(word => {
        if (titleLower.includes(word)) {
          score += 3;
          if (!matchedSnippets.includes(article.title)) {
            matchedSnippets.push(article.title);
          }
        }
      });

      // Content match
      const contentLower = article.content.toLowerCase();
      queryWords.forEach(word => {
        const matches = (contentLower.match(new RegExp(word, 'g')) || []).length;
        score += matches;
        
        // Extract snippet around match
        const index = contentLower.indexOf(word);
        if (index >= 0) {
          const start = Math.max(0, index - 50);
          const end = Math.min(contentLower.length, index + word.length + 50);
          const snippet = article.content.substring(start, end);
          if (!matchedSnippets.includes(snippet)) {
            matchedSnippets.push(snippet);
          }
        }
      });

      // Tags match
      if (article.tags) {
        article.tags.forEach(tag => {
          if (lowerQuery.includes(tag.toLowerCase())) {
            score += 2;
          }
        });
      }

      if (score > 0) {
        results.push({
          article,
          score,
          matchedSnippets: matchedSnippets.slice(0, 3) // Limit snippets
        });
      }
    });

    // Sort by score (descending)
    results.sort((a, b) => b.score - a.score);

    // Increment views for top results
    results.slice(0, 5).forEach(result => {
      if (result.article.views !== undefined) {
        result.article.views++;
      }
    });

    return options?.limit ? results.slice(0, options.limit) : results;
  }

  /**
   * Get all articles
   */
  getAllArticles(): KnowledgeBaseArticle[] {
    return Array.from(this.articles.values());
  }

  /**
   * Get articles by category
   */
  getArticlesByCategory(category: string): KnowledgeBaseArticle[] {
    return Array.from(this.articles.values()).filter(a => a.category === category);
  }

  /**
   * Delete article
   */
  deleteArticle(articleId: string): boolean {
    return this.articles.delete(articleId);
  }

  /**
   * Update article
   */
  updateArticle(articleId: string, updates: Partial<KnowledgeBaseArticle>): boolean {
    const article = this.articles.get(articleId);
    if (!article) return false;

    this.articles.set(articleId, {
      ...article,
      ...updates,
      lastUpdated: Date.now()
    });
    return true;
  }

  /**
   * Set search type
   */
  setSearchType(type: SearchType): void {
    this.searchType = type;
  }

  /**
   * Get search type
   */
  getSearchType(): SearchType {
    return this.searchType;
  }
}

