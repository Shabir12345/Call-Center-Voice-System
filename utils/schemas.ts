/**
 * Input/Output Schemas
 * 
 * Standardized schema definitions for master-sub-agent communication
 * following the architecture plan specifications.
 */

import { SchemaDefinition } from './enhancedValidator';

/**
 * Standard input schema for Master Agent → Sub-Agent
 */
export const masterToSubAgentInputSchema: SchemaDefinition = {
  type: 'object',
  required: ['task', 'parameters', 'context', 'requestId', 'timestamp'],
  additionalProperties: false,
  properties: {
    task: {
      type: 'string',
      required: true,
      description: 'Task identifier',
      min: 1
    },
    parameters: {
      type: 'object',
      required: true,
      description: 'Task parameters',
      additionalProperties: true
    },
    context: {
      type: 'object',
      required: true,
      description: 'Conversation context',
      properties: {
        threadId: {
          type: 'string',
          required: true,
          description: 'Thread identifier'
        },
        sessionId: {
          type: 'string',
          required: true,
          description: 'Session identifier'
        },
        callerId: {
          type: 'string',
          required: false,
          description: 'Caller/user identifier'
        },
        conversationHistory: {
          type: 'array',
          required: false,
          description: 'Recent conversation history',
          items: {
            type: 'object',
            properties: {
              role: {
                type: 'string',
                enum: ['caller', 'agent', 'system']
              },
              content: {
                type: 'string'
              },
              timestamp: {
                type: 'number'
              }
            }
          }
        },
        metadata: {
          type: 'object',
          required: false,
          description: 'Additional context metadata',
          additionalProperties: true
        }
      }
    },
    requestId: {
      type: 'string',
      required: true,
      description: 'Unique request identifier',
      pattern: '^req_[a-zA-Z0-9_]+$'
    },
    timestamp: {
      type: 'number',
      required: true,
      description: 'Unix timestamp in milliseconds',
      min: 0
    },
    priority: {
      type: 'string',
      required: false,
      enum: ['low', 'normal', 'high'],
      description: 'Message priority'
    },
    timeout: {
      type: 'number',
      required: false,
      description: 'Timeout in milliseconds',
      min: 1000,
      max: 300000
    },
    retryCount: {
      type: 'number',
      required: false,
      description: 'Current retry attempt',
      min: 0,
      max: 10
    }
  }
};

/**
 * Standard output schema for Sub-Agent → Master Agent
 */
export const subAgentToMasterOutputSchema: SchemaDefinition = {
  type: 'object',
  required: ['status', 'requestId', 'timestamp'],
  additionalProperties: false,
  properties: {
    status: {
      type: 'string',
      required: true,
      enum: ['success', 'needs_info', 'error', 'partial'],
      description: 'Response status'
    },
    data: {
      type: 'object',
      required: false,
      description: 'Result data (if status is success)',
      additionalProperties: true
    },
    error: {
      type: 'object',
      required: false,
      description: 'Error details (if status is error)',
      properties: {
        code: {
          type: 'string',
          required: true,
          description: 'Error code'
        },
        message: {
          type: 'string',
          required: true,
          description: 'Human-readable error message'
        },
        details: {
          type: 'object',
          required: false,
          additionalProperties: true
        },
        retryable: {
          type: 'boolean',
          required: false,
          description: 'Whether the error is retryable'
        }
      }
    },
    required: {
      type: 'array',
      required: false,
      description: 'Required fields (if status is needs_info)',
      items: {
        type: 'object',
        properties: {
          field: {
            type: 'string',
            required: true
          },
          type: {
            type: 'string',
            enum: ['string', 'number', 'boolean', 'json']
          },
          description: {
            type: 'string'
          },
          validation: {
            type: 'object',
            additionalProperties: true
          }
        }
      }
    },
    clarification: {
      type: 'object',
      required: false,
      description: 'Clarification request',
      properties: {
        question: {
          type: 'string',
          required: true
        },
        options: {
          type: 'array',
          required: false,
          items: {
            type: 'object',
            properties: {
              value: {
                type: 'string'
              },
              label: {
                type: 'string'
              }
            }
          }
        },
        type: {
          type: 'string',
          enum: ['single_choice', 'multiple_choice', 'text']
        }
      }
    },
    metadata: {
      type: 'object',
      required: false,
      description: 'Response metadata',
      properties: {
        processingTime: {
          type: 'number',
          description: 'Processing time in milliseconds'
        },
        source: {
          type: 'string',
          enum: ['direct', 'session']
        },
        confidence: {
          type: 'number',
          min: 0,
          max: 1
        },
        suggestedActions: {
          type: 'array',
          items: {
            type: 'string'
          }
        }
      },
      additionalProperties: true
    },
    requestId: {
      type: 'string',
      required: true,
      description: 'Echo of input requestId'
    },
    timestamp: {
      type: 'number',
      required: true,
      description: 'Response timestamp'
    }
  }
};

/**
 * Task-specific input schemas
 */
export const taskSchemas: Record<string, SchemaDefinition> = {
  confirm_reservation: {
    type: 'object',
    required: ['task'],
    properties: {
      task: {
        type: 'string',
        enum: ['confirm_reservation']
      },
      parameters: {
        type: 'object',
        properties: {
          reservation_number: {
            type: 'string',
            required: false,
            pattern: '^[A-Z0-9]{6}$',
            description: '6-character reservation code'
          },
          full_name: {
            type: 'string',
            required: false,
            min: 1,
            description: 'Full name as it appears on the reservation'
          }
        }
      }
    }
  },
  get_billing_info: {
    type: 'object',
    required: ['task'],
    properties: {
      task: {
        type: 'string',
        enum: ['get_billing_info']
      },
      parameters: {
        type: 'object',
        properties: {
          account_id: {
            type: 'string',
            required: false,
            description: 'Account identifier'
          },
          month: {
            type: 'string',
            required: false,
            pattern: '^\\d{4}-\\d{2}$',
            description: 'Month in YYYY-MM format'
          }
        }
      }
    }
  },
  create_support_ticket: {
    type: 'object',
    required: ['task'],
    properties: {
      task: {
        type: 'string',
        enum: ['create_support_ticket']
      },
      parameters: {
        type: 'object',
        required: ['issue_type', 'description'],
        properties: {
          issue_type: {
            type: 'string',
            enum: ['technical', 'billing', 'account', 'other']
          },
          description: {
            type: 'string',
            min: 10,
            description: 'Issue description'
          },
          severity: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'critical']
          }
        }
      }
    }
  }
};

/**
 * Get schema for a specific task
 */
export function getTaskSchema(task: string): SchemaDefinition {
  return taskSchemas[task] || masterToSubAgentInputSchema;
}

/**
 * Get output schema for a specific task
 */
export function getOutputSchema(task: string): SchemaDefinition {
  // For now, all tasks use the same output schema
  // Can be customized per task if needed
  return subAgentToMasterOutputSchema;
}

