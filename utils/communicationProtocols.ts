/**
 * Communication Protocols
 * 
 * Implements FIPA-ACL inspired protocols for standardized agent communication.
 * Provides message type definitions, protocol validation, and message routing.
 */

import { AgentMessage, MessageType, ConversationContext } from '../types';

/**
 * Protocol message types with descriptions
 */
export const MESSAGE_TYPES = {
  INFORM: {
    description: 'Agent provides information to another agent',
    requiresResponse: false,
    bidirectional: false
  },
  QUERY: {
    description: 'Agent asks a question and expects an answer',
    requiresResponse: true,
    bidirectional: true
  },
  REQUEST: {
    description: 'Agent requests an action to be performed',
    requiresResponse: true,
    bidirectional: true
  },
  CONFIRM: {
    description: 'Agent confirms understanding or agreement',
    requiresResponse: false,
    bidirectional: false
  },
  CLARIFY: {
    description: 'Agent asks for clarification on a previous message',
    requiresResponse: true,
    bidirectional: true
  }
} as const;

/**
 * Validates that a message follows the communication protocol
 * @param message - The message to validate
 * @returns Validation result with error details if invalid
 */
export function validateProtocol(message: AgentMessage): { valid: boolean; error?: string } {
  // Check required fields
  if (!message.id || !message.from || !message.to) {
    return { valid: false, error: 'Message missing required fields (id, from, to)' };
  }

  // Validate message type
  if (!Object.keys(MESSAGE_TYPES).includes(message.type)) {
    return { valid: false, error: `Invalid message type: ${message.type}` };
  }

  // Validate timestamp
  if (!message.timestamp || message.timestamp <= 0) {
    return { valid: false, error: 'Invalid timestamp' };
  }

  // Validate context
  if (!message.context || !message.context.threadId) {
    return { valid: false, error: 'Message missing conversation context' };
  }

  // Check if message type matches requiresResponse flag
  const typeConfig = MESSAGE_TYPES[message.type];
  if (typeConfig.requiresResponse !== message.requiresResponse) {
    return { 
      valid: false, 
      error: `Message type ${message.type} requires requiresResponse=${typeConfig.requiresResponse}` 
    };
  }

  return { valid: true };
}

/**
 * Creates a standardized message following the protocol
 * @param from - Source agent ID
 * @param to - Target agent ID
 * @param type - Message type
 * @param content - Message content
 * @param context - Conversation context
 * @param options - Optional message parameters
 * @returns Validated AgentMessage
 */
export function createMessage(
  from: string,
  to: string,
  type: MessageType,
  content: any,
  context: ConversationContext,
  options?: {
    correlationId?: string;
    priority?: 'low' | 'normal' | 'high';
    expiresAt?: number;
  }
): AgentMessage {
  const message: AgentMessage = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    from,
    to,
    type,
    content,
    context,
    timestamp: Date.now(),
    requiresResponse: MESSAGE_TYPES[type].requiresResponse,
    ...options
  };

  // Validate the created message
  const validation = validateProtocol(message);
  if (!validation.valid) {
    throw new Error(`Failed to create valid message: ${validation.error}`);
  }

  return message;
}

/**
 * Creates a response message to a previous message
 * @param originalMessage - The original message being responded to
 * @param from - Source agent ID (responder)
 * @param content - Response content
 * @param type - Response message type (defaults to INFORM)
 * @returns Response message with proper correlation
 */
export function createResponse(
  originalMessage: AgentMessage,
  from: string,
  content: any,
  type: MessageType = 'INFORM'
): AgentMessage {
  return createMessage(
    from,
    originalMessage.from, // Respond to the original sender
    type,
    content,
    originalMessage.context, // Maintain same context
    {
      correlationId: originalMessage.id, // Link to original message
      priority: originalMessage.priority
    }
  );
}

/**
 * Creates a clarification request message
 * @param originalMessage - The message that needs clarification
 * @param from - Source agent ID (requesting clarification)
 * @param question - The clarification question
 * @returns Clarification message
 */
export function createClarification(
  originalMessage: AgentMessage,
  from: string,
  question: string
): AgentMessage {
  // For clarification we keep the content as a human‑readable string so that
  // higher level code (and tests) can simply search it for the question text.
  return createMessage(
    from,
    originalMessage.from,
    'CLARIFY',
    question,
    originalMessage.context,
    {
      correlationId: originalMessage.id,
      priority: originalMessage.priority || 'high'
    }
  );
}

/**
 * Message router for directing messages between agents
 */
export class MessageRouter {
  private routingTable: Map<string, (message: AgentMessage) => Promise<any>> = new Map();

  /**
   * Registers an agent's message handler
   * @param agentId - Agent identifier
   * @param handler - Function to handle incoming messages
   */
  register(agentId: string, handler: (message: AgentMessage) => Promise<any>): void {
    this.routingTable.set(agentId, handler);
  }

  /**
   * Unregisters an agent's message handler
   * @param agentId - Agent identifier
   */
  unregister(agentId: string): void {
    this.routingTable.delete(agentId);
  }

  /**
   * Routes a message to the appropriate agent handler
   * @param message - Message to route
   * @returns Response from the handler
   */
  async route(message: AgentMessage): Promise<any> {
    const handler = this.routingTable.get(message.to);
    if (!handler) {
      throw new Error(`No handler registered for agent: ${message.to}`);
    }

    // Validate message before routing
    const validation = validateProtocol(message);
    if (!validation.valid) {
      throw new Error(`Invalid message protocol: ${validation.error}`);
    }

    return await handler(message);
  }

  /**
   * Checks if an agent has a registered handler
   * @param agentId - Agent identifier
   * @returns True if handler exists
   */
  hasHandler(agentId: string): boolean {
    return this.routingTable.has(agentId);
  }

  /**
   * Gets list of all registered agent IDs
   * @returns Array of agent IDs
   */
  getRegisteredAgents(): string[] {
    return Array.from(this.routingTable.keys());
  }
}

