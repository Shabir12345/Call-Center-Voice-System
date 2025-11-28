/**
 * Calendar Booking Integration Tests
 * 
 * Tests the full appointment booking flow with calendar integrations
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CalendarService } from '../../utils/calendar/calendarService';
import { OAuthHandler } from '../../utils/calendar/oauthHandler';
import { AppointmentAgent } from '../../utils/subAgents/appointmentAgent';
import { MasterAgent } from '../../utils/masterAgent';
import { CommunicationManager } from '../../utils/agentCommunication';
import { StateManager } from '../../utils/stateManager';
import { CentralLogger } from '../../utils/logger';
import { CalendarConnection, AppointmentDetails, PatientInfo } from '../../types/calendarTypes';

describe('Calendar Booking Integration', () => {
  let calendarService: CalendarService;
  let appointmentAgent: AppointmentAgent;
  let masterAgent: MasterAgent;
  let logger: CentralLogger;
  let stateManager: StateManager;
  let communicationManager: CommunicationManager;

  beforeEach(() => {
    logger = new CentralLogger();
    stateManager = new StateManager();
    communicationManager = new CommunicationManager(logger);
    
    const oauthHandler = new OAuthHandler();
    calendarService = new CalendarService(oauthHandler);

    appointmentAgent = new AppointmentAgent(
      {
        agentId: 'appointment-agent-1',
        specialty: 'appointments',
        systemPrompt: 'You are an appointment booking agent for a dental office.',
        calendarService,
        defaultConnectionId: 'test-connection',
        defaultCalendarId: 'primary',
        defaultAppointmentDuration: 30,
        businessHours: {
          start: '09:00',
          end: '17:00',
          daysOfWeek: [1, 2, 3, 4, 5] // Monday-Friday
        }
      },
      logger
    );

    masterAgent = new MasterAgent(
      {
        agentId: 'master-agent-1',
        systemPrompt: 'You are a helpful assistant.',
        intents: [
          {
            intent: 'book_appointment',
            task: 'book_appointment',
            routeTo: 'appointment-agent-1'
          },
          {
            intent: 'find_slots',
            task: 'find_available_slots',
            routeTo: 'appointment-agent-1'
          }
        ]
      },
      stateManager,
      communicationManager,
      logger
    );

    // Register appointment agent
    communicationManager.registerAgent('appointment-agent-1', appointmentAgent.handleMessage.bind(appointmentAgent));
  });

  it('should handle full appointment booking flow', async () => {
    // Mock calendar service
    const mockFindSlots = vi.fn().mockResolvedValue({
      success: true,
      data: [
        {
          start: new Date('2025-02-03T10:00:00Z'),
          end: new Date('2025-02-03T10:30:00Z'),
          duration: 30,
          available: true
        },
        {
          start: new Date('2025-02-03T14:00:00Z'),
          end: new Date('2025-02-03T14:30:00Z'),
          duration: 30,
          available: true
        }
      ]
    });

    const mockCreateAppointment = vi.fn().mockResolvedValue({
      success: true,
      data: {
        id: 'event-123',
        title: 'John Doe - Regular Cleaning',
        start: new Date('2025-02-03T10:00:00Z'),
        end: new Date('2025-02-03T10:30:00Z'),
        location: 'Dental Office',
        provider: 'google'
      }
    });

    calendarService.findAvailableSlots = mockFindSlots;
    calendarService.createAppointment = mockCreateAppointment;

    // Step 1: Find available slots
    const slotsResult = await appointmentAgent['findAvailableSlots'](
      {
        startDate: '2025-02-03T00:00:00Z',
        endDate: '2025-02-03T23:59:59Z',
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

    expect(slotsResult.status).toBe('success');
    expect(slotsResult.data?.slots.length).toBeGreaterThan(0);

    // Step 2: Book appointment
    const bookingResult = await appointmentAgent['bookAppointment'](
      {
        patient: {
          name: 'John Doe',
          phone: '555-1234',
          email: 'john@example.com',
          reason: 'Regular Cleaning'
        },
        start: '2025-02-03T10:00:00Z',
        end: '2025-02-03T10:30:00Z',
        title: 'John Doe - Regular Cleaning',
        connectionId: 'test-connection',
        calendarId: 'primary'
      },
      {
        threadId: 'test-thread',
        sessionId: 'test-session',
        callerId: 'test-caller'
      }
    );

    expect(bookingResult.status).toBe('success');
    expect(bookingResult.data?.appointment).toBeDefined();
    expect(mockCreateAppointment).toHaveBeenCalled();
  });

  it('should detect appointment conflicts', async () => {
    const mockCheckConflict = vi.fn().mockResolvedValue({
      success: true,
      data: {
        hasConflict: true,
        conflictingEvents: [
          {
            id: 'existing-event',
            title: 'Existing Appointment',
            start: new Date('2025-02-03T10:00:00Z'),
            end: new Date('2025-02-03T10:30:00Z')
          }
        ]
      }
    });

    calendarService.checkConflict = mockCheckConflict;

    const conflictResult = await calendarService.checkConflict(
      'test-connection',
      'primary',
      new Date('2025-02-03T10:00:00Z'),
      new Date('2025-02-03T10:30:00Z')
    );

    expect(conflictResult.success).toBe(true);
    expect(conflictResult.data?.hasConflict).toBe(true);
    expect(conflictResult.data?.conflictingEvents?.length).toBeGreaterThan(0);
  });

  it('should handle appointment cancellation', async () => {
    const mockCancel = vi.fn().mockResolvedValue({
      success: true
    });

    calendarService.cancelAppointment = mockCancel;

    const cancelResult = await appointmentAgent['cancelAppointment'](
      {
        eventId: 'event-123',
        connectionId: 'test-connection',
        calendarId: 'primary'
      },
      {
        threadId: 'test-thread',
        sessionId: 'test-session',
        callerId: 'test-caller'
      }
    );

    expect(cancelResult.status).toBe('success');
    expect(cancelResult.data?.cancelled).toBe(true);
    expect(mockCancel).toHaveBeenCalledWith('test-connection', 'primary', 'event-123');
  });

  it('should validate patient information', async () => {
    const result = await appointmentAgent['bookAppointment'](
      {
        patient: {
          // Missing name
          phone: '555-1234'
        },
        start: '2025-02-03T10:00:00Z',
        end: '2025-02-03T10:30:00Z'
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
});

