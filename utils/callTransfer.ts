/**
 * Call Transfer Manager
 * 
 * Handles transferring calls between agents or escalating to human agents.
 */

import { AgentMessage, ConversationContext } from '../types';
import { CommunicationManager } from './agentCommunication';

export type TransferType = 'agent-to-agent' | 'to-human' | 'to-department';

export interface TransferRequest {
  fromAgentId: string;
  toAgentId?: string;
  toDepartmentId?: string;
  toHuman?: boolean;
  reason?: string;
  context?: ConversationContext;
  conversationHistory?: Array<{ role: 'user' | 'agent'; content: string }>;
}

export interface TransferResult {
  success: boolean;
  newAgentId?: string;
  error?: string;
  errorCode?: string;
}

export class CallTransferManager {
  private communicationManager: CommunicationManager;
  private activeTransfers: Map<string, TransferRequest> = new Map();

  constructor(communicationManager: CommunicationManager) {
    this.communicationManager = communicationManager;
  }

  /**
   * Transfer call to another agent
   */
  async transferCall(request: TransferRequest): Promise<TransferResult> {
    try {
      // Validate request
      if (!request.toAgentId && !request.toDepartmentId && !request.toHuman) {
        return {
          success: false,
          error: 'No target specified for transfer',
          errorCode: 'INVALID_TRANSFER_TARGET'
        };
      }

      // Create transfer context
      const transferId = `transfer_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      this.activeTransfers.set(transferId, request);

      // If transferring to human, return success immediately
      if (request.toHuman) {
        return {
          success: true,
          newAgentId: 'human_agent',
          error: undefined,
          errorCode: undefined
        };
      }

      // Prepare transfer message
      const targetAgentId = request.toAgentId || request.toDepartmentId!;
      const context: ConversationContext = request.context || {
        threadId: `thread_${transferId}`,
        sessionId: request.context?.sessionId,
        metadata: {
          transferId,
          fromAgent: request.fromAgentId,
          reason: request.reason,
          conversationHistory: request.conversationHistory
        }
      };

      const transferMessage: AgentMessage = {
        id: `msg_${transferId}`,
        from: request.fromAgentId,
        to: targetAgentId,
        type: 'INFORM',
        content: {
          type: 'call_transfer',
          reason: request.reason,
          conversationHistory: request.conversationHistory,
          context: request.context
        },
        context,
        timestamp: Date.now(),
        requiresResponse: false,
        priority: 'high'
      };

      // Send transfer notification
      await this.communicationManager.sendMessage(transferMessage);

      // Clean up
      this.activeTransfers.delete(transferId);

      return {
        success: true,
        newAgentId: targetAgentId
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Transfer failed',
        errorCode: 'TRANSFER_ERROR'
      };
    }
  }

  /**
   * Get active transfer
   */
  getActiveTransfer(transferId: string): TransferRequest | null {
    return this.activeTransfers.get(transferId) || null;
  }

  /**
   * Cancel transfer
   */
  cancelTransfer(transferId: string): boolean {
    return this.activeTransfers.delete(transferId);
  }
}

