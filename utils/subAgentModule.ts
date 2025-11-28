/**
 * Sub-Agent Module Base
 * 
 * Base class for all sub-agents that handle domain-specific tasks.
 * Provides common functionality for input validation, output validation,
 * error handling, and bidirectional communication.
 */

import { AgentMessage, ConversationContext } from '../types';
import { EnhancedValidator, ValidationResult, SchemaDefinition } from './enhancedValidator';
import { CentralLogger } from './logger';
import { createResponse, createClarification } from './communicationProtocols';
import { subAgentToMasterOutputSchema, getOutputSchema } from './schemas';

/**
 * Sub-Agent configuration
 */
export interface SubAgentConfig {
  agentId: string;
  specialty: string;
  systemPrompt: string;
  model?: 'flash' | 'pro';
  tools?: string[];
  bidirectionalEnabled?: boolean;
  maxConversationDepth?: number;
  communicationTimeout?: number;
  businessRules?: Record<string, any>;
  dataSource?: any; // External data source interface
}

/**
 * Task processing result
 */
export interface TaskResult {
  status: 'success' | 'needs_info' | 'error' | 'partial';
  data?: any;
  error?: {
    code: string;
    message: string;
    details?: any;
    retryable?: boolean;
  };
  required?: Array<{
    field: string;
    type: string;
    description: string;
    validation?: any;
  }>;
  clarification?: {
    question: string;
    options?: Array<{ value: string; label: string }>;
    type: 'single_choice' | 'multiple_choice' | 'text';
  };
  metadata?: {
    processingTime?: number;
    source?: 'direct' | 'session';
    confidence?: number;
    suggestedActions?: string[];
  };
}

/**
 * Base class for Sub-Agent modules
 */
export abstract class SubAgentModule {
  protected config: SubAgentConfig;
  protected validator: EnhancedValidator;
  protected logger: CentralLogger;
  protected taskSchemas: Map<string, SchemaDefinition> = new Map();
  protected outputSchemas: Map<string, SchemaDefinition> = new Map();

  constructor(config: SubAgentConfig, logger: CentralLogger) {
    this.config = config;
    this.logger = logger;
    this.validator = new EnhancedValidator();
    this.setupSchemas();
  }

  /**
   * Handle incoming message from master agent
   */
  async handleMessage(message: AgentMessage): Promise<any> {
    const startTime = Date.now();

    try {
      // Log incoming message
      this.logger.log({
        type: 'agent_to_agent',
        from: message.from,
        to: message.to,
        message: JSON.stringify(message.content),
        sessionId: message.context.sessionId,
        metadata: {
          messageId: message.id,
          threadId: message.context.threadId,
          type: message.type
        }
      });

      // Extract task and parameters
      const content = message.content;
      const task = content.task;
      const parameters = content.parameters || {};
      const context = content.context || message.context;

      // Validate input
      const inputValidation = this.validateInput(content, task);
      if (!inputValidation.isValid) {
        return this.createErrorResponse(
          message,
          'INVALID_INPUT',
          inputValidation.error || 'Input validation failed',
          { validation: inputValidation }
        );
      }

      // Process task
      const result = await this.processTask(task, parameters, context);

      // For error results we trust the concrete sub‑agent and skip schema
      // validation so that specific error codes (like UNKNOWN_TASK) are
      // preserved as‑is for callers and tests.
      if (result.status === 'error') {
        return this.formatResponse(result, message, Date.now() - startTime);
      }

      // Format response first (adds requestId, timestamp, etc.)
      const response = this.formatResponse(result, message, Date.now() - startTime);

      // Validate formatted output
      const outputValidation = this.validateOutput(response, task);
      if (!outputValidation.isValid) {
        this.logger.error('Output validation failed', outputValidation.error);
        return this.createErrorResponse(
          message,
          'INVALID_OUTPUT',
          'Sub-agent generated invalid output'
        );
      }

      // Log response
      this.logger.log({
        type: 'agent_to_agent',
        from: this.config.agentId,
        to: message.from,
        message: JSON.stringify(response),
        sessionId: context.sessionId,
        metadata: {
          messageId: message.id,
          threadId: context.threadId,
          duration: Date.now() - startTime,
          success: result.status === 'success'
        }
      });

      return response;

    } catch (error: any) {
      this.logger.error('Error processing sub-agent request', error, {
        messageId: message.id,
        agentId: this.config.agentId
      });

      return this.createErrorResponse(
        message,
        'INTERNAL_ERROR',
        error.message || 'An unexpected error occurred',
        { error: error.toString() }
      );
    }
  }

  /**
   * Process a task - to be implemented by subclasses
   */
  protected abstract processTask(
    task: string,
    parameters: Record<string, any>,
    context: ConversationContext
  ): Promise<TaskResult>;

  /**
   * Validate input against task schema
   */
  protected validateInput(input: any, task: string): ValidationResult {
    const schema = this.getTaskSchema(task);
    if (!schema) {
      // Use default schema if task-specific schema not found
      return { isValid: true };
    }

    return this.validator.validateInput(input, schema);
  }

  /**
   * Validate output against task schema
   */
  protected validateOutput(output: any, task: string): ValidationResult {
    const schema = this.getOutputSchema(task);
    return this.validator.validateOutput(output, schema);
  }

  /**
   * Get task schema
   */
  protected getTaskSchema(task: string): SchemaDefinition | null {
    return this.taskSchemas.get(task) || null;
  }

  /**
   * Get output schema
   */
  protected getOutputSchema(task: string): SchemaDefinition {
    return this.outputSchemas.get(task) || subAgentToMasterOutputSchema;
  }

  /**
   * Set up schemas - to be implemented by subclasses
   */
  protected setupSchemas(): void {
    // Subclasses should override this to set up task-specific schemas
  }

  /**
   * Create error response
   */
  protected createErrorResponse(
    originalMessage: AgentMessage,
    errorCode: string,
    errorMessage: string,
    details?: any,
    retryable: boolean = false
  ): any {
    return {
      status: 'error',
      error: {
        code: errorCode,
        message: errorMessage,
        details,
        retryable
      },
      requestId: originalMessage.content?.requestId,
      timestamp: Date.now()
    };
  }

  /**
   * Create needs_info response
   */
  protected createNeedsInfoResponse(
    originalMessage: AgentMessage,
    required: Array<{
      field: string;
      type: string;
      description: string;
      validation?: any;
    }>
  ): any {
    return {
      status: 'needs_info',
      required,
      requestId: originalMessage.content?.requestId,
      timestamp: Date.now()
    };
  }

  /**
   * Create clarification response
   */
  protected createClarificationResponse(
    originalMessage: AgentMessage,
    question: string,
    options?: Array<{ value: string; label: string }>,
    type: 'single_choice' | 'multiple_choice' | 'text' = 'text'
  ): any {
    return {
      status: 'needs_info',
      clarification: {
        question,
        options,
        type
      },
      requestId: originalMessage.content?.requestId,
      timestamp: Date.now()
    };
  }

  /**
   * Create success response
   */
  protected createSuccessResponse(
    originalMessage: AgentMessage,
    data: any,
    metadata?: any
  ): any {
    return {
      status: 'success',
      data,
      metadata,
      requestId: originalMessage.content?.requestId,
      timestamp: Date.now()
    };
  }

  /**
   * Format response for master agent
   */
  protected formatResponse(
    result: TaskResult,
    originalMessage: AgentMessage,
    processingTime: number
  ): any {
    const response: any = {
      status: result.status,
      requestId: originalMessage.content?.requestId || `req_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      timestamp: Date.now()
    };

    if (result.status === 'success' && result.data) {
      response.data = result.data;
    }

    if (result.status === 'error' && result.error) {
      response.error = result.error;
    }

    if (result.status === 'needs_info') {
      if (result.clarification) {
        response.clarification = result.clarification;
      } else if (result.required) {
        response.required = result.required;
      }
    }

    if (result.metadata) {
      response.metadata = {
        ...result.metadata,
        processingTime
      };
    } else {
      response.metadata = {
        processingTime
      };
    }

    return response;
  }

  /**
   * Check if required fields are present
   */
  protected checkRequiredFields(
    parameters: Record<string, any>,
    requiredFields: string[]
  ): string[] {
    return requiredFields.filter(field => 
      !(field in parameters) || 
      parameters[field] === undefined || 
      parameters[field] === null ||
      (typeof parameters[field] === 'string' && parameters[field].trim() === '')
    );
  }

  /**
   * Apply business rules
   */
  protected applyBusinessRules(task: string, parameters: Record<string, any>): {
    allowed: boolean;
    reason?: string;
  } {
    if (!this.config.businessRules) {
      return { allowed: true };
    }

    // Subclasses can override this for specific business rule logic
    return { allowed: true };
  }

  /**
   * Get agent ID
   */
  getAgentId(): string {
    return this.config.agentId;
  }

  /**
   * Get specialty
   */
  getSpecialty(): string {
    return this.config.specialty;
  }
}

