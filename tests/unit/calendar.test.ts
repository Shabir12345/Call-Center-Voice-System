/**
 * Calendar Integration Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CalendarService } from '../../utils/calendar/calendarService';
import { OAuthHandler } from '../../utils/calendar/oauthHandler';
import { GoogleCalendarProvider } from '../../utils/calendar/googleCalendar';
import { OutlookCalendarProvider } from '../../utils/calendar/outlookCalendar';
import { AppleCalendarProvider } from '../../utils/calendar/appleCalendar';
import { AppointmentAgent } from '../../utils/subAgents/appointmentAgent';
import { CentralLogger } from '../../utils/logger';
import {
  CalendarConnection,
  CalendarProvider,
  AppointmentDetails,
  PatientInfo
} from '../../types/calendarTypes';

describe('Calendar Integration', () => {
  let calendarService: CalendarService;
  let oauthHandler: OAuthHandler;
  let logger: CentralLogger;

  beforeEach(() => {
    logger = new CentralLogger();
    oauthHandler = new OAuthHandler();
    calendarService = new CalendarService(oauthHandler);
  });

  describe('OAuthHandler', () => {
    it('should generate Google OAuth URL', () => {
      const config = {
        clientId: 'test-client-id',
        clientSecret: 'test-secret',
        redirectUri: 'http://localhost:3000/callback',
        scopes: ['https://www.googleapis.com/auth/calendar']
      };

      const url = oauthHandler.generateAuthUrl('google', config);
      expect(url).toContain('accounts.google.com');
      expect(url).toContain('test-client-id');
      expect(url).toContain('calendar');
    });

    it('should generate Outlook OAuth URL', () => {
      const config = {
        clientId: 'test-client-id',
        clientSecret: 'test-secret',
        redirectUri: 'http://localhost:3000/callback',
        scopes: ['Calendars.ReadWrite']
      };

      const url = oauthHandler.generateAuthUrl('outlook', config);
      expect(url).toContain('login.microsoftonline.com');
      expect(url).toContain('test-client-id');
    });

    it('should store and retrieve connections', async () => {
      const connection: CalendarConnection = {
        id: 'test-connection-1',
        provider: 'google',
        calendarId: 'primary',
        calendarName: 'Primary Calendar',
        tokens: {
          accessToken: 'test-token',
          refreshToken: 'test-refresh',
          expiresAt: Date.now() + 3600000
        },
        status: 'connected',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      await oauthHandler.storeConnection(connection);
      const retrieved = await oauthHandler.getConnection('test-connection-1');
      
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(connection.id);
      expect(retrieved?.provider).toBe('google');
    });
  });

  describe('CalendarService', () => {
    it('should register a connection', async () => {
      const connection: CalendarConnection = {
        id: 'test-connection',
        provider: 'google',
        calendarId: 'primary',
        tokens: {
          accessToken: 'test-token',
          refreshToken: 'test-refresh'
        },
        status: 'connected',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      // Mock the provider to avoid actual API calls
      const mockProvider = {
        initialize: vi.fn().mockResolvedValue(undefined),
        validateConnection: vi.fn().mockResolvedValue(true),
        listCalendars: vi.fn().mockResolvedValue({
          success: true,
          data: []
        })
      } as any;

      calendarService['providers'].set('google', mockProvider);
      await calendarService.registerConnection(connection);

      const retrieved = calendarService.getConnection('test-connection');
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(connection.id);
    });

    it('should find available slots', async () => {
      const connection: CalendarConnection = {
        id: 'test-connection',
        provider: 'google',
        calendarId: 'primary',
        tokens: {
          accessToken: 'test-token'
        },
        status: 'connected',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      const mockProvider = {
        initialize: vi.fn().mockResolvedValue(undefined),
        validateConnection: vi.fn().mockResolvedValue(true),
        findAvailableSlots: vi.fn().mockResolvedValue({
          success: true,
          data: [
            {
              start: new Date('2025-02-01T10:00:00Z'),
              end: new Date('2025-02-01T10:30:00Z'),
              duration: 30,
              available: true
            }
          ]
        })
      } as any;

      calendarService['providers'].set('google', mockProvider);
      calendarService['connections'].set('test-connection', connection);

      const result = await calendarService.findAvailableSlots(
        'test-connection',
        'primary',
        {
          start: new Date('2025-02-01T00:00:00Z'),
          end: new Date('2025-02-01T23:59:59Z'),
          duration: 30
        }
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.length).toBeGreaterThan(0);
    });
  });

  describe('AppointmentAgent', () => {
    it('should find available slots', async () => {
      const mockCalendarService = {
        findAvailableSlots: vi.fn().mockResolvedValue({
          success: true,
          data: [
            {
              start: new Date('2025-02-01T10:00:00Z'),
              end: new Date('2025-02-01T10:30:00Z'),
              duration: 30,
              available: true
            }
          ]
        })
      } as any;

      const agent = new AppointmentAgent(
        {
          agentId: 'appointment-agent-1',
          specialty: 'appointments',
          systemPrompt: 'You are an appointment booking agent',
          calendarService: mockCalendarService,
          defaultConnectionId: 'test-connection',
          defaultCalendarId: 'primary'
        },
        logger
      );

      const result = await agent['findAvailableSlots'](
        {
          startDate: '2025-02-01T00:00:00Z',
          endDate: '2025-02-01T23:59:59Z',
          duration: 30,
          connectionId: 'test-connection',
          calendarId: 'primary'
        },
        {
          threadId: 'test-thread',
          sessionId: 'test-session',
          callerId: 'test-caller'
        }
      );

      expect(result.status).toBe('success');
      expect(result.data).toBeDefined();
      expect(result.data?.slots).toBeDefined();
    });

    it('should require patient name for booking', async () => {
      const mockCalendarService = {
        createAppointment: vi.fn()
      } as any;

      const agent = new AppointmentAgent(
        {
          agentId: 'appointment-agent-1',
          specialty: 'appointments',
          systemPrompt: 'You are an appointment booking agent',
          calendarService: mockCalendarService
        },
        logger
      );

      const result = await agent['bookAppointment'](
        {
          start: '2025-02-01T10:00:00Z',
          end: '2025-02-01T10:30:00Z'
        },
        {
          threadId: 'test-thread',
          sessionId: 'test-session',
          callerId: 'test-caller'
        }
      );

      expect(result.status).toBe('needs_info');
      expect(result.required).toBeDefined();
      expect(result.required?.some(r => r.field === 'patient.name')).toBe(true);
    });

    it('should book appointment with valid data', async () => {
      const mockCalendarService = {
        createAppointment: vi.fn().mockResolvedValue({
          success: true,
          data: {
            id: 'event-123',
            title: 'John Doe - Cleaning',
            start: new Date('2025-02-01T10:00:00Z'),
            end: new Date('2025-02-01T10:30:00Z')
          }
        })
      } as any;

      const agent = new AppointmentAgent(
        {
          agentId: 'appointment-agent-1',
          specialty: 'appointments',
          systemPrompt: 'You are an appointment booking agent',
          calendarService: mockCalendarService,
          defaultConnectionId: 'test-connection',
          defaultCalendarId: 'primary'
        },
        logger
      );

      const result = await agent['bookAppointment'](
        {
          patient: {
            name: 'John Doe',
            phone: '555-1234',
            email: 'john@example.com',
            reason: 'Cleaning'
          },
          start: '2025-02-01T10:00:00Z',
          end: '2025-02-01T10:30:00Z',
          connectionId: 'test-connection',
          calendarId: 'primary'
        },
        {
          threadId: 'test-thread',
          sessionId: 'test-session',
          callerId: 'test-caller'
        }
      );

      expect(result.status).toBe('success');
      expect(result.data).toBeDefined();
      expect(result.data?.appointment).toBeDefined();
      expect(mockCalendarService.createAppointment).toHaveBeenCalled();
    });
  });

  describe('Calendar Utilities', () => {
    it('should format dates for API', async () => {
      const { formatDateForAPI } = await import('../../utils/calendar/calendarUtils');
      const date = new Date('2025-02-01T10:00:00Z');
      const formatted = formatDateForAPI(date, 'UTC');
      expect(formatted).toContain('2025-02-01');
      expect(formatted).toContain('10:00:00');
    });

    it('should check business hours', async () => {
      const { isWithinBusinessHours } = await import('../../utils/calendar/calendarUtils');
      const date = new Date('2025-02-01T14:00:00Z'); // 2 PM
      
      const withinHours = isWithinBusinessHours(date, {
        start: '09:00',
        end: '17:00'
      });
      
      expect(withinHours).toBe(true);
    });

    it('should round to nearest interval', async () => {
      const { roundToNearestInterval } = await import('../../utils/calendar/calendarUtils');
      const date = new Date('2025-02-01T10:07:00Z');
      const rounded = roundToNearestInterval(date, 15);
      
      expect(rounded.getMinutes()).toBe(0);
    });
  });
});

