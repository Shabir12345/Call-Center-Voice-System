/**
 * Microsoft Outlook Calendar Integration
 * 
 * Implementation of Microsoft Graph API integration for Outlook Calendar
 */

import {
  BaseCalendarProvider,
  ICalendarProvider
} from './calendarInterface';
import {
  CalendarConnection,
  CalendarEvent,
  AppointmentDetails,
  FreeBusyQuery,
  FreeBusyResponse,
  AvailabilityQuery,
  CalendarOperationResult,
  AppointmentConflict,
  OAuthTokens
} from '../../types/calendarTypes';
import { formatDateForAPI, parseDateFromAPI } from './calendarUtils';
import { OAuthHandler } from './oauthHandler';

/**
 * Microsoft Outlook Calendar provider implementation
 */
export class OutlookCalendarProvider extends BaseCalendarProvider implements ICalendarProvider {
  private oauthHandler: OAuthHandler;
  private apiBaseUrl = 'https://graph.microsoft.com/v1.0';

  constructor(oauthHandler?: OAuthHandler) {
    super();
    this.oauthHandler = oauthHandler || new OAuthHandler();
  }

  getProviderName(): string {
    return 'outlook';
  }

  async initialize(connection: CalendarConnection): Promise<void> {
    this.connection = connection;
    this.defaultTimezone = connection.timezone || 'UTC';

    // Validate connection
    if (!await this.validateConnection()) {
      throw new Error('Failed to validate Outlook Calendar connection');
    }
  }

  async refreshTokens(refreshToken: string): Promise<OAuthTokens> {
    if (!this.connection) {
      throw new Error('Connection not initialized');
    }

    const config = this.connection.metadata?.oauthConfig;
    if (!config) {
      throw new Error('OAuth config not found in connection');
    }

    return await this.oauthHandler.refreshAccessToken('outlook', config, refreshToken);
  }

  async listCalendars(): Promise<CalendarOperationResult<Array<{
    id: string;
    name: string;
    primary?: boolean;
    timezone?: string;
  }>>> {
    try {
      const accessToken = await this.getAccessToken();
      if (!accessToken) {
        return {
          success: false,
          error: {
            code: 'NO_ACCESS_TOKEN',
            message: 'No access token available',
            retryable: false
          }
        };
      }

      const response = await fetch(`${this.apiBaseUrl}/me/calendars`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        return {
          success: false,
          error: {
            code: `GRAPH_API_ERROR_${response.status}`,
            message: error.error?.message || 'Failed to list calendars',
            retryable: response.status === 401 || response.status >= 500
          }
        };
      }

      const data = await response.json();
      const calendars = (data.value || []).map((cal: any) => ({
        id: cal.id,
        name: cal.name || cal.id,
        primary: cal.isDefaultCalendar || false,
        timezone: cal.timeZone
      }));

      return {
        success: true,
        data: calendars
      };
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: 'LIST_CALENDARS_ERROR',
          message: error.message || 'Failed to list calendars',
          retryable: true
        }
      };
    }
  }

  async getEvents(
    calendarId: string,
    start: Date,
    end: Date,
    timezone?: string
  ): Promise<CalendarOperationResult<CalendarEvent[]>> {
    try {
      const accessToken = await this.getAccessToken();
      if (!accessToken) {
        return {
          success: false,
          error: {
            code: 'NO_ACCESS_TOKEN',
            message: 'No access token available',
            retryable: false
          }
        };
      }

      const tz = timezone || this.defaultTimezone;
      const startStr = formatDateForAPI(start, tz);
      const endStr = formatDateForAPI(end, tz);

      // Use calendarView for time range queries
      const params = new URLSearchParams({
        startDateTime: startStr,
        endDateTime: endStr,
        '$orderby': 'start/dateTime'
      });

      const calendarPath = calendarId === 'primary' || calendarId === 'me'
        ? 'me/calendar'
        : `me/calendars/${encodeURIComponent(calendarId)}`;

      const response = await fetch(
        `${this.apiBaseUrl}/${calendarPath}/calendarView?${params}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Prefer': `outlook.timezone="${tz}"`
          }
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        return {
          success: false,
          error: {
            code: `GRAPH_API_ERROR_${response.status}`,
            message: error.error?.message || 'Failed to get events',
            retryable: response.status === 401 || response.status >= 500
          }
        };
      }

      const data = await response.json();
      const events: CalendarEvent[] = (data.value || []).map((event: any) =>
        this.mapGraphEventToCalendarEvent(event, calendarId)
      );

      return {
        success: true,
        data: events
      };
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: 'GET_EVENTS_ERROR',
          message: error.message || 'Failed to get events',
          retryable: true
        }
      };
    }
  }

  async createEvent(
    calendarId: string,
    appointment: AppointmentDetails
  ): Promise<CalendarOperationResult<CalendarEvent>> {
    try {
      const accessToken = await this.getAccessToken();
      if (!accessToken) {
        return {
          success: false,
          error: {
            code: 'NO_ACCESS_TOKEN',
            message: 'No access token available',
            retryable: false
          }
        };
      }

      const tz = appointment.timezone || this.defaultTimezone;
      const graphEvent = this.mapAppointmentToGraphEvent(appointment, tz);

      const calendarPath = calendarId === 'primary' || calendarId === 'me'
        ? 'me/calendar'
        : `me/calendars/${encodeURIComponent(calendarId)}`;

      const response = await fetch(
        `${this.apiBaseUrl}/${calendarPath}/events`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Prefer': `outlook.timezone="${tz}"`
          },
          body: JSON.stringify(graphEvent)
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        return {
          success: false,
          error: {
            code: `GRAPH_API_ERROR_${response.status}`,
            message: error.error?.message || 'Failed to create event',
            retryable: response.status === 401 || response.status >= 500
          }
        };
      }

      const event = await response.json();
      const calendarEvent = this.mapGraphEventToCalendarEvent(event, calendarId);

      return {
        success: true,
        data: calendarEvent
      };
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: 'CREATE_EVENT_ERROR',
          message: error.message || 'Failed to create event',
          retryable: true
        }
      };
    }
  }

  async updateEvent(
    calendarId: string,
    eventId: string,
    appointment: Partial<AppointmentDetails>
  ): Promise<CalendarOperationResult<CalendarEvent>> {
    try {
      const accessToken = await this.getAccessToken();
      if (!accessToken) {
        return {
          success: false,
          error: {
            code: 'NO_ACCESS_TOKEN',
            message: 'No access token available',
            retryable: false
          }
        };
      }

      // Get existing event first
      const existingResult = await this.getEvent(calendarId, eventId);
      if (!existingResult.success || !existingResult.data) {
        return existingResult as CalendarOperationResult<CalendarEvent>;
      }

      const existing = existingResult.data;
      const tz = appointment.timezone || existing.timezone || this.defaultTimezone;

      // Merge updates
      const updatedAppointment: AppointmentDetails = {
        title: appointment.title || existing.title,
        description: appointment.description || existing.description,
        start: appointment.start || existing.start,
        end: appointment.end || existing.end,
        timezone: tz,
        location: appointment.location || existing.location,
        patient: appointment.patient || existing.metadata?.patient || {
          name: existing.title
        },
        reminderMinutes: appointment.reminderMinutes || existing.metadata?.reminderMinutes
      };

      const graphEvent = this.mapAppointmentToGraphEvent(updatedAppointment, tz);

      const calendarPath = calendarId === 'primary' || calendarId === 'me'
        ? 'me/calendar'
        : `me/calendars/${encodeURIComponent(calendarId)}`;

      const response = await fetch(
        `${this.apiBaseUrl}/${calendarPath}/events/${encodeURIComponent(eventId)}`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Prefer': `outlook.timezone="${tz}"`
          },
          body: JSON.stringify(graphEvent)
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        return {
          success: false,
          error: {
            code: `GRAPH_API_ERROR_${response.status}`,
            message: error.error?.message || 'Failed to update event',
            retryable: response.status === 401 || response.status >= 500
          }
        };
      }

      const event = await response.json();
      const calendarEvent = this.mapGraphEventToCalendarEvent(event, calendarId);

      return {
        success: true,
        data: calendarEvent
      };
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: 'UPDATE_EVENT_ERROR',
          message: error.message || 'Failed to update event',
          retryable: true
        }
      };
    }
  }

  async deleteEvent(
    calendarId: string,
    eventId: string
  ): Promise<CalendarOperationResult<void>> {
    try {
      const accessToken = await this.getAccessToken();
      if (!accessToken) {
        return {
          success: false,
          error: {
            code: 'NO_ACCESS_TOKEN',
            message: 'No access token available',
            retryable: false
          }
        };
      }

      const calendarPath = calendarId === 'primary' || calendarId === 'me'
        ? 'me/calendar'
        : `me/calendars/${encodeURIComponent(calendarId)}`;

      const response = await fetch(
        `${this.apiBaseUrl}/${calendarPath}/events/${encodeURIComponent(eventId)}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );

      if (!response.ok && response.status !== 404) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        return {
          success: false,
          error: {
            code: `GRAPH_API_ERROR_${response.status}`,
            message: error.error?.message || 'Failed to delete event',
            retryable: response.status === 401 || response.status >= 500
          }
        };
      }

      return {
        success: true
      };
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: 'DELETE_EVENT_ERROR',
          message: error.message || 'Failed to delete event',
          retryable: true
        }
      };
    }
  }

  async getFreeBusy(
    calendarId: string,
    query: FreeBusyQuery
  ): Promise<CalendarOperationResult<FreeBusyResponse>> {
    try {
      const accessToken = await this.getAccessToken();
      if (!accessToken) {
        return {
          success: false,
          error: {
            code: 'NO_ACCESS_TOKEN',
            message: 'No access token available',
            retryable: false
          }
        };
      }

      const tz = query.timezone || this.defaultTimezone;
      const requestBody = {
        schedules: [calendarId === 'primary' || calendarId === 'me' ? 'me' : calendarId],
        startTime: {
          dateTime: formatDateForAPI(query.start, tz),
          timeZone: tz
        },
        endTime: {
          dateTime: formatDateForAPI(query.end, tz),
          timeZone: tz
        },
        availabilityViewInterval: 15 // 15-minute intervals
      };

      const response = await fetch(`${this.apiBaseUrl}/me/calendar/getSchedule`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        return {
          success: false,
          error: {
            code: `GRAPH_API_ERROR_${response.status}`,
            message: error.error?.message || 'Failed to get free/busy',
            retryable: response.status === 401 || response.status >= 500
          }
        };
      }

      const data = await response.json();
      const schedule = data.value?.[0];

      if (!schedule) {
        return {
          success: false,
          error: {
            code: 'SCHEDULE_NOT_FOUND',
            message: 'Schedule not found in response',
            retryable: false
          }
        };
      }

      const busy: Array<{ start: Date; end: Date }> = [];
      const availability = schedule.availabilityView || '';

      // Parse availability view (string of 0s and 1s, where 0 = free, 1 = busy)
      // Each character represents a 15-minute interval
      let currentTime = new Date(query.start);
      const intervalMs = 15 * 60 * 1000;

      for (let i = 0; i < availability.length; i++) {
        if (availability[i] === '1') {
          // Busy period
          const start = new Date(currentTime);
          const end = new Date(currentTime.getTime() + intervalMs);
          
          // Merge with previous busy period if continuous
          if (busy.length > 0) {
            const lastBusy = busy[busy.length - 1];
            if (lastBusy.end.getTime() === start.getTime()) {
              lastBusy.end = end;
            } else {
              busy.push({ start, end });
            }
          } else {
            busy.push({ start, end });
          }
        }
        currentTime = new Date(currentTime.getTime() + intervalMs);
      }

      // Calculate available periods
      const available: Array<{ start: Date; end: Date }> = [];
      let currentAvailableStart: Date | null = null;

      currentTime = new Date(query.start);
      for (let i = 0; i < availability.length; i++) {
        if (availability[i] === '0') {
          if (!currentAvailableStart) {
            currentAvailableStart = new Date(currentTime);
          }
        } else {
          if (currentAvailableStart) {
            available.push({
              start: currentAvailableStart,
              end: new Date(currentTime)
            });
            currentAvailableStart = null;
          }
        }
        currentTime = new Date(currentTime.getTime() + intervalMs);
      }

      if (currentAvailableStart) {
        available.push({
          start: currentAvailableStart,
          end: query.end
        });
      }

      return {
        success: true,
        data: {
          calendarId,
          busy,
          available
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: 'GET_FREEBUSY_ERROR',
          message: error.message || 'Failed to get free/busy',
          retryable: true
        }
      };
    }
  }

  async getEvent(
    calendarId: string,
    eventId: string
  ): Promise<CalendarOperationResult<CalendarEvent>> {
    try {
      const accessToken = await this.getAccessToken();
      if (!accessToken) {
        return {
          success: false,
          error: {
            code: 'NO_ACCESS_TOKEN',
            message: 'No access token available',
            retryable: false
          }
        };
      }

      const calendarPath = calendarId === 'primary' || calendarId === 'me'
        ? 'me/calendar'
        : `me/calendars/${encodeURIComponent(calendarId)}`;

      const response = await fetch(
        `${this.apiBaseUrl}/${calendarPath}/events/${encodeURIComponent(eventId)}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        return {
          success: false,
          error: {
            code: `GRAPH_API_ERROR_${response.status}`,
            message: error.error?.message || 'Failed to get event',
            retryable: response.status === 401 || response.status >= 500
          }
        };
      }

      const event = await response.json();
      const calendarEvent = this.mapGraphEventToCalendarEvent(event, calendarId);

      return {
        success: true,
        data: calendarEvent
      };
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: 'GET_EVENT_ERROR',
          message: error.message || 'Failed to get event',
          retryable: true
        }
      };
    }
  }

  // Helper methods for mapping between Graph API and our types

  private mapGraphEventToCalendarEvent(graphEvent: any, calendarId: string): CalendarEvent {
    const start = graphEvent.start?.dateTime
      ? parseDateFromAPI(graphEvent.start.dateTime, graphEvent.start.timeZone)
      : parseDateFromAPI(graphEvent.start?.date || new Date().toISOString());
    
    const end = graphEvent.end?.dateTime
      ? parseDateFromAPI(graphEvent.end.dateTime, graphEvent.end.timeZone)
      : parseDateFromAPI(graphEvent.end?.date || new Date().toISOString());

    return {
      id: graphEvent.id,
      title: graphEvent.subject || 'Untitled Event',
      description: graphEvent.body?.content || graphEvent.bodyPreview,
      start,
      end,
      timezone: graphEvent.start?.timeZone || graphEvent.end?.timeZone,
      location: graphEvent.location?.displayName,
      status: graphEvent.isCancelled ? 'cancelled' :
              graphEvent.showAs === 'tentative' ? 'tentative' : 'confirmed',
      attendees: graphEvent.attendees?.map((a: any) => ({
        email: a.emailAddress?.address,
        name: a.emailAddress?.name,
        responseStatus: a.status?.response === 'accepted' ? 'accepted' :
                       a.status?.response === 'declined' ? 'declined' :
                       a.status?.response === 'tentative' ? 'tentative' : 'needsAction'
      })),
      organizer: graphEvent.organizer ? {
        email: graphEvent.organizer.emailAddress?.address,
        name: graphEvent.organizer.emailAddress?.name
      } : undefined,
      recurrence: graphEvent.recurrence ? JSON.stringify(graphEvent.recurrence) : undefined,
      metadata: {
        patient: graphEvent.singleValueExtendedProperties?.find((p: any) => p.id === 'String {66f5a359-4659-4830-9070-00047ec6ac6e} Name Patient')?.value
          ? JSON.parse(graphEvent.singleValueExtendedProperties.find((p: any) => p.id === 'String {66f5a359-4659-4830-9070-00047ec6ac6e} Name Patient').value)
          : undefined,
        reminderMinutes: graphEvent.reminderMinutesBeforeStart ? [graphEvent.reminderMinutesBeforeStart] : undefined
      },
      provider: 'outlook',
      providerEventId: graphEvent.id
    };
  }

  private mapAppointmentToGraphEvent(appointment: AppointmentDetails, timezone: string): any {
    const event: any = {
      subject: appointment.title,
      body: {
        contentType: 'HTML',
        content: appointment.description || ''
      },
      start: {
        dateTime: formatDateForAPI(appointment.start, timezone),
        timeZone: timezone
      },
      end: {
        dateTime: formatDateForAPI(appointment.end, timezone),
        timeZone: timezone
      },
      isReminderOn: true,
      reminderMinutesBeforeStart: appointment.reminderMinutes?.[0] || 15
    };

    if (appointment.location) {
      event.location = {
        displayName: appointment.location
      };
    }

    if (appointment.attendees && appointment.attendees.length > 0) {
      event.attendees = appointment.attendees.map(a => ({
        emailAddress: {
          address: a.email,
          name: a.name
        },
        type: 'required'
      }));
    }

    // Store patient info in extended properties
    if (appointment.patient) {
      event.singleValueExtendedProperties = [{
        id: 'String {66f5a359-4659-4830-9070-00047ec6ac6e} Name Patient',
        value: JSON.stringify(appointment.patient)
      }];
    }

    return event;
  }
}

