/**
 * Calendar Integration Types
 * 
 * TypeScript interfaces and types for calendar integration system
 */

/**
 * Calendar provider types
 */
export type CalendarProvider = 'google' | 'outlook' | 'apple';

/**
 * Calendar connection status
 */
export type ConnectionStatus = 'connected' | 'disconnected' | 'expired' | 'error';

/**
 * OAuth token information
 */
export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number; // Unix timestamp
  tokenType?: string;
  scope?: string[];
}

/**
 * Calendar connection configuration
 */
export interface CalendarConnection {
  id: string;
  provider: CalendarProvider;
  calendarId: string; // The specific calendar ID to use
  calendarName?: string; // Human-readable calendar name
  tokens: OAuthTokens;
  status: ConnectionStatus;
  timezone?: string; // IANA timezone (e.g., 'America/New_York')
  createdAt: number;
  updatedAt: number;
  metadata?: {
    userId?: string;
    workflowId?: string;
    [key: string]: any;
  };
}

/**
 * Available time slot
 */
export interface AvailableSlot {
  start: Date;
  end: Date;
  duration: number; // Duration in minutes
  available: boolean;
  reason?: string; // If not available, reason why
}

/**
 * Patient information for appointments
 */
export interface PatientInfo {
  name: string;
  phone?: string;
  email?: string;
  reason?: string; // Reason for visit
  notes?: string; // Additional notes
  customFields?: Record<string, any>;
}

/**
 * Appointment details
 */
export interface AppointmentDetails {
  id?: string; // Event ID (if existing)
  title: string;
  description?: string;
  start: Date;
  end: Date;
  timezone?: string;
  location?: string;
  patient: PatientInfo;
  reminderMinutes?: number[]; // Minutes before to send reminder
  attendees?: Array<{
    email: string;
    name?: string;
  }>;
  metadata?: Record<string, any>;
}

/**
 * Standardized calendar event format
 */
export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  start: Date;
  end: Date;
  timezone?: string;
  location?: string;
  status?: 'confirmed' | 'tentative' | 'cancelled';
  attendees?: Array<{
    email: string;
    name?: string;
    responseStatus?: 'accepted' | 'declined' | 'tentative' | 'needsAction';
  }>;
  organizer?: {
    email: string;
    name?: string;
  };
  recurrence?: string; // RRULE format
  metadata?: Record<string, any>;
  provider?: CalendarProvider;
  providerEventId?: string; // Original event ID from provider
}

/**
 * Free/busy query parameters
 */
export interface FreeBusyQuery {
  start: Date;
  end: Date;
  calendarIds?: string[]; // If not provided, use default calendar
  timezone?: string;
}

/**
 * Free/busy response
 */
export interface FreeBusyResponse {
  calendarId: string;
  busy: Array<{
    start: Date;
    end: Date;
  }>;
  available: Array<{
    start: Date;
    end: Date;
  }>;
}

/**
 * Calendar availability query
 */
export interface AvailabilityQuery {
  start: Date;
  end: Date;
  duration: number; // Required duration in minutes
  timezone?: string;
  businessHours?: {
    start: string; // HH:mm format
    end: string; // HH:mm format
    daysOfWeek?: number[]; // 0-6, Sunday-Saturday
  };
  excludeDates?: Date[]; // Dates to exclude
}

/**
 * Calendar operation result
 */
export interface CalendarOperationResult<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
    retryable?: boolean;
  };
}

/**
 * OAuth configuration for each provider
 */
export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

/**
 * Calendar provider configuration
 */
export interface CalendarProviderConfig {
  provider: CalendarProvider;
  oauth: OAuthConfig;
  defaultCalendarId?: string;
  defaultTimezone?: string;
}

/**
 * Appointment conflict information
 */
export interface AppointmentConflict {
  hasConflict: boolean;
  conflictingEvents?: CalendarEvent[];
  suggestedSlots?: AvailableSlot[];
}

/**
 * Calendar sync status
 */
export interface CalendarSyncStatus {
  connectionId: string;
  lastSyncAt?: number;
  syncStatus: 'synced' | 'syncing' | 'error';
  error?: string;
}

