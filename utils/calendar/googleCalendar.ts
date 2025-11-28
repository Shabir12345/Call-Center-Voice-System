/**
 * Google Calendar Integration
 * 
 * Implementation of Google Calendar API integration
 */

import {
  BaseCalendarProvider,
  ICalendarProvider
} from './calendarInterface';
import {
  CalendarConnection,
  CalendarEvent,
  AppointmentDetails,
  AvailableSlot,
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
 * Google Calendar provider implementation
 */
export class GoogleCalendarProvider extends BaseCalendarProvider implements ICalendarProvider {
  private oauthHandler: OAuthHandler;
  private apiBaseUrl = 'https://www.googleapis.com/calendar/v3';

  constructor(oauthHandler?: OAuthHandler) {
    super();
    this.oauthHandler = oauthHandler || new OAuthHandler();
  }

  getProviderName(): string {
    return 'google';
  }

  async initialize(connection: CalendarConnection): Promise<void> {
    this.connection = connection;
    this.defaultTimezone = connection.timezone || 'UTC';

    // Validate connection
    if (!await this.validateConnection()) {
      throw new Error('Failed to validate Google Calendar connection');
    }
  }

  async refreshTokens(refreshToken: string): Promise<OAuthTokens> {
    if (!this.connection) {
      throw new Error('Connection not initialized');
    }

    // Get OAuth config from connection metadata or use defaults
    const config = this.connection.metadata?.oauthConfig;
    if (!config) {
      throw new Error('OAuth config not found in connection');
    }

    return await this.oauthHandler.refreshAccessToken('google', config, refreshToken);
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

      const response = await fetch(`${this.apiBaseUrl}/users/me/calendarList`, {
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
            code: `GOOGLE_API_ERROR_${response.status}`,
            message: error.error?.message || 'Failed to list calendars',
            retryable: response.status === 401 || response.status >= 500
          }
        };
      }

      const data = await response.json();
      const calendars = (data.items || []).map((cal: any) => ({
        id: cal.id,
        name: cal.summary || cal.id,
        primary: cal.primary || false,
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
      const params = new URLSearchParams({
        timeMin: formatDateForAPI(start, tz),
        timeMax: formatDateForAPI(end, tz),
        singleEvents: 'true',
        orderBy: 'startTime',
        timeZone: tz
      });

      const response = await fetch(
        `${this.apiBaseUrl}/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
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
            code: `GOOGLE_API_ERROR_${response.status}`,
            message: error.error?.message || 'Failed to get events',
            retryable: response.status === 401 || response.status >= 500
          }
        };
      }

      const data = await response.json();
      const events: CalendarEvent[] = (data.items || []).map((event: any) =>
        this.mapGoogleEventToCalendarEvent(event, calendarId)
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
      const googleEvent = this.mapAppointmentToGoogleEvent(appointment, tz);

      const response = await fetch(
        `${this.apiBaseUrl}/calendars/${encodeURIComponent(calendarId)}/events`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(googleEvent)
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        return {
          success: false,
          error: {
            code: `GOOGLE_API_ERROR_${response.status}`,
            message: error.error?.message || 'Failed to create event',
            retryable: response.status === 401 || response.status >= 500
          }
        };
      }

      const event = await response.json();
      const calendarEvent = this.mapGoogleEventToCalendarEvent(event, calendarId);

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

      const googleEvent = this.mapAppointmentToGoogleEvent(updatedAppointment, tz);

      const response = await fetch(
        `${this.apiBaseUrl}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(googleEvent)
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        return {
          success: false,
          error: {
            code: `GOOGLE_API_ERROR_${response.status}`,
            message: error.error?.message || 'Failed to update event',
            retryable: response.status === 401 || response.status >= 500
          }
        };
      }

      const event = await response.json();
      const calendarEvent = this.mapGoogleEventToCalendarEvent(event, calendarId);

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

      const response = await fetch(
        `${this.apiBaseUrl}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
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
            code: `GOOGLE_API_ERROR_${response.status}`,
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
        timeMin: formatDateForAPI(query.start, tz),
        timeMax: formatDateForAPI(query.end, tz),
        items: [{ id: calendarId }]
      };

      const response = await fetch(`${this.apiBaseUrl}/freeBusy`, {
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
            code: `GOOGLE_API_ERROR_${response.status}`,
            message: error.error?.message || 'Failed to get free/busy',
            retryable: response.status === 401 || response.status >= 500
          }
        };
      }

      const data = await response.json();
      const calendarData = data.calendars?.[calendarId];

      if (!calendarData) {
        return {
          success: false,
          error: {
            code: 'CALENDAR_NOT_FOUND',
            message: 'Calendar not found in free/busy response',
            retryable: false
          }
        };
      }

      const busy = (calendarData.busy || []).map((period: any) => ({
        start: parseDateFromAPI(period.start, tz),
        end: parseDateFromAPI(period.end, tz)
      }));

      // Calculate available periods (gaps between busy periods)
      const available: Array<{ start: Date; end: Date }> = [];
      let currentTime = query.start;

      for (const busyPeriod of busy.sort((a: any, b: any) => a.start.getTime() - b.start.getTime())) {
        if (currentTime < busyPeriod.start) {
          available.push({
            start: currentTime,
            end: busyPeriod.start
          });
        }
        currentTime = busyPeriod.end > currentTime ? busyPeriod.end : currentTime;
      }

      if (currentTime < query.end) {
        available.push({
          start: currentTime,
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

      const response = await fetch(
        `${this.apiBaseUrl}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
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
            code: `GOOGLE_API_ERROR_${response.status}`,
            message: error.error?.message || 'Failed to get event',
            retryable: response.status === 401 || response.status >= 500
          }
        };
      }

      const event = await response.json();
      const calendarEvent = this.mapGoogleEventToCalendarEvent(event, calendarId);

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

  // Helper methods for mapping between Google API and our types

  private mapGoogleEventToCalendarEvent(googleEvent: any, calendarId: string): CalendarEvent {
    const start = googleEvent.start?.dateTime 
      ? parseDateFromAPI(googleEvent.start.dateTime, googleEvent.start.timeZone)
      : parseDateFromAPI(googleEvent.start?.date || new Date().toISOString());
    
    const end = googleEvent.end?.dateTime
      ? parseDateFromAPI(googleEvent.end.dateTime, googleEvent.end.timeZone)
      : parseDateFromAPI(googleEvent.end?.date || new Date().toISOString());

    return {
      id: googleEvent.id,
      title: googleEvent.summary || 'Untitled Event',
      description: googleEvent.description,
      start,
      end,
      timezone: googleEvent.start?.timeZone || googleEvent.end?.timeZone,
      location: googleEvent.location,
      status: googleEvent.status === 'confirmed' ? 'confirmed' : 
              googleEvent.status === 'tentative' ? 'tentative' : 'cancelled',
      attendees: googleEvent.attendees?.map((a: any) => ({
        email: a.email,
        name: a.displayName,
        responseStatus: a.responseStatus
      })),
      organizer: googleEvent.organizer ? {
        email: googleEvent.organizer.email,
        name: googleEvent.organizer.displayName
      } : undefined,
      recurrence: googleEvent.recurrence?.join(';'),
      metadata: {
        patient: googleEvent.extendedProperties?.private?.patient 
          ? JSON.parse(googleEvent.extendedProperties.private.patient)
          : undefined,
        reminderMinutes: googleEvent.reminders?.overrides?.map((r: any) => r.minutes)
      },
      provider: 'google',
      providerEventId: googleEvent.id
    };
  }

  private mapAppointmentToGoogleEvent(appointment: AppointmentDetails, timezone: string): any {
    const event: any = {
      summary: appointment.title,
      description: appointment.description || '',
      start: {
        dateTime: formatDateForAPI(appointment.start, timezone),
        timeZone: timezone
      },
      end: {
        dateTime: formatDateForAPI(appointment.end, timezone),
        timeZone: timezone
      }
    };

    if (appointment.location) {
      event.location = appointment.location;
    }

    if (appointment.attendees && appointment.attendees.length > 0) {
      event.attendees = appointment.attendees.map(a => ({
        email: a.email,
        displayName: a.name
      }));
    }

    if (appointment.reminderMinutes && appointment.reminderMinutes.length > 0) {
      event.reminders = {
        useDefault: false,
        overrides: appointment.reminderMinutes.map(minutes => ({
          method: 'email',
          minutes
        }))
      };
    }

    // Store patient info in extended properties
    if (appointment.patient) {
      event.extendedProperties = {
        private: {
          patient: JSON.stringify(appointment.patient)
        }
      };
    }

    return event;
  }
}

