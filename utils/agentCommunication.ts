/**
 * Agent Communication Manager
 * 
 * Central coordinator for bidirectional agent-to-agent communication.
 * Manages message queues, conversation context, and request/response protocols.
 */

import { 
  AgentMessage, 
  ConversationThread, 
  ConversationContext, 
  CommunicationEvent,
  BidirectionalConfig 
} from '../types';
import { MessageRouter, createMessage, createResponse, validateProtocol } from './communicationProtocols';

/**
 * Message queue item with priority and metadata
 */
interface QueuedMessage {
  message: AgentMessage;
  priority: number;
  queuedAt: number;
  retryCount: number;
}

/**
 * Pending request tracking
 */
interface PendingRequest {
  message: AgentMessage;
  resolve: (value: any) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
  createdAt: number;
}

/**
 * Communication Manager for bidirectional agent communication
 */
export class CommunicationManager {
  private messageQueue: QueuedMessage[] = [];
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private threads: Map<string, ConversationThread> = new Map();
  private router: MessageRouter;
  private config: BidirectionalConfig;
  private eventCallbacks: Map<string, ((event: CommunicationEvent) => void)[]> = new Map();

  constructor(config?: Partial<BidirectionalConfig>) {
    this.router = new MessageRouter();
    this.config = {
      enabled: true,
      maxConversationDepth: 5,
      timeout: 30000, // 30 seconds
      retryEnabled: true,
      maxRetries: 2,
      ...config
    };
  }

  /**
   * Registers an agent's message handler
   * @param agentId - Agent identifier
   * @param handler - Function to handle incoming messages
   */
  registerAgent(agentId: string, handler: (message: AgentMessage) => Promise<any>): void {
    this.router.register(agentId, handler);
    this.emitEvent({
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      from: 'system',
      to: agentId,
      type: 'agent_registered',
      timestamp: Date.now(),
      success: true,
      metadata: { agentId }
    });
  }

  /**
   * Unregisters an agent
   * @param agentId - Agent identifier
   */
  unregisterAgent(agentId: string): void {
    this.router.unregister(agentId);
    // Clean up pending requests for this agent
    for (const [id, request] of this.pendingRequests.entries()) {
      if (request.message.to === agentId || request.message.from === agentId) {
        clearTimeout(request.timeout);
        request.reject(new Error(`Agent ${agentId} unregistered`));
        this.pendingRequests.delete(id);
      }
    }
  }

  /**
   * Sends a message to another agent (fire-and-forget)
   * @param message - Message to send
   * @returns Promise that resolves when message is queued
   */
  async sendMessage(message: AgentMessage): Promise<void> {
    if (!this.config.enabled) {
      throw new Error('Bidirectional communication is disabled');
    }

    // Validate message
    const validation = validateProtocol(message);
    if (!validation.valid) {
      throw new Error(`Invalid message: ${validation.error}`);
    }

    // Get or create conversation thread
    const thread = this.getOrCreateThread(message.context.threadId, [message.from, message.to]);
    thread.messages.push(message);
    thread.updatedAt = Date.now();

    // Emit send event
    this.emitEvent({
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      from: message.from,
      to: message.to,
      type: message.type,
      timestamp: message.timestamp,
      success: true,
      messageId: message.id,
      threadId: thread.id,
      metadata: { content: message.content }
    });

    // Queue message for processing
    const priority = this.getPriority(message);
    this.messageQueue.push({
      message,
      priority,
      queuedAt: Date.now(),
      retryCount: 0
    });

    // Sort queue by priority (higher priority first)
    this.messageQueue.sort((a, b) => b.priority - a.priority);

    // Process queue
    this.processQueue();
  }

  /**
   * Sends a message and waits for a response (request-response pattern)
   * @param message - Message to send
   * @returns Promise that resolves with the response
   */
  async sendAndWait(message: AgentMessage, timeout?: number): Promise<any> {
    if (!message.requiresResponse) {
      throw new Error('Message does not require a response. Use sendMessage() instead.');
    }

    return new Promise((resolve, reject) => {
      const requestTimeout = timeout || this.config.timeout;
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(message.id);
        reject(new Error(`Request timeout after ${requestTimeout}ms`));
      }, requestTimeout);

      this.pendingRequests.set(message.id, {
        message,
        resolve,
        reject,
        timeout: timeoutId,
        createdAt: Date.now()
      });

      // Send the message
      this.sendMessage(message).catch(reject);
    });
  }

  /**
   * Handles an incoming response to a pending request
   * @param responseMessage - Response message
   */
  handleResponse(responseMessage: AgentMessage): void {
    if (!responseMessage.correlationId) {
      return; // Not a response to a pending request
    }

    const pendingRequest = this.pendingRequests.get(responseMessage.correlationId);
    if (!pendingRequest) {
      return; // No pending request found
    }

    // Clear timeout and resolve
    clearTimeout(pendingRequest.timeout);
    this.pendingRequests.delete(responseMessage.correlationId);

    // Emit response event
    const duration = Date.now() - pendingRequest.createdAt;
    this.emitEvent({
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      from: responseMessage.from,
      to: responseMessage.to,
      type: 'response',
      timestamp: Date.now(),
      duration,
      success: true,
      messageId: responseMessage.id,
      metadata: { 
        originalMessageId: responseMessage.correlationId,
        content: responseMessage.content 
      }
    });

    pendingRequest.resolve(responseMessage.content);
  }

  /**
   * Processes the message queue
   */
  private async processQueue(): Promise<void> {
    if (this.messageQueue.length === 0) {
      return;
    }

    const queued = this.messageQueue.shift();
    if (!queued) {
      return;
    }

    const { message } = queued;
    const startTime = Date.now();

    try {
      // Route message to handler
      const response = await this.router.route(message);

      const duration = Date.now() - startTime;

      // If message requires response and we got one, handle it
      if (message.requiresResponse && response) {
        // Create response message with correlation to original request
        const responseMessage = createResponse(message, message.to, response);
        
        // Check if this is a response to a pending request (original message was waiting for response)
        const pendingRequest = this.pendingRequests.get(message.id);
        if (pendingRequest) {
          // This is a response to a pending request - resolve it
          this.handleResponse(responseMessage);
        } else {
          // No pending request, just send the response message
          await this.sendMessage(responseMessage);
        }
      }

      // Emit success event
      this.emitEvent({
        id: `evt_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        from: message.from,
        to: message.to,
        type: message.type,
        timestamp: Date.now(),
        duration,
        success: true,
        messageId: message.id,
        metadata: { response }
      });

      // Continue processing queue
      this.processQueue();

    } catch (error: any) {
      const duration = Date.now() - startTime;
      const errorMessage = error.message || 'Unknown error';

      // Emit error event
      this.emitEvent({
        id: `evt_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        from: message.from,
        to: message.to,
        type: message.type,
        timestamp: Date.now(),
        duration,
        success: false,
        error: errorMessage,
        errorCode: 'ROUTING_ERROR',
        messageId: message.id
      });

      // Retry logic
      if (this.config.retryEnabled && queued.retryCount < this.config.maxRetries) {
        queued.retryCount++;
        this.messageQueue.push(queued);
        this.messageQueue.sort((a, b) => b.priority - a.priority);
      } else {
        // Reject pending request if exists
        if (message.correlationId) {
          const pendingRequest = this.pendingRequests.get(message.correlationId);
          if (pendingRequest) {
            clearTimeout(pendingRequest.timeout);
            this.pendingRequests.delete(message.correlationId);
            pendingRequest.reject(error);
          }
        }
      }

      // Continue processing queue
      this.processQueue();
    }
  }

  /**
   * Gets or creates a conversation thread
   * @param threadId - Thread identifier
   * @param participants - Agent IDs involved
   * @returns Conversation thread
   */
  private getOrCreateThread(threadId: string, participants: string[]): ConversationThread {
    let thread = this.threads.get(threadId);
    if (!thread) {
      thread = {
        id: threadId,
        participants,
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        status: 'active'
      };
      this.threads.set(threadId, thread);
    }
    return thread;
  }

  /**
   * Gets a conversation thread by ID
   * @param threadId - Thread identifier
   * @returns Conversation thread or undefined
   */
  getThread(threadId: string): ConversationThread | undefined {
    return this.threads.get(threadId);
  }

  /**
   * Gets all active threads
   * @returns Array of active conversation threads
   */
  getActiveThreads(): ConversationThread[] {
    return Array.from(this.threads.values()).filter(t => t.status === 'active');
  }

  /**
   * Calculates message priority
   * @param message - Message to calculate priority for
   * @returns Priority score (higher = more important)
   */
  private getPriority(message: AgentMessage): number {
    let priority = 50; // Base priority

    // Adjust based on message priority
    if (message.priority === 'high') priority += 30;
    else if (message.priority === 'low') priority -= 20;

    // Adjust based on message type
    if (message.type === 'CLARIFY') priority += 20; // Clarifications are urgent
    if (message.type === 'QUERY') priority += 10; // Queries need quick responses

    // Adjust based on expiration
    if (message.expiresAt && message.expiresAt < Date.now() + 5000) {
      priority += 40; // Urgent if expiring soon
    }

    return priority;
  }

  /**
   * Subscribes to communication events
   * @param eventType - Type of event to listen for ('*' for all)
   * @param callback - Callback function
   * @returns Unsubscribe function
   */
  onEvent(eventType: string, callback: (event: CommunicationEvent) => void): () => void {
    if (!this.eventCallbacks.has(eventType)) {
      this.eventCallbacks.set(eventType, []);
    }
    this.eventCallbacks.get(eventType)!.push(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.eventCallbacks.get(eventType);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    };
  }

  /**
   * Emits a communication event to subscribers
   * @param event - Event to emit
   */
  private emitEvent(event: CommunicationEvent): void {
    // Emit to specific event type subscribers
    const specificCallbacks = this.eventCallbacks.get(event.type);
    if (specificCallbacks) {
      specificCallbacks.forEach(cb => cb(event));
    }

    // Emit to wildcard subscribers
    const wildcardCallbacks = this.eventCallbacks.get('*');
    if (wildcardCallbacks) {
      wildcardCallbacks.forEach(cb => cb(event));
    }
  }

  /**
   * Gets statistics about communication
   * @returns Communication statistics
   */
  getStatistics(): {
    queuedMessages: number;
    pendingRequests: number;
    activeThreads: number;
    registeredAgents: number;
  } {
    return {
      queuedMessages: this.messageQueue.length,
      pendingRequests: this.pendingRequests.size,
      activeThreads: this.getActiveThreads().length,
      registeredAgents: this.router.getRegisteredAgents().length
    };
  }

  /**
   * Clears all queues and pending requests (useful for cleanup)
   */
  clear(): void {
    // Clear pending requests
    for (const request of this.pendingRequests.values()) {
      clearTimeout(request.timeout);
      request.reject(new Error('Communication manager cleared'));
    }
    this.pendingRequests.clear();

    // Clear message queue
    this.messageQueue = [];

    // Clear threads
    this.threads.clear();
  }

  /**
   * Updates configuration
   * @param config - Partial configuration to update
   */
  updateConfig(config: Partial<BidirectionalConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

