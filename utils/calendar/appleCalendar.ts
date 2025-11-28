/**
 * Apple Calendar Integration (CalDAV)
 * 
 * Implementation of CalDAV protocol for Apple Calendar/iCloud
 * Note: Apple Calendar typically uses CalDAV with HTTP Basic Auth or app-specific passwords
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
 * Apple Calendar provider implementation using CalDAV
 * Note: This is a simplified implementation. Full CalDAV support requires more complex XML parsing.
 */
export class AppleCalendarProvider extends BaseCalendarProvider implements ICalendarProvider {
  private oauthHandler: OAuthHandler;
  private caldavBaseUrl: string;
  private username: string;
  private password: string; // App-specific password for iCloud

  constructor(oauthHandler?: OAuthHandler) {
    super();
    this.oauthHandler = oauthHandler || new OAuthHandler();
  }

  getProviderName(): string {
    return 'apple';
  }

  async initialize(connection: CalendarConnection): Promise<void> {
    this.connection = connection;
    this.defaultTimezone = connection.timezone || 'UTC';

    // For Apple Calendar, we typically use CalDAV with Basic Auth
    // The connection should contain CalDAV server URL and credentials
    this.caldavBaseUrl = connection.metadata?.caldavUrl || 'https://caldav.icloud.com';
    this.username = connection.metadata?.username || '';
    this.password = connection.tokens.accessToken; // Use access token as password (app-specific password)

    if (!this.username || !this.password) {
      throw new Error('Apple Calendar requires username and app-specific password');
    }

    // Validate connection
    if (!await this.validateConnection()) {
      throw new Error('Failed to validate Apple Calendar connection');
    }
  }

  async refreshTokens(refreshToken: string): Promise<OAuthTokens> {
    // Apple Calendar typically doesn't use OAuth refresh tokens
    // Instead, it uses app-specific passwords that don't expire
    // Return the existing tokens
    if (!this.connection?.tokens) {
      throw new Error('Connection not initialized');
    }
    return this.connection.tokens;
  }

  async listCalendars(): Promise<CalendarOperationResult<Array<{
    id: string;
    name: string;
    primary?: boolean;
    timezone?: string;
  }>>> {
    try {
      // CalDAV PROPFIND request to discover calendars
      const response = await this.caldavRequest('PROPFIND', '/calendars/', {
        depth: '1',
        body: `<?xml version="1.0" encoding="utf-8" ?>
<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <d:displayname/>
    <c:calendar-description/>
    <d:resourcetype/>
  </d:prop>
</d:propfind>`
      });

      if (!response.ok) {
        return {
          success: false,
          error: {
            code: `CALDAV_ERROR_${response.status}`,
            message: 'Failed to list calendars',
            retryable: response.status === 401 || response.status >= 500
          }
        };
      }

      // Parse CalDAV XML response (simplified - full implementation would use proper XML parser)
      const xmlText = await response.text();
      const calendars = this.parseCalendarsFromXML(xmlText);

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
      // CalDAV REPORT request to get events in time range
      const tz = timezone || this.defaultTimezone;
      const startStr = formatDateForAPI(start, tz).replace(/[-:]/g, '').split('.')[0] + 'Z';
      const endStr = formatDateForAPI(end, tz).replace(/[-:]/g, '').split('.')[0] + 'Z';

      const reportBody = `<?xml version="1.0" encoding="utf-8" ?>
<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <d:getetag/>
    <c:calendar-data/>
  </d:prop>
  <c:filter>
    <c:comp-filter name="VCALENDAR">
      <c:comp-filter name="VEVENT">
        <c:time-range start="${startStr}" end="${endStr}"/>
      </c:comp-filter>
    </c:comp-filter>
  </c:filter>
</c:calendar-query>`;

      const response = await this.caldavRequest('REPORT', `/calendars/${encodeURIComponent(calendarId)}/`, {
        depth: '1',
        body: reportBody
      });

      if (!response.ok) {
        return {
          success: false,
          error: {
            code: `CALDAV_ERROR_${response.status}`,
            message: 'Failed to get events',
            retryable: response.status === 401 || response.status >= 500
          }
        };
      }

      const xmlText = await response.text();
      const events = this.parseEventsFromCalDAV(xmlText, calendarId);

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
      const tz = appointment.timezone || this.defaultTimezone;
      const icsContent = this.mapAppointmentToICS(appointment, tz);
      const eventId = `event-${Date.now()}-${Math.random().toString(36).substring(7)}.ics`;

      const response = await this.caldavRequest('PUT', `/calendars/${encodeURIComponent(calendarId)}/${eventId}`, {
        body: icsContent,
        contentType: 'text/calendar; charset=utf-8'
      });

      if (!response.ok) {
        return {
          success: false,
          error: {
            code: `CALDAV_ERROR_${response.status}`,
            message: 'Failed to create event',
            retryable: response.status === 401 || response.status >= 500
          }
        };
      }

      // Get the created event
      const getResult = await this.getEvent(calendarId, eventId);
      return getResult;
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
      // Get existing event
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

      const icsContent = this.mapAppointmentToICS(updatedAppointment, tz);

      const response = await this.caldavRequest('PUT', `/calendars/${encodeURIComponent(calendarId)}/${eventId}`, {
        body: icsContent,
        contentType: 'text/calendar; charset=utf-8'
      });

      if (!response.ok) {
        return {
          success: false,
          error: {
            code: `CALDAV_ERROR_${response.status}`,
            message: 'Failed to update event',
            retryable: response.status === 401 || response.status >= 500
          }
        };
      }

      const getResult = await this.getEvent(calendarId, eventId);
      return getResult;
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
      const response = await this.caldavRequest('DELETE', `/calendars/${encodeURIComponent(calendarId)}/${eventId}`);

      if (!response.ok && response.status !== 404) {
        return {
          success: false,
          error: {
            code: `CALDAV_ERROR_${response.status}`,
            message: 'Failed to delete event',
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
      // Use getEvents and calculate free/busy from that
      const eventsResult = await this.getEvents(calendarId, query.start, query.end, query.timezone);
      if (!eventsResult.success) {
        return {
          success: false,
          error: eventsResult.error
        };
      }

      const events = eventsResult.data || [];
      const busy = events.map(event => ({
        start: event.start,
        end: event.end
      }));

      // Calculate available periods
      const available: Array<{ start: Date; end: Date }> = [];
      let currentTime = query.start;

      for (const busyPeriod of busy.sort((a, b) => a.start.getTime() - b.start.getTime())) {
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
      const response = await this.caldavRequest('GET', `/calendars/${encodeURIComponent(calendarId)}/${eventId}`);

      if (!response.ok) {
        return {
          success: false,
          error: {
            code: `CALDAV_ERROR_${response.status}`,
            message: 'Failed to get event',
            retryable: response.status === 401 || response.status >= 500
          }
        };
      }

      const icsText = await response.text();
      const event = this.parseEventFromICS(icsText, calendarId);

      return {
        success: true,
        data: event
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

  // Private helper methods

  private async caldavRequest(
    method: string,
    path: string,
    options: {
      depth?: string;
      body?: string;
      contentType?: string;
    } = {}
  ): Promise<Response> {
    const url = `${this.caldavBaseUrl}${path}`;
    const headers: Record<string, string> = {
      'Authorization': `Basic ${btoa(`${this.username}:${this.password}`)}`,
      'Content-Type': options.contentType || 'application/xml; charset=utf-8'
    };

    if (options.depth) {
      headers['Depth'] = options.depth;
    }

    return fetch(url, {
      method,
      headers,
      body: options.body
    });
  }

  private parseCalendarsFromXML(xmlText: string): Array<{
    id: string;
    name: string;
    primary?: boolean;
    timezone?: string;
  }> {
    // Simplified XML parsing - in production, use a proper XML parser
    const calendars: Array<{ id: string; name: string; primary?: boolean; timezone?: string }> = [];
    const hrefMatches = xmlText.matchAll(/<d:href>([^<]+)<\/d:href>/g);
    
    for (const match of hrefMatches) {
      const href = match[1];
      if (href.includes('/calendars/') && !href.endsWith('/calendars/')) {
        const calendarId = href.split('/calendars/')[1].replace(/\/$/, '');
        const nameMatch = xmlText.match(new RegExp(`<d:displayname[^>]*>([^<]+)<\/d:displayname>`));
        calendars.push({
          id: calendarId,
          name: nameMatch ? nameMatch[1] : calendarId,
          primary: false
        });
      }
    }

    return calendars;
  }

  private parseEventsFromCalDAV(xmlText: string, calendarId: string): CalendarEvent[] {
    // Extract iCalendar data from CalDAV XML response
    const icsMatches = xmlText.matchAll(/<c:calendar-data[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/c:calendar-data>/g);
    const events: CalendarEvent[] = [];

    for (const match of icsMatches) {
      const icsContent = match[1];
      try {
        const event = this.parseEventFromICS(icsContent, calendarId);
        events.push(event);
      } catch (error) {
        console.error('Failed to parse iCalendar event:', error);
      }
    }

    return events;
  }

  private parseEventFromICS(icsContent: string, calendarId: string): CalendarEvent {
    // Simplified iCalendar parsing - in production, use a proper iCalendar parser like ical.js
    const lines = icsContent.split(/\r?\n/);
    const event: Partial<CalendarEvent> = {
      id: '',
      title: '',
      start: new Date(),
      end: new Date(),
      provider: 'apple',
      metadata: {}
    };

    let currentProperty = '';
    for (const line of lines) {
      if (line.startsWith('UID:')) {
        event.id = line.substring(4).trim();
        event.providerEventId = event.id;
      } else if (line.startsWith('SUMMARY:')) {
        event.title = line.substring(8).trim();
      } else if (line.startsWith('DESCRIPTION:')) {
        event.description = (event.description || '') + line.substring(12).trim();
      } else if (line.startsWith('DTSTART')) {
        const dateStr = line.includes(':') ? line.split(':')[1] : '';
        event.start = parseDateFromAPI(dateStr);
      } else if (line.startsWith('DTEND')) {
        const dateStr = line.includes(':') ? line.split(':')[1] : '';
        event.end = parseDateFromAPI(dateStr);
      } else if (line.startsWith('LOCATION:')) {
        event.location = line.substring(9).trim();
      }
    }

    if (!event.id) {
      event.id = `apple-${Date.now()}`;
    }

    return event as CalendarEvent;
  }

  private mapAppointmentToICS(appointment: AppointmentDetails, timezone: string): string {
    const formatICSDate = (date: Date): string => {
      return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const uid = appointment.id || `event-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const startStr = formatICSDate(appointment.start);
    const endStr = formatICSDate(appointment.end);

    let ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Call Center System//EN
BEGIN:VEVENT
UID:${uid}
DTSTART:${startStr}
DTEND:${endStr}
SUMMARY:${appointment.title}
`;

    if (appointment.description) {
      ics += `DESCRIPTION:${appointment.description.replace(/\n/g, '\\n')}\n`;
    }

    if (appointment.location) {
      ics += `LOCATION:${appointment.location}\n`;
    }

    if (appointment.attendees) {
      for (const attendee of appointment.attendees) {
        ics += `ATTENDEE;CN=${attendee.name || ''}:mailto:${attendee.email}\n`;
      }
    }

    // Store patient info in description
    if (appointment.patient) {
      ics += `X-PATIENT:${JSON.stringify(appointment.patient)}\n`;
    }

    ics += `END:VEVENT
END:VCALENDAR`;

    return ics;
  }
}

