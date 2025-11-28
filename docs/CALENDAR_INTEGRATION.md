# Calendar Integration Guide

This guide explains how to set up and use calendar integrations in the call center voice system.

## Overview

The calendar integration system allows your call center to:
- Connect to Google Calendar, Microsoft Outlook, and Apple Calendar
- Read available time slots from connected calendars
- Book appointments with patient information
- Modify and cancel appointments
- Detect scheduling conflicts

## Architecture

The calendar system consists of:

1. **Calendar Providers**: Implementations for Google, Outlook, and Apple calendars
2. **Calendar Service**: Unified interface that wraps all providers
3. **OAuth Handler**: Manages authentication and token refresh
4. **Appointment Agent**: Sub-agent that handles appointment booking tasks
5. **Calendar Tools**: Tool functions for calendar operations

## Setup

### 1. OAuth Configuration

Before using calendar integrations, you need to set up OAuth applications for each provider.

#### Google Calendar

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google Calendar API
4. Create OAuth 2.0 credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Choose "Web application"
   - Add authorized redirect URIs (e.g., `https://your-app.com/oauth/callback`)
5. Note your Client ID and Client Secret

**Required Scopes:**
- `https://www.googleapis.com/auth/calendar`
- `https://www.googleapis.com/auth/calendar.events`

#### Microsoft Outlook

1. Go to [Azure Portal](https://portal.azure.com/)
2. Register a new application:
   - Go to "Azure Active Directory" > "App registrations"
   - Click "New registration"
   - Set redirect URI (e.g., `https://your-app.com/oauth/callback`)
3. Create a client secret:
   - Go to "Certificates & secrets"
   - Click "New client secret"
4. Note your Application (client) ID and Client secret

**Required Scopes:**
- `Calendars.ReadWrite`
- `offline_access` (for refresh tokens)

#### Apple Calendar

Apple Calendar uses CalDAV protocol, which typically requires:
- iCloud server URL: `https://caldav.icloud.com`
- Apple ID username
- App-specific password (generated in Apple ID settings)

**Note**: Full OAuth 2.0 support for Apple Calendar requires server-side implementation.

### 2. Connecting a Calendar

#### Using the Calendar Connection Dialog

1. Open the workflow editor
2. Click "Connect Calendar" or access calendar settings
3. Select your calendar provider (Google, Outlook, or Apple)
4. Enter your OAuth credentials:
   - Client ID
   - Client Secret
   - Redirect URI
   - Scopes (defaults are provided)
5. Click "Connect via OAuth"
6. Complete the OAuth flow in the popup window
7. Select which calendar to use (if multiple are available)

#### Programmatic Connection

```typescript
import { CalendarService } from './utils/calendar';
import { OAuthHandler } from './utils/calendar/oauthHandler';

const oauthHandler = new OAuthHandler();
const calendarService = new CalendarService(oauthHandler);

// Generate OAuth URL
const authUrl = oauthHandler.generateAuthUrl('google', {
  clientId: 'your-client-id',
  clientSecret: 'your-client-secret',
  redirectUri: 'https://your-app.com/oauth/callback',
  scopes: ['https://www.googleapis.com/auth/calendar']
});

// After OAuth callback, exchange code for tokens
const tokens = await oauthHandler.exchangeCodeForTokens(
  'google',
  oauthConfig,
  authorizationCode
);

// Create connection
const connection: CalendarConnection = {
  id: 'google-connection-1',
  provider: 'google',
  calendarId: 'primary',
  calendarName: 'Primary Calendar',
  tokens,
  status: 'connected',
  createdAt: Date.now(),
  updatedAt: Date.now()
};

await calendarService.registerConnection(connection);
```

## Usage

### Finding Available Slots

```typescript
const slots = await calendarService.findAvailableSlots(
  'connection-id',
  'calendar-id',
  {
    start: new Date('2025-02-01T00:00:00Z'),
    end: new Date('2025-02-07T23:59:59Z'),
    duration: 30, // minutes
    timezone: 'America/New_York',
    businessHours: {
      start: '09:00',
      end: '17:00',
      daysOfWeek: [1, 2, 3, 4, 5] // Monday-Friday
    }
  }
);
```

### Booking an Appointment

```typescript
const appointment: AppointmentDetails = {
  title: 'John Doe - Regular Cleaning',
  description: 'Regular dental cleaning appointment',
  start: new Date('2025-02-03T10:00:00Z'),
  end: new Date('2025-02-03T10:30:00Z'),
  timezone: 'America/New_York',
  location: '123 Main St, Dental Office',
  patient: {
    name: 'John Doe',
    phone: '555-1234',
    email: 'john@example.com',
    reason: 'Regular Cleaning',
    notes: 'First-time patient'
  },
  reminderMinutes: [1440, 60] // 24 hours and 1 hour before
};

const result = await calendarService.createAppointment(
  'connection-id',
  'calendar-id',
  appointment
);
```

### Using the Appointment Agent

The Appointment Agent can be used in your workflow:

```typescript
import { AppointmentAgent } from './utils/subAgents/appointmentAgent';

const appointmentAgent = new AppointmentAgent(
  {
    agentId: 'appointment-agent-1',
    specialty: 'appointments',
    systemPrompt: 'You are an appointment booking agent for a dental office.',
    calendarService,
    defaultConnectionId: 'google-connection-1',
    defaultCalendarId: 'primary',
    defaultAppointmentDuration: 30,
    businessHours: {
      start: '09:00',
      end: '17:00',
      daysOfWeek: [1, 2, 3, 4, 5]
    }
  },
  logger
);
```

**Available Tasks:**
- `find_available_slots` - Find available time slots
- `book_appointment` - Book a new appointment
- `modify_appointment` - Update an existing appointment
- `cancel_appointment` - Cancel an appointment
- `check_appointment` - Get appointment details

### Using Calendar Tools

Calendar tools can be used with ToolAgentExecutor:

```typescript
import { calendarTools } from './utils/tools/calendarTools';

// Get calendar availability
const availability = await calendarTools.getCalendarAvailability(
  { calendarService, defaultConnectionId: 'connection-id' },
  {
    startDate: '2025-02-01T00:00:00Z',
    endDate: '2025-02-07T23:59:59Z',
    duration: 30,
    calendarId: 'primary'
  }
);

// Create calendar event
const event = await calendarTools.createCalendarEvent(
  { calendarService, defaultConnectionId: 'connection-id' },
  {
    patientName: 'John Doe',
    patientPhone: '555-1234',
    patientEmail: 'john@example.com',
    reason: 'Regular Cleaning',
    start: '2025-02-03T10:00:00Z',
    end: '2025-02-03T10:30:00Z',
    calendarId: 'primary'
  }
);
```

## Workflow Example: Dentist Appointment Booking

Here's how a typical appointment booking flow works:

1. **Caller**: "I'd like to book a cleaning appointment"
2. **Master Agent**: Routes to Appointment Sub-Agent
3. **Appointment Agent**: 
   - Collects patient information (name, phone, reason)
   - Calls `find_available_slots` to get available times
   - Returns available slots to master agent
4. **Master Agent**: "I have these available times: Tuesday at 10am, Wednesday at 2pm..."
5. **Caller**: "Tuesday at 10am works"
6. **Appointment Agent**:
   - Validates slot availability
   - Collects remaining info (email, confirmation)
   - Calls `book_appointment` to create calendar event
7. **Master Agent**: "Great! I've booked your appointment for Tuesday, February 3rd at 10:00 AM. You'll receive a confirmation email shortly."

## Error Handling

The calendar system handles various error scenarios:

- **Token Expiration**: Automatically refreshes tokens when expired
- **API Rate Limits**: Implements retry logic with exponential backoff
- **Conflicts**: Detects double-booking and suggests alternative times
- **Network Errors**: Retries failed requests with appropriate backoff

## Security Considerations

1. **Token Storage**: OAuth tokens are encrypted at rest
2. **Token Refresh**: Automatic refresh before expiration
3. **Scope Limitation**: Only requests necessary calendar permissions
4. **Input Validation**: All appointment data is validated
5. **Error Messages**: Sensitive information is not exposed in errors

## Troubleshooting

### Connection Issues

- **"Connection not found"**: Ensure the connection ID is correct and the connection is registered
- **"Token expired"**: The system should auto-refresh, but you may need to reconnect
- **"OAuth flow failed"**: Check that redirect URI matches your OAuth app configuration

### API Errors

- **Rate Limiting**: The system implements retry logic, but you may need to reduce request frequency
- **Invalid Calendar ID**: Use 'primary' for default calendar or the specific calendar ID from `listCalendars()`
- **Permission Errors**: Ensure OAuth scopes include calendar read/write permissions

### Apple Calendar Specific

- **CalDAV Connection**: Requires app-specific password, not regular Apple ID password
- **Server URL**: Verify the CalDAV server URL is correct for your iCloud account
- **Authentication**: Apple Calendar may require different authentication methods

## Best Practices

1. **Connection Management**: Store connection IDs in workflow configuration
2. **Error Handling**: Always check `success` field in operation results
3. **Timezone Handling**: Always specify timezone when working with dates
4. **Conflict Detection**: Always check for conflicts before booking
5. **Patient Data**: Collect and validate all required patient information
6. **Reminders**: Set appropriate reminder times for appointments

## API Reference

See [API_REFERENCE.md](./API_REFERENCE.md) for detailed API documentation.

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review error messages and logs
3. Verify OAuth configuration
4. Test with a simple appointment booking first

