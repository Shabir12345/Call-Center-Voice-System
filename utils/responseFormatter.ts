/**
 * Response Formatter
 * 
 * Formats sub-agent responses into natural language for callers.
 * Can use LLM for advanced formatting or templates for simple cases.
 */

import { NormalizedResponse } from '../types';
import { GoogleGenAI } from '@google/genai';

/**
 * Response formatting options
 */
export interface FormattingOptions {
  style?: 'concise' | 'detailed' | 'friendly' | 'professional';
  includeDetails?: boolean;
  useLLM?: boolean;
  llmApiKey?: string;
}

/**
 * Response Formatter class
 */
export class ResponseFormatter {
  private genAI: GoogleGenAI | null = null;
  private useLLM: boolean = false;

  constructor(apiKey?: string) {
    if (apiKey) {
      this.genAI = new GoogleGenAI({ apiKey });
      this.useLLM = true;
    }
  }

  /**
   * Format response for caller
   */
  async formatResponse(
    response: NormalizedResponse,
    options: FormattingOptions = {}
  ): Promise<string> {
    const {
      style = 'professional',
      includeDetails = true,
      useLLM = this.useLLM
    } = options;

    if (useLLM && this.genAI && response.status === 'success') {
      return await this.formatWithLLM(response, style);
    }

    return this.formatWithTemplates(response, style, includeDetails);
  }

  /**
   * Format using LLM
   */
  private async formatWithLLM(
    response: NormalizedResponse,
    style: string
  ): Promise<string> {
    if (!this.genAI) {
      return this.formatWithTemplates(response, style);
    }

    try {
      const model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

      const prompt = `Format the following response data into a natural, conversational message for a caller.

Style: ${style}
Data: ${JSON.stringify(response.data, null, 2)}

Return only the formatted message, no JSON or code blocks.`;

      const result = await model.generateContent(prompt);
      const text = await result.response.text();
      return text.trim();

    } catch (error) {
      console.error('LLM formatting failed, using templates:', error);
      return this.formatWithTemplates(response, style);
    }
  }

  /**
   * Format using templates
   */
  private formatWithTemplates(
    response: NormalizedResponse,
    style: string,
    includeDetails: boolean
  ): string {
    if (response.status === 'success') {
      return this.formatSuccessResponse(response.data, style, includeDetails);
    } else if (response.status === 'needs_info') {
      return this.formatNeedsInfoResponse(response, style);
    } else if (response.status === 'error') {
      return this.formatErrorResponse(response.error, style);
    }

    return "I'm not sure how to respond to that. Can you rephrase?";
  }

  /**
   * Format success response
   */
  private formatSuccessResponse(
    data: any,
    style: string,
    includeDetails: boolean
  ): string {
    // Reservation confirmation
    if (data?.reservation) {
      const res = data.reservation;
      const messages: Record<string, string> = {
        concise: `Reservation ${res.number} confirmed for ${res.date}.`,
        detailed: `Great! I've confirmed your reservation ${res.number}. You have a ${res.room_type || 'room'} reserved for ${res.date}${res.check_out ? ` through ${res.check_out}` : ''}.${res.check_in ? ` Check-in is at ${new Date(res.check_in).toLocaleTimeString()}` : ''}.`,
        friendly: `Perfect! Your reservation ${res.number} is all set for ${res.date}. You're booked for a ${res.room_type || 'room'}. Is there anything else I can help you with?`,
        professional: `Reservation ${res.number} has been confirmed. Details: ${res.room_type || 'Room'} for ${res.date}${res.check_out ? `, checkout ${res.check_out}` : ''}.`
      };
      return messages[style] || messages.detailed;
    }

    // Billing information
    if (data?.billing || data?.total_amount) {
      const bill = data.billing || data;
      const messages: Record<string, string> = {
        concise: `Your bill for ${bill.month || 'this month'} is $${bill.total_amount?.toFixed(2) || '0.00'} ${bill.currency || 'USD'}.`,
        detailed: `Your billing statement for ${bill.month || 'this month'} shows a total of $${bill.total_amount?.toFixed(2) || '0.00'} ${bill.currency || 'USD'}.${bill.due_date ? ` Payment is due by ${bill.due_date}.` : ''}${bill.items ? ` The bill includes ${bill.items.length} item(s).` : ''}`,
        friendly: `I found your bill! For ${bill.month || 'this month'}, the total is $${bill.total_amount?.toFixed(2) || '0.00'} ${bill.currency || 'USD'}.${bill.due_date ? ` It's due by ${bill.due_date}.` : ''} Would you like me to help you make a payment?`,
        professional: `Billing information for ${bill.month || 'this month'}: Total amount $${bill.total_amount?.toFixed(2) || '0.00'} ${bill.currency || 'USD'}.${bill.due_date ? ` Due date: ${bill.due_date}.` : ''}`
      };
      return messages[style] || messages.detailed;
    }

    // Support ticket
    if (data?.ticket) {
      const ticket = data.ticket;
      return `I've created support ticket ${ticket.id} for you. ${ticket.estimated_resolution ? `Estimated resolution: ${ticket.estimated_resolution}.` : ''} You'll receive updates via email.`;
    }

    // Generic success
    const messages: Record<string, string> = {
      concise: 'Request completed successfully.',
      detailed: includeDetails ? `Your request was successful. Details: ${JSON.stringify(data)}` : 'Your request was completed successfully.',
      friendly: 'Great! I've taken care of that for you. Is there anything else I can help with?',
      professional: 'Request processed successfully.'
    };
    return messages[style] || messages.detailed;
  }

  /**
   * Format needs_info response
   */
  private formatNeedsInfoResponse(
    response: NormalizedResponse,
    style: string
  ): string {
    if (response.clarification) {
      const clarification = response.clarification;
      let message = clarification.question;

      if (clarification.options && clarification.options.length > 0) {
        const optionsText = clarification.options.map(opt => opt.label).join(', ');
        message += ` Please choose one: ${optionsText}.`;
      }

      return message;
    }

    if (response.required && response.required.length > 0) {
      const fields = response.required.map(f => f.description || f.field).join(' and ');
      const messages: Record<string, string> = {
        concise: `I need: ${fields}.`,
        detailed: `To proceed, I'll need some additional information. Please provide your ${fields}.`,
        friendly: `I'd be happy to help! I just need a bit more information. Can you please provide your ${fields}?`,
        professional: `Additional information required: ${fields}.`
      };
      return messages[style] || messages.detailed;
    }

    return "I need more information to complete your request. Can you provide more details?";
  }

  /**
   * Format error response
   */
  private formatErrorResponse(
    error: any,
    style: string
  ): string {
    const errorMessage = error?.message || 'An error occurred';

    const messages: Record<string, string> = {
      concise: `Error: ${errorMessage}`,
      detailed: `I encountered an error: ${errorMessage}.${error?.code ? ` (Code: ${error.code})` : ''}`,
      friendly: `I'm sorry, but I'm having trouble with that right now. ${errorMessage}. Please try again in a moment.`,
      professional: `I apologize, but an error occurred: ${errorMessage}. Please try again or contact support if the issue persists.`
    };

    return messages[style] || messages.friendly;
  }
}

