/**
 * Calendar Interface
 * 
 * Abstract interface for calendar providers (Google, Outlook, Apple)
 */

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
import { findAvailableSlots, timeRangesOverlap } from './calendarUtils';

/**
 * Abstract calendar provider interface
 * All calendar implementations must implement this interface
 */
export interface ICalendarProvider {
  /**
   * Get provider name
   */
  getProviderName(): string;

  /**
   * Initialize connection with OAuth tokens
   */
  initialize(connection: CalendarConnection): Promise<void>;

  /**
   * Refresh OAuth tokens
   */
  refreshTokens(refreshToken: string): Promise<OAuthTokens>;

  /**
   * Get list of calendars available to the user
   */
  listCalendars(): Promise<CalendarOperationResult<Array<{
    id: string;
    name: string;
    primary?: boolean;
    timezone?: string;
  }>>>;

  /**
   * Get calendar events within a time range
   */
  getEvents(
    calendarId: string,
    start: Date,
    end: Date,
    timezone?: string
  ): Promise<CalendarOperationResult<CalendarEvent[]>>;

  /**
   * Create a new calendar event (appointment)
   */
  createEvent(
    calendarId: string,
    appointment: AppointmentDetails
  ): Promise<CalendarOperationResult<CalendarEvent>>;

  /**
   * Update an existing calendar event
   */
  updateEvent(
    calendarId: string,
    eventId: string,
    appointment: Partial<AppointmentDetails>
  ): Promise<CalendarOperationResult<CalendarEvent>>;

  /**
   * Delete a calendar event
   */
  deleteEvent(
    calendarId: string,
    eventId: string
  ): Promise<CalendarOperationResult<void>>;

  /**
   * Get free/busy information for time range
   */
  getFreeBusy(
    calendarId: string,
    query: FreeBusyQuery
  ): Promise<CalendarOperationResult<FreeBusyResponse>>;

  /**
   * Find available time slots
   */
  findAvailableSlots(
    calendarId: string,
    query: AvailabilityQuery
  ): Promise<CalendarOperationResult<AvailableSlot[]>>;

  /**
   * Check for appointment conflicts
   */
  checkConflict(
    calendarId: string,
    start: Date,
    end: Date,
    excludeEventId?: string
  ): Promise<CalendarOperationResult<AppointmentConflict>>;

  /**
   * Get a specific event by ID
   */
  getEvent(
    calendarId: string,
    eventId: string
  ): Promise<CalendarOperationResult<CalendarEvent>>;

  /**
   * Validate connection and tokens
   */
  validateConnection(): Promise<boolean>;
}

/**
 * Base calendar provider class with common functionality
 */
export abstract class BaseCalendarProvider implements ICalendarProvider {
  protected connection?: CalendarConnection;
  protected defaultTimezone: string = 'UTC';

  abstract getProviderName(): string;
  abstract initialize(connection: CalendarConnection): Promise<void>;
  abstract refreshTokens(refreshToken: string): Promise<OAuthTokens>;
  abstract listCalendars(): Promise<CalendarOperationResult<Array<{
    id: string;
    name: string;
    primary?: boolean;
    timezone?: string;
  }>>>;
  abstract getEvents(
    calendarId: string,
    start: Date,
    end: Date,
    timezone?: string
  ): Promise<CalendarOperationResult<CalendarEvent[]>>;
  abstract createEvent(
    calendarId: string,
    appointment: AppointmentDetails
  ): Promise<CalendarOperationResult<CalendarEvent>>;
  abstract updateEvent(
    calendarId: string,
    eventId: string,
    appointment: Partial<AppointmentDetails>
  ): Promise<CalendarOperationResult<CalendarEvent>>;
  abstract deleteEvent(
    calendarId: string,
    eventId: string
  ): Promise<CalendarOperationResult<void>>;
  abstract getFreeBusy(
    calendarId: string,
    query: FreeBusyQuery
  ): Promise<CalendarOperationResult<FreeBusyResponse>>;

  /**
   * Default implementation of findAvailableSlots using getFreeBusy
   */
  async findAvailableSlots(
    calendarId: string,
    query: AvailabilityQuery
  ): Promise<CalendarOperationResult<AvailableSlot[]>> {
    try {
      // Get free/busy information
      const freeBusyQuery: FreeBusyQuery = {
        start: query.start,
        end: query.end,
        calendarIds: [calendarId],
        timezone: query.timezone || this.defaultTimezone
      };

      const freeBusyResult = await this.getFreeBusy(calendarId, freeBusyQuery);
      if (!freeBusyResult.success || !freeBusyResult.data) {
        return {
          success: false,
          error: freeBusyResult.error || {
            code: 'FREEBUSY_ERROR',
            message: 'Failed to get free/busy information'
          }
        };
      }

      // Use utility function to find available slots
      const slots = findAvailableSlots(freeBusyResult.data, query);

      return {
        success: true,
        data: slots
      };
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: 'SLOT_FINDING_ERROR',
          message: error.message || 'Failed to find available slots',
          retryable: true
        }
      };
    }
  }

  /**
   * Default implementation of checkConflict using getEvents
   */
  async checkConflict(
    calendarId: string,
    start: Date,
    end: Date,
    excludeEventId?: string
  ): Promise<CalendarOperationResult<AppointmentConflict>> {
    try {
      // Get events in the time range
      const eventsResult = await this.getEvents(calendarId, start, end);
      if (!eventsResult.success) {
        return {
          success: false,
          error: eventsResult.error
        };
      }

      const events = eventsResult.data || [];
      const conflictingEvents = events.filter(event => {
        // Exclude the event we're checking (for updates)
        if (excludeEventId && event.id === excludeEventId) {
          return false;
        }

        // Check if event overlaps with the time range
        return timeRangesOverlap(event.start, event.end, start, end);
      });

      return {
        success: true,
        data: {
          hasConflict: conflictingEvents.length > 0,
          conflictingEvents: conflictingEvents.length > 0 ? conflictingEvents : undefined
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: 'CONFLICT_CHECK_ERROR',
          message: error.message || 'Failed to check for conflicts',
          retryable: true
        }
      };
    }
  }

  abstract getEvent(
    calendarId: string,
    eventId: string
  ): Promise<CalendarOperationResult<CalendarEvent>>;

  /**
   * Default implementation of validateConnection
   */
  async validateConnection(): Promise<boolean> {
    if (!this.connection) {
      return false;
    }

    try {
      // Try to list calendars as a validation check
      const result = await this.listCalendars();
      return result.success;
    } catch {
      return false;
    }
  }

  /**
   * Check if tokens are expired
   */
  protected isTokenExpired(): boolean {
    if (!this.connection?.tokens.expiresAt) {
      return false; // No expiration set
    }
    return Date.now() >= this.connection.tokens.expiresAt;
  }

  /**
   * Get access token, refreshing if needed
   */
  protected async getAccessToken(): Promise<string | null> {
    if (!this.connection?.tokens.accessToken) {
      return null;
    }

    // Check if token is expired and refresh if needed
    if (this.isTokenExpired() && this.connection.tokens.refreshToken) {
      try {
        const newTokens = await this.refreshTokens(this.connection.tokens.refreshToken);
        if (this.connection) {
          this.connection.tokens = newTokens;
        }
        return newTokens.accessToken;
      } catch (error) {
        return null;
      }
    }

    return this.connection.tokens.accessToken;
  }
}

