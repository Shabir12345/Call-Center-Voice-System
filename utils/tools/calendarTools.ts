/**
 * Calendar Tools
 * 
 * Tool functions for calendar operations that can be used by ToolAgentExecutor
 */

import {
  CalendarService,
  AppointmentDetails,
  AvailableSlot,
  AvailabilityQuery,
  FreeBusyQuery,
  PatientInfo
} from '../calendar';
import { ToolExecutionResult } from '../toolAgent';
import { ErrorCode } from '../errorHandling';

/**
 * Calendar tool configuration
 */
export interface CalendarToolConfig {
  calendarService: CalendarService;
  defaultConnectionId?: string;
  defaultCalendarId?: string;
}

/**
 * Get calendar availability tool
 */
export async function getCalendarAvailability(
  config: CalendarToolConfig,
  parameters: Record<string, any>
): Promise<ToolExecutionResult> {
  try {
    const connectionId = parameters.connectionId || config.defaultConnectionId;
    const calendarId = parameters.calendarId || config.defaultCalendarId;
    const startDate = parameters.startDate ? new Date(parameters.startDate) : new Date();
    const endDate = parameters.endDate ? new Date(parameters.endDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // Default: next 7 days
    const duration = parameters.duration || 30; // Default: 30 minutes
    const timezone = parameters.timezone;

    if (!connectionId || !calendarId) {
      return {
        success: false,
        error: {
          code: ErrorCode.INVALID_INPUT,
          message: 'connectionId and calendarId are required',
          details: {
            missing: !connectionId ? ['connectionId'] : ['calendarId']
          }
        }
      };
    }

    const query: AvailabilityQuery = {
      start: startDate,
      end: endDate,
      duration,
      timezone,
      businessHours: parameters.businessHours
    };

    const result = await config.calendarService.findAvailableSlots(
      connectionId,
      calendarId,
      query
    );

    if (!result.success) {
      return {
        success: false,
        error: result.error || {
          code: 'CALENDAR_ERROR',
          message: 'Failed to get calendar availability',
          details: {}
        }
      };
    }

    return {
      success: true,
      data: {
        slots: result.data || [],
        count: result.data?.length || 0,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        duration
      }
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: ErrorCode.EXTERNAL_API_FAILURE,
        message: error.message || 'Failed to get calendar availability',
        details: { error: error.toString() }
      }
    };
  }
}

/**
 * Create calendar event tool
 */
export async function createCalendarEvent(
  config: CalendarToolConfig,
  parameters: Record<string, any>
): Promise<ToolExecutionResult> {
  try {
    const connectionId = parameters.connectionId || config.defaultConnectionId;
    const calendarId = parameters.calendarId || config.defaultCalendarId;
    const start = parameters.start ? new Date(parameters.start) : null;
    const end = parameters.end ? new Date(parameters.end) : null;
    const timezone = parameters.timezone;

    if (!connectionId || !calendarId) {
      return {
        success: false,
        error: {
          code: ErrorCode.INVALID_INPUT,
          message: 'connectionId and calendarId are required',
          details: {
            missing: !connectionId ? ['connectionId'] : ['calendarId']
          }
        }
      };
    }

    if (!start || !end) {
      return {
        success: false,
        error: {
          code: ErrorCode.INVALID_INPUT,
          message: 'start and end times are required',
          details: {
            missing: !start ? ['start'] : ['end']
          }
        }
      };
    }

    const patient: PatientInfo = parameters.patient || {
      name: parameters.patientName || 'Unknown',
      phone: parameters.patientPhone,
      email: parameters.patientEmail,
      reason: parameters.reason,
      notes: parameters.notes
    };

    if (!patient.name) {
      return {
        success: false,
        error: {
          code: ErrorCode.INVALID_INPUT,
          message: 'Patient name is required',
          details: {
            missing: ['patient.name']
          }
        }
      };
    }

    const appointment: AppointmentDetails = {
      title: parameters.title || `${patient.name} - ${patient.reason || 'Appointment'}`,
      description: parameters.description || buildAppointmentDescription(patient),
      start,
      end,
      timezone,
      location: parameters.location,
      patient,
      reminderMinutes: parameters.reminderMinutes || [1440, 60] // 24 hours and 1 hour before
    };

    const result = await config.calendarService.createAppointment(
      connectionId,
      calendarId,
      appointment
    );

    if (!result.success) {
      return {
        success: false,
        error: result.error || {
          code: 'CALENDAR_ERROR',
          message: 'Failed to create calendar event',
          details: {}
        }
      };
    }

    return {
      success: true,
      data: {
        event: result.data,
        eventId: result.data?.id,
        confirmation: {
          title: result.data?.title,
          start: result.data?.start?.toISOString(),
          end: result.data?.end?.toISOString(),
          location: result.data?.location
        }
      }
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: ErrorCode.EXTERNAL_API_FAILURE,
        message: error.message || 'Failed to create calendar event',
        details: { error: error.toString() }
      }
    };
  }
}

/**
 * Update calendar event tool
 */
export async function updateCalendarEvent(
  config: CalendarToolConfig,
  parameters: Record<string, any>
): Promise<ToolExecutionResult> {
  try {
    const connectionId = parameters.connectionId || config.defaultConnectionId;
    const calendarId = parameters.calendarId || config.defaultCalendarId;
    const eventId = parameters.eventId;

    if (!connectionId || !calendarId || !eventId) {
      return {
        success: false,
        error: {
          code: ErrorCode.INVALID_INPUT,
          message: 'connectionId, calendarId, and eventId are required',
          details: {
            missing: [
              !connectionId ? 'connectionId' : null,
              !calendarId ? 'calendarId' : null,
              !eventId ? 'eventId' : null
            ].filter(Boolean)
          }
        }
      };
    }

    const updates: Partial<AppointmentDetails> = {};
    if (parameters.start) updates.start = new Date(parameters.start);
    if (parameters.end) updates.end = new Date(parameters.end);
    if (parameters.title) updates.title = parameters.title;
    if (parameters.description) updates.description = parameters.description;
    if (parameters.location) updates.location = parameters.location;
    if (parameters.timezone) updates.timezone = parameters.timezone;
    if (parameters.patient) updates.patient = parameters.patient;

    const result = await config.calendarService.updateAppointment(
      connectionId,
      calendarId,
      eventId,
      updates
    );

    if (!result.success) {
      return {
        success: false,
        error: result.error || {
          code: 'CALENDAR_ERROR',
          message: 'Failed to update calendar event',
          details: {}
        }
      };
    }

    return {
      success: true,
      data: {
        event: result.data,
        eventId: result.data?.id
      }
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: ErrorCode.EXTERNAL_API_FAILURE,
        message: error.message || 'Failed to update calendar event',
        details: { error: error.toString() }
      }
    };
  }
}

/**
 * Delete calendar event tool
 */
export async function deleteCalendarEvent(
  config: CalendarToolConfig,
  parameters: Record<string, any>
): Promise<ToolExecutionResult> {
  try {
    const connectionId = parameters.connectionId || config.defaultConnectionId;
    const calendarId = parameters.calendarId || config.defaultCalendarId;
    const eventId = parameters.eventId;

    if (!connectionId || !calendarId || !eventId) {
      return {
        success: false,
        error: {
          code: ErrorCode.INVALID_INPUT,
          message: 'connectionId, calendarId, and eventId are required',
          details: {
            missing: [
              !connectionId ? 'connectionId' : null,
              !calendarId ? 'calendarId' : null,
              !eventId ? 'eventId' : null
            ].filter(Boolean)
          }
        }
      };
    }

    const result = await config.calendarService.cancelAppointment(
      connectionId,
      calendarId,
      eventId
    );

    if (!result.success) {
      return {
        success: false,
        error: result.error || {
          code: 'CALENDAR_ERROR',
          message: 'Failed to delete calendar event',
          details: {}
        }
      };
    }

    return {
      success: true,
      data: {
        deleted: true,
        eventId
      }
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: ErrorCode.EXTERNAL_API_FAILURE,
        message: error.message || 'Failed to delete calendar event',
        details: { error: error.toString() }
      }
    };
  }
}

/**
 * Check calendar conflict tool
 */
export async function checkCalendarConflict(
  config: CalendarToolConfig,
  parameters: Record<string, any>
): Promise<ToolExecutionResult> {
  try {
    const connectionId = parameters.connectionId || config.defaultConnectionId;
    const calendarId = parameters.calendarId || config.defaultCalendarId;
    const start = parameters.start ? new Date(parameters.start) : null;
    const end = parameters.end ? new Date(parameters.end) : null;
    const excludeEventId = parameters.excludeEventId;

    if (!connectionId || !calendarId) {
      return {
        success: false,
        error: {
          code: ErrorCode.INVALID_INPUT,
          message: 'connectionId and calendarId are required',
          details: {
            missing: !connectionId ? ['connectionId'] : ['calendarId']
          }
        }
      };
    }

    if (!start || !end) {
      return {
        success: false,
        error: {
          code: ErrorCode.INVALID_INPUT,
          message: 'start and end times are required',
          details: {
            missing: !start ? ['start'] : ['end']
          }
        }
      };
    }

    const result = await config.calendarService.checkConflict(
      connectionId,
      calendarId,
      start,
      end,
      excludeEventId
    );

    if (!result.success) {
      return {
        success: false,
        error: result.error || {
          code: 'CALENDAR_ERROR',
          message: 'Failed to check calendar conflict',
          details: {}
        }
      };
    }

    return {
      success: true,
      data: {
        hasConflict: result.data?.hasConflict || false,
        conflictingEvents: result.data?.conflictingEvents || [],
        suggestedSlots: result.data?.suggestedSlots || []
      }
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: ErrorCode.EXTERNAL_API_FAILURE,
        message: error.message || 'Failed to check calendar conflict',
        details: { error: error.toString() }
      }
    };
  }
}

/**
 * Get free/busy information tool
 */
export async function getFreeBusy(
  config: CalendarToolConfig,
  parameters: Record<string, any>
): Promise<ToolExecutionResult> {
  try {
    const connectionId = parameters.connectionId || config.defaultConnectionId;
    const calendarId = parameters.calendarId || config.defaultCalendarId;
    const start = parameters.start ? new Date(parameters.start) : new Date();
    const end = parameters.end ? new Date(parameters.end) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const timezone = parameters.timezone;

    if (!connectionId || !calendarId) {
      return {
        success: false,
        error: {
          code: ErrorCode.INVALID_INPUT,
          message: 'connectionId and calendarId are required',
          details: {
            missing: !connectionId ? ['connectionId'] : ['calendarId']
          }
        }
      };
    }

    const query: FreeBusyQuery = {
      start,
      end,
      calendarIds: [calendarId],
      timezone
    };

    const result = await config.calendarService.getFreeBusy(
      connectionId,
      calendarId,
      query
    );

    if (!result.success) {
      return {
        success: false,
        error: result.error || {
          code: 'CALENDAR_ERROR',
          message: 'Failed to get free/busy information',
          details: {}
        }
      };
    }

    return {
      success: true,
      data: {
        calendarId: result.data?.calendarId,
        busy: result.data?.busy || [],
        available: result.data?.available || []
      }
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: ErrorCode.EXTERNAL_API_FAILURE,
        message: error.message || 'Failed to get free/busy information',
        details: { error: error.toString() }
      }
    };
  }
}

/**
 * Helper function to build appointment description
 */
function buildAppointmentDescription(patient: PatientInfo): string {
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

/**
 * Export all calendar tools as a map for easy registration
 */
export const calendarTools = {
  getCalendarAvailability,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  checkCalendarConflict,
  getFreeBusy
};

