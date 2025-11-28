/**
 * Reservation Agent Module
 * 
 * Handles reservation-related tasks: confirmation, modification, cancellation
 */

import { SubAgentModule, SubAgentConfig, TaskResult } from '../subAgentModule';
import { ConversationContext } from '../../types';
import { CentralLogger } from '../logger';
import { taskSchemas } from '../schemas';

/**
 * Reservation Agent implementation
 */
export class ReservationAgentModule extends SubAgentModule {
  constructor(config: SubAgentConfig, logger: CentralLogger) {
    super(config, logger);
  }

  protected setupSchemas(): void {
    // Set up task-specific schemas
    this.taskSchemas.set('confirm_reservation', taskSchemas.confirm_reservation);
    this.taskSchemas.set('modify_reservation', {
      type: 'object',
      required: ['task'],
      properties: {
        task: { type: 'string', enum: ['modify_reservation'] },
        parameters: {
          type: 'object',
          properties: {
            reservation_number: { type: 'string', pattern: '^[A-Z0-9]{6}$' },
            modification_type: { type: 'string', enum: ['date_change', 'room_change', 'guest_change'] },
            new_value: { type: 'string' }
          }
        }
      }
    });
    this.taskSchemas.set('cancel_reservation', {
      type: 'object',
      required: ['task'],
      properties: {
        task: { type: 'string', enum: ['cancel_reservation'] },
        parameters: {
          type: 'object',
          properties: {
            reservation_number: { type: 'string', pattern: '^[A-Z0-9]{6}$' },
            full_name: { type: 'string' }
          }
        }
      }
    });
  }

  protected async processTask(
    task: string,
    parameters: Record<string, any>,
    context: ConversationContext
  ): Promise<TaskResult> {
    switch (task) {
      case 'confirm_reservation':
        return await this.confirmReservation(parameters, context);
      case 'modify_reservation':
        return await this.modifyReservation(parameters, context);
      case 'cancel_reservation':
        return await this.cancelReservation(parameters, context);
      default:
        return {
          status: 'error',
          error: {
            code: 'UNKNOWN_TASK',
            message: `Unknown task: ${task}`,
            retryable: false
          }
        };
    }
  }

  /**
   * Confirm a reservation
   */
  private async confirmReservation(
    parameters: Record<string, any>,
    context: ConversationContext
  ): Promise<TaskResult> {
    // Check required fields
    const requiredFields = ['reservation_number', 'full_name'];
    const missingFields = this.checkRequiredFields(parameters, requiredFields);

    if (missingFields.length > 0) {
      return {
        status: 'needs_info',
        required: missingFields.map(field => ({
          field,
          type: 'string',
          description: this.getFieldDescription(field),
          validation: field === 'reservation_number' 
            ? { pattern: '^[A-Z0-9]{6}$', example: 'ABC123' }
            : undefined
        }))
      };
    }

    // Apply business rules
    const businessRulesCheck = this.applyBusinessRules('confirm_reservation', parameters);
    if (!businessRulesCheck.allowed) {
      return {
        status: 'error',
        error: {
          code: 'BUSINESS_RULE_VIOLATION',
          message: businessRulesCheck.reason || 'Reservation cannot be confirmed',
          retryable: false
        }
      };
    }

    // Simulate data retrieval (in production, this would call external system)
    const reservationData = await this.getReservationData(
      parameters.reservation_number,
      parameters.full_name
    );

    if (!reservationData) {
      return {
        status: 'error',
        error: {
          code: 'RESERVATION_NOT_FOUND',
          message: 'No reservation found with the provided details',
          details: {
            searchedFields: ['reservation_number', 'full_name'],
            suggestions: [
              'Verify the reservation number',
              'Check if the name matches exactly'
            ]
          },
          retryable: false
        }
      };
    }

    return {
      status: 'success',
      data: {
        reservation: reservationData
      },
      metadata: {
        source: 'direct',
        confidence: 1.0,
        suggestedActions: ['view_details', 'modify_reservation']
      }
    };
  }

  /**
   * Modify a reservation
   */
  private async modifyReservation(
    parameters: Record<string, any>,
    context: ConversationContext
  ): Promise<TaskResult> {
    const requiredFields = ['reservation_number', 'modification_type', 'new_value'];
    const missingFields = this.checkRequiredFields(parameters, requiredFields);

    if (missingFields.length > 0) {
      return {
        status: 'needs_info',
        required: missingFields.map(field => ({
          field,
          type: 'string',
          description: this.getFieldDescription(field)
        }))
      };
    }

    // Simulate modification
    const modifiedReservation = await this.modifyReservationData(
      parameters.reservation_number,
      parameters.modification_type,
      parameters.new_value
    );

    if (!modifiedReservation) {
      return {
        status: 'error',
        error: {
          code: 'MODIFICATION_FAILED',
          message: 'Unable to modify reservation',
          retryable: true
        }
      };
    }

    return {
      status: 'success',
      data: {
        reservation: modifiedReservation
      }
    };
  }

  /**
   * Cancel a reservation
   */
  private async cancelReservation(
    parameters: Record<string, any>,
    context: ConversationContext
  ): Promise<TaskResult> {
    const requiredFields = ['reservation_number', 'full_name'];
    const missingFields = this.checkRequiredFields(parameters, requiredFields);

    if (missingFields.length > 0) {
      return {
        status: 'needs_info',
        required: missingFields.map(field => ({
          field,
          type: 'string',
          description: this.getFieldDescription(field)
        }))
      };
    }

    // Simulate cancellation
    const cancellationResult = await this.cancelReservationData(
      parameters.reservation_number,
      parameters.full_name
    );

    if (!cancellationResult) {
      return {
        status: 'error',
        error: {
          code: 'CANCELLATION_FAILED',
          message: 'Unable to cancel reservation',
          retryable: true
        }
      };
    }

    return {
      status: 'success',
      data: {
        reservation: cancellationResult
      }
    };
  }

  /**
   * Get field description
   */
  private getFieldDescription(field: string): string {
    const descriptions: Record<string, string> = {
      reservation_number: 'Your 6-character reservation code',
      full_name: 'Full name as it appears on the reservation',
      modification_type: 'Type of modification (date_change, room_change, guest_change)',
      new_value: 'New value for the modification'
    };
    return descriptions[field] || field;
  }

  /**
   * Simulate getting reservation data
   */
  private async getReservationData(
    reservationNumber: string,
    fullName: string
  ): Promise<any | null> {
    // In production, this would call external API/database
    // For now, simulate with mock data
    if (reservationNumber === 'ABC123' && fullName.toLowerCase().includes('doe')) {
      return {
        number: 'ABC123',
        date: '2025-12-01',
        status: 'confirmed',
        guest_name: 'John Doe',
        room_type: 'Deluxe Suite',
        check_in: '2025-12-01T15:00:00Z',
        check_out: '2025-12-05T11:00:00Z'
      };
    }
    return null;
  }

  /**
   * Simulate modifying reservation
   */
  private async modifyReservationData(
    reservationNumber: string,
    modificationType: string,
    newValue: string
  ): Promise<any | null> {
    // In production, this would call external API
    return {
      number: reservationNumber,
      modification_type: modificationType,
      new_value: newValue,
      status: 'modified'
    };
  }

  /**
   * Simulate canceling reservation
   */
  private async cancelReservationData(
    reservationNumber: string,
    fullName: string
  ): Promise<any | null> {
    // In production, this would call external API
    return {
      number: reservationNumber,
      status: 'cancelled',
      cancellation_fee: 25.00,
      refund_amount: 475.00
    };
  }
}

