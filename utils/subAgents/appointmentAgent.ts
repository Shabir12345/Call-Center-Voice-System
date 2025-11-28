/**
 * Appointment Agent
 * 
 * Sub-agent for handling appointment booking, modification, and cancellation
 * Integrates with calendar systems (Google, Outlook, Apple)
 */

import { SubAgentModule, SubAgentConfig, TaskResult } from '../subAgentModule';
import { ConversationContext } from '../../types';
import { CentralLogger } from '../logger';
import {
  CalendarService,
  AppointmentDetails,
  AvailableSlot,
  PatientInfo,
  AvailabilityQuery,
  CalendarOperationResult
} from '../calendar';
import { roundToNearestInterval, formatDuration } from '../calendar/calendarUtils';

/**
 * Appointment Agent configuration
 */
export interface AppointmentAgentConfig extends SubAgentConfig {
  calendarService: CalendarService;
  defaultConnectionId?: string; // Default calendar connection to use
  defaultCalendarId?: string; // Default calendar to use
  defaultAppointmentDuration?: number; // Default duration in minutes
  businessHours?: {
    start: string; // HH:mm format
    end: string; // HH:mm format
    daysOfWeek?: number[]; // 0-6, Sunday-Saturday
  };
}

/**
 * Appointment Agent implementation
 */
export class AppointmentAgent extends SubAgentModule {
  private calendarService: CalendarService;
  private defaultConnectionId?: string;
  private defaultCalendarId?: string;
  private defaultDuration: number;

  constructor(config: AppointmentAgentConfig, logger: CentralLogger) {
    super(config, logger);
    this.calendarService = config.calendarService;
    this.defaultConnectionId = config.defaultConnectionId;
    this.defaultCalendarId = config.defaultCalendarId;
    this.defaultDuration = config.defaultAppointmentDuration || 30;
  }

  /**
   * Setup task schemas
   */
  protected setupSchemas(): void {
    // find_available_slots schema
    this.taskSchemas.set('find_available_slots', {
      type: 'object',
      required: ['startDate', 'endDate'],
      properties: {
        startDate: { type: 'string', format: 'date-time' },
        endDate: { type: 'string', format: 'date-time' },
        duration: { type: 'number', minimum: 15, maximum: 480 },
        connectionId: { type: 'string' },
        calendarId: { type: 'string' },
        timezone: { type: 'string' }
      }
    });

    // book_appointment schema
    this.taskSchemas.set('book_appointment', {
      type: 'object',
      required: ['patient', 'start', 'end'],
      properties: {
        patient: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string', minLength: 1 },
            phone: { type: 'string' },
            email: { type: 'string', format: 'email' },
            reason: { type: 'string' },
            notes: { type: 'string' }
          }
        },
        start: { type: 'string', format: 'date-time' },
        end: { type: 'string', format: 'date-time' },
        title: { type: 'string' },
        description: { type: 'string' },
        location: { type: 'string' },
        connectionId: { type: 'string' },
        calendarId: { type: 'string' },
        timezone: { type: 'string' }
      }
    });

    // modify_appointment schema
    this.taskSchemas.set('modify_appointment', {
      type: 'object',
      required: ['eventId'],
      properties: {
        eventId: { type: 'string' },
        start: { type: 'string', format: 'date-time' },
        end: { type: 'string', format: 'date-time' },
        title: { type: 'string' },
        description: { type: 'string' },
        location: { type: 'string' },
        patient: { type: 'object' },
        connectionId: { type: 'string' },
        calendarId: { type: 'string' }
      }
    });

    // cancel_appointment schema
    this.taskSchemas.set('cancel_appointment', {
      type: 'object',
      required: ['eventId'],
      properties: {
        eventId: { type: 'string' },
        connectionId: { type: 'string' },
        calendarId: { type: 'string' }
      }
    });

    // check_appointment schema
    this.taskSchemas.set('check_appointment', {
      type: 'object',
      required: ['eventId'],
      properties: {
        eventId: { type: 'string' },
        connectionId: { type: 'string' },
        calendarId: { type: 'string' }
      }
    });
  }

  /**
   * Process task
   */
  protected async processTask(
    task: string,
    parameters: Record<string, any>,
    context: ConversationContext
  ): Promise<TaskResult> {
    switch (task) {
      case 'find_available_slots':
        return await this.findAvailableSlots(parameters, context);
      case 'book_appointment':
        return await this.bookAppointment(parameters, context);
      case 'modify_appointment':
        return await this.modifyAppointment(parameters, context);
      case 'cancel_appointment':
        return await this.cancelAppointment(parameters, context);
      case 'check_appointment':
        return await this.checkAppointment(parameters, context);
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
   * Find available time slots
   */
  private async findAvailableSlots(
    parameters: Record<string, any>,
    context: ConversationContext
  ): Promise<TaskResult> {
    try {
      const startDate = new Date(parameters.startDate);
      const endDate = new Date(parameters.endDate);
      const duration = parameters.duration || this.defaultDuration;
      const connectionId = parameters.connectionId || this.defaultConnectionId;
      const calendarId = parameters.calendarId || this.defaultCalendarId;
      const timezone = parameters.timezone;

      if (!connectionId || !calendarId) {
        return {
          status: 'needs_info',
          required: [
            {
              field: 'connectionId',
              type: 'string',
              description: 'Calendar connection ID'
            },
            {
              field: 'calendarId',
              type: 'string',
              description: 'Calendar ID to search'
            }
          ]
        };
      }

      const query: AvailabilityQuery = {
        start: startDate,
        end: endDate,
        duration,
        timezone,
        businessHours: this.config.businessRules?.businessHours
      };

      const result = await this.calendarService.findAvailableSlots(
        connectionId,
        calendarId,
        query
      );

      if (!result.success) {
        return {
          status: 'error',
          error: result.error || {
            code: 'SLOT_FINDING_ERROR',
            message: 'Failed to find available slots',
            retryable: true
          }
        };
      }

      return {
        status: 'success',
        data: {
          slots: result.data || [],
          count: result.data?.length || 0,
          duration: formatDuration(duration)
        },
        metadata: {
          source: 'direct',
          confidence: 1.0
        }
      };
    } catch (error: any) {
      return {
        status: 'error',
        error: {
          code: 'FIND_SLOTS_ERROR',
          message: error.message || 'Failed to find available slots',
          retryable: true
        }
      };
    }
  }

  /**
   * Book an appointment
   */
  private async bookAppointment(
    parameters: Record<string, any>,
    context: ConversationContext
  ): Promise<TaskResult> {
    try {
      const patient: PatientInfo = parameters.patient;
      const start = new Date(parameters.start);
      const end = new Date(parameters.end);
      const connectionId = parameters.connectionId || this.defaultConnectionId;
      const calendarId = parameters.calendarId || this.defaultCalendarId;
      const timezone = parameters.timezone;

      // Validate required fields
      if (!patient || !patient.name) {
        return {
          status: 'needs_info',
          required: [
            {
              field: 'patient.name',
              type: 'string',
              description: 'Patient name'
            }
          ]
        };
      }

      if (!start || !end) {
        return {
          status: 'needs_info',
          required: [
            {
              field: 'start',
              type: 'string',
              description: 'Appointment start time (ISO 8601 format)'
            },
            {
              field: 'end',
              type: 'string',
              description: 'Appointment end time (ISO 8601 format)'
            }
          ]
        };
      }

      if (!connectionId || !calendarId) {
        return {
          status: 'needs_info',
          required: [
            {
              field: 'connectionId',
              type: 'string',
              description: 'Calendar connection ID'
            },
            {
              field: 'calendarId',
              type: 'string',
              description: 'Calendar ID to book in'
            }
          ]
        };
      }

      // Round times to nearest 15 minutes
      const roundedStart = roundToNearestInterval(start, 15);
      const roundedEnd = roundToNearestInterval(end, 15);

      const appointment: AppointmentDetails = {
        title: parameters.title || `${patient.name} - ${patient.reason || 'Appointment'}`,
        description: parameters.description || this.buildAppointmentDescription(patient),
        start: roundedStart,
        end: roundedEnd,
        timezone,
        location: parameters.location,
        patient,
        reminderMinutes: parameters.reminderMinutes || [1440, 60] // 24 hours and 1 hour before
      };

      const result = await this.calendarService.createAppointment(
        connectionId,
        calendarId,
        appointment
      );

      if (!result.success) {
        return {
          status: 'error',
          error: result.error || {
            code: 'BOOKING_ERROR',
            message: 'Failed to book appointment',
            retryable: result.error?.retryable || false
          }
        };
      }

      return {
        status: 'success',
        data: {
          appointment: result.data,
          confirmation: {
            eventId: result.data?.id,
            title: result.data?.title,
            start: result.data?.start,
            end: result.data?.end,
            location: result.data?.location
          }
        },
        metadata: {
          source: 'direct',
          confidence: 1.0
        }
      };
    } catch (error: any) {
      return {
        status: 'error',
        error: {
          code: 'BOOK_APPOINTMENT_ERROR',
          message: error.message || 'Failed to book appointment',
          retryable: true
        }
      };
    }
  }

  /**
   * Modify an appointment
   */
  private async modifyAppointment(
    parameters: Record<string, any>,
    context: ConversationContext
  ): Promise<TaskResult> {
    try {
      const eventId = parameters.eventId;
      const connectionId = parameters.connectionId || this.defaultConnectionId;
      const calendarId = parameters.calendarId || this.defaultCalendarId;

      if (!eventId) {
        return {
          status: 'needs_info',
          required: [
            {
              field: 'eventId',
              type: 'string',
              description: 'Event ID of appointment to modify'
            }
          ]
        };
      }

      if (!connectionId || !calendarId) {
        return {
          status: 'needs_info',
          required: [
            {
              field: 'connectionId',
              type: 'string',
              description: 'Calendar connection ID'
            },
            {
              field: 'calendarId',
              type: 'string',
              description: 'Calendar ID'
            }
          ]
        };
      }

      const updates: Partial<AppointmentDetails> = {};
      if (parameters.start) updates.start = new Date(parameters.start);
      if (parameters.end) updates.end = new Date(parameters.end);
      if (parameters.title) updates.title = parameters.title;
      if (parameters.description) updates.description = parameters.description;
      if (parameters.location) updates.location = parameters.location;
      if (parameters.patient) updates.patient = parameters.patient;
      if (parameters.timezone) updates.timezone = parameters.timezone;

      const result = await this.calendarService.updateAppointment(
        connectionId,
        calendarId,
        eventId,
        updates
      );

      if (!result.success) {
        return {
          status: 'error',
          error: result.error || {
            code: 'MODIFY_ERROR',
            message: 'Failed to modify appointment',
            retryable: result.error?.retryable || false
          }
        };
      }

      return {
        status: 'success',
        data: {
          appointment: result.data
        },
        metadata: {
          source: 'direct',
          confidence: 1.0
        }
      };
    } catch (error: any) {
      return {
        status: 'error',
        error: {
          code: 'MODIFY_APPOINTMENT_ERROR',
          message: error.message || 'Failed to modify appointment',
          retryable: true
        }
      };
    }
  }

  /**
   * Cancel an appointment
   */
  private async cancelAppointment(
    parameters: Record<string, any>,
    context: ConversationContext
  ): Promise<TaskResult> {
    try {
      const eventId = parameters.eventId;
      const connectionId = parameters.connectionId || this.defaultConnectionId;
      const calendarId = parameters.calendarId || this.defaultCalendarId;

      if (!eventId) {
        return {
          status: 'needs_info',
          required: [
            {
              field: 'eventId',
              type: 'string',
              description: 'Event ID of appointment to cancel'
            }
          ]
        };
      }

      if (!connectionId || !calendarId) {
        return {
          status: 'needs_info',
          required: [
            {
              field: 'connectionId',
              type: 'string',
              description: 'Calendar connection ID'
            },
            {
              field: 'calendarId',
              type: 'string',
              description: 'Calendar ID'
            }
          ]
        };
      }

      const result = await this.calendarService.cancelAppointment(
        connectionId,
        calendarId,
        eventId
      );

      if (!result.success) {
        return {
          status: 'error',
          error: result.error || {
            code: 'CANCEL_ERROR',
            message: 'Failed to cancel appointment',
            retryable: result.error?.retryable || false
          }
        };
      }

      return {
        status: 'success',
        data: {
          cancelled: true,
          eventId
        },
        metadata: {
          source: 'direct',
          confidence: 1.0
        }
      };
    } catch (error: any) {
      return {
        status: 'error',
        error: {
          code: 'CANCEL_APPOINTMENT_ERROR',
          message: error.message || 'Failed to cancel appointment',
          retryable: true
        }
      };
    }
  }

  /**
   * Check appointment details
   */
  private async checkAppointment(
    parameters: Record<string, any>,
    context: ConversationContext
  ): Promise<TaskResult> {
    try {
      const eventId = parameters.eventId;
      const connectionId = parameters.connectionId || this.defaultConnectionId;
      const calendarId = parameters.calendarId || this.defaultCalendarId;

      if (!eventId) {
        return {
          status: 'needs_info',
          required: [
            {
              field: 'eventId',
              type: 'string',
              description: 'Event ID of appointment to check'
            }
          ]
        };
      }

      if (!connectionId || !calendarId) {
        return {
          status: 'needs_info',
          required: [
            {
              field: 'connectionId',
              type: 'string',
              description: 'Calendar connection ID'
            },
            {
              field: 'calendarId',
              type: 'string',
              description: 'Calendar ID'
            }
          ]
        };
      }

      const result = await this.calendarService.getAppointment(
        connectionId,
        calendarId,
        eventId
      );

      if (!result.success) {
        return {
          status: 'error',
          error: result.error || {
            code: 'CHECK_ERROR',
            message: 'Failed to check appointment',
            retryable: result.error?.retryable || false
          }
        };
      }

      return {
        status: 'success',
        data: {
          appointment: result.data
        },
        metadata: {
          source: 'direct',
          confidence: 1.0
        }
      };
    } catch (error: any) {
      return {
        status: 'error',
        error: {
          code: 'CHECK_APPOINTMENT_ERROR',
          message: error.message || 'Failed to check appointment',
          retryable: true
        }
      };
    }
  }

  /**
   * Build appointment description from patient info
   */
  private buildAppointmentDescription(patient: PatientInfo): string {
    const parts: string[] = [];
    
    if (patient.reason) {
      parts.push(`Reason: ${patient.reason}`);
    }
    
    if (patient.phone) {
      parts.push(`Phone: ${patient.phone}`);
    }
    
    if (patient.email) {
      parts.push(`Email: ${patient.email}`);
    }
    
    if (patient.notes) {
      parts.push(`Notes: ${patient.notes}`);
    }

    return parts.join('\n') || 'Appointment booking';
  }
}

