/**
 * Unified Calendar Service
 * 
 * Wraps all calendar providers (Google, Outlook, Apple) with a consistent interface
 */

import {
  CalendarProvider,
  CalendarConnection,
  CalendarEvent,
  AppointmentDetails,
  AvailableSlot,
  FreeBusyQuery,
  FreeBusyResponse,
  AvailabilityQuery,
  CalendarOperationResult,
  AppointmentConflict
} from '../../types/calendarTypes';
import { ICalendarProvider } from './calendarInterface';
import { GoogleCalendarProvider } from './googleCalendar';
import { OutlookCalendarProvider } from './outlookCalendar';
import { AppleCalendarProvider } from './appleCalendar';
import { OAuthHandler } from './oauthHandler';

/**
 * Unified calendar service
 */
export class CalendarService {
  private providers: Map<CalendarProvider, ICalendarProvider> = new Map();
  private connections: Map<string, CalendarConnection> = new Map();
  private oauthHandler: OAuthHandler;

  constructor(oauthHandler?: OAuthHandler) {
    this.oauthHandler = oauthHandler || new OAuthHandler();
    
    // Initialize providers
    this.providers.set('google', new GoogleCalendarProvider(this.oauthHandler));
    this.providers.set('outlook', new OutlookCalendarProvider(this.oauthHandler));
    this.providers.set('apple', new AppleCalendarProvider(this.oauthHandler));
  }

  /**
   * Register a calendar connection
   */
  async registerConnection(connection: CalendarConnection): Promise<void> {
    const provider = this.providers.get(connection.provider);
    if (!provider) {
      throw new Error(`Unsupported calendar provider: ${connection.provider}`);
    }

    await provider.initialize(connection);
    this.connections.set(connection.id, connection);
  }

  /**
   * Get connection by ID
   */
  getConnection(connectionId: string): CalendarConnection | undefined {
    return this.connections.get(connectionId);
  }

  /**
   * Get all connections
   */
  getAllConnections(): CalendarConnection[] {
    return Array.from(this.connections.values());
  }

  /**
   * Remove a connection
   */
  removeConnection(connectionId: string): void {
    this.connections.delete(connectionId);
  }

  /**
   * Get provider for a connection
   */
  private getProviderForConnection(connectionId: string): ICalendarProvider | null {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return null;
    }

    const provider = this.providers.get(connection.provider);
    if (!provider) {
      return null;
    }

    return provider;
  }

  /**
   * List calendars for a connection
   */
  async listCalendars(connectionId: string): Promise<CalendarOperationResult<Array<{
    id: string;
    name: string;
    primary?: boolean;
    timezone?: string;
  }>>> {
    const provider = this.getProviderForConnection(connectionId);
    if (!provider) {
      return {
        success: false,
        error: {
          code: 'CONNECTION_NOT_FOUND',
          message: 'Calendar connection not found',
          retryable: false
        }
      };
    }

    return await provider.listCalendars();
  }

  /**
   * Get events from a calendar
   */
  async getEvents(
    connectionId: string,
    calendarId: string,
    start: Date,
    end: Date,
    timezone?: string
  ): Promise<CalendarOperationResult<CalendarEvent[]>> {
    const provider = this.getProviderForConnection(connectionId);
    if (!provider) {
      return {
        success: false,
        error: {
          code: 'CONNECTION_NOT_FOUND',
          message: 'Calendar connection not found',
          retryable: false
        }
      };
    }

    return await provider.getEvents(calendarId, start, end, timezone);
  }

  /**
   * Create an appointment/event
   */
  async createAppointment(
    connectionId: string,
    calendarId: string,
    appointment: AppointmentDetails
  ): Promise<CalendarOperationResult<CalendarEvent>> {
    const provider = this.getProviderForConnection(connectionId);
    if (!provider) {
      return {
        success: false,
        error: {
          code: 'CONNECTION_NOT_FOUND',
          message: 'Calendar connection not found',
          retryable: false
        }
      };
    }

    // Check for conflicts first
    const conflictResult = await provider.checkConflict(
      calendarId,
      appointment.start,
      appointment.end
    );

    if (conflictResult.success && conflictResult.data?.hasConflict) {
      return {
        success: false,
        error: {
          code: 'APPOINTMENT_CONFLICT',
          message: 'Time slot is already booked',
          details: conflictResult.data,
          retryable: false
        }
      };
    }

    return await provider.createEvent(calendarId, appointment);
  }

  /**
   * Update an appointment
   */
  async updateAppointment(
    connectionId: string,
    calendarId: string,
    eventId: string,
    appointment: Partial<AppointmentDetails>
  ): Promise<CalendarOperationResult<CalendarEvent>> {
    const provider = this.getProviderForConnection(connectionId);
    if (!provider) {
      return {
        success: false,
        error: {
          code: 'CONNECTION_NOT_FOUND',
          message: 'Calendar connection not found',
          retryable: false
        }
      };
    }

    // Check for conflicts (excluding the event being updated)
    if (appointment.start && appointment.end) {
      const conflictResult = await provider.checkConflict(
        calendarId,
        appointment.start,
        appointment.end,
        eventId
      );

      if (conflictResult.success && conflictResult.data?.hasConflict) {
        return {
          success: false,
          error: {
            code: 'APPOINTMENT_CONFLICT',
            message: 'Updated time slot is already booked',
            details: conflictResult.data,
            retryable: false
          }
        };
      }
    }

    return await provider.updateEvent(calendarId, eventId, appointment);
  }

  /**
   * Cancel/delete an appointment
   */
  async cancelAppointment(
    connectionId: string,
    calendarId: string,
    eventId: string
  ): Promise<CalendarOperationResult<void>> {
    const provider = this.getProviderForConnection(connectionId);
    if (!provider) {
      return {
        success: false,
        error: {
          code: 'CONNECTION_NOT_FOUND',
          message: 'Calendar connection not found',
          retryable: false
        }
      };
    }

    return await provider.deleteEvent(calendarId, eventId);
  }

  /**
   * Find available time slots
   */
  async findAvailableSlots(
    connectionId: string,
    calendarId: string,
    query: AvailabilityQuery
  ): Promise<CalendarOperationResult<AvailableSlot[]>> {
    const provider = this.getProviderForConnection(connectionId);
    if (!provider) {
      return {
        success: false,
        error: {
          code: 'CONNECTION_NOT_FOUND',
          message: 'Calendar connection not found',
          retryable: false
        }
      };
    }

    return await provider.findAvailableSlots(calendarId, query);
  }

  /**
   * Check for appointment conflicts
   */
  async checkConflict(
    connectionId: string,
    calendarId: string,
    start: Date,
    end: Date,
    excludeEventId?: string
  ): Promise<CalendarOperationResult<AppointmentConflict>> {
    const provider = this.getProviderForConnection(connectionId);
    if (!provider) {
      return {
        success: false,
        error: {
          code: 'CONNECTION_NOT_FOUND',
          message: 'Calendar connection not found',
          retryable: false
        }
      };
    }

    return await provider.checkConflict(calendarId, start, end, excludeEventId);
  }

  /**
   * Get a specific appointment
   */
  async getAppointment(
    connectionId: string,
    calendarId: string,
    eventId: string
  ): Promise<CalendarOperationResult<CalendarEvent>> {
    const provider = this.getProviderForConnection(connectionId);
    if (!provider) {
      return {
        success: false,
        error: {
          code: 'CONNECTION_NOT_FOUND',
          message: 'Calendar connection not found',
          retryable: false
        }
      };
    }

    return await provider.getEvent(calendarId, eventId);
  }

  /**
   * Get free/busy information
   */
  async getFreeBusy(
    connectionId: string,
    calendarId: string,
    query: FreeBusyQuery
  ): Promise<CalendarOperationResult<FreeBusyResponse>> {
    const provider = this.getProviderForConnection(connectionId);
    if (!provider) {
      return {
        success: false,
        error: {
          code: 'CONNECTION_NOT_FOUND',
          message: 'Calendar connection not found',
          retryable: false
        }
      };
    }

    return await provider.getFreeBusy(calendarId, query);
  }

  /**
   * Validate a connection
   */
  async validateConnection(connectionId: string): Promise<boolean> {
    const provider = this.getProviderForConnection(connectionId);
    if (!provider) {
      return false;
    }

    return await provider.validateConnection();
  }

  /**
   * Refresh tokens for a connection
   */
  async refreshConnectionTokens(connectionId: string): Promise<boolean> {
    const connection = this.connections.get(connectionId);
    if (!connection || !connection.tokens.refreshToken) {
      return false;
    }

    try {
      const provider = this.providers.get(connection.provider);
      if (!provider) {
        return false;
      }

      const newTokens = await provider.refreshTokens(connection.tokens.refreshToken);
      connection.tokens = newTokens;
      connection.updatedAt = Date.now();
      
      // Re-initialize provider with new tokens
      await provider.initialize(connection);
      
      return true;
    } catch (error) {
      console.error('Failed to refresh tokens:', error);
      return false;
    }
  }

  /**
   * Get OAuth handler (for UI integration)
   */
  getOAuthHandler(): OAuthHandler {
    return this.oauthHandler;
  }
}

