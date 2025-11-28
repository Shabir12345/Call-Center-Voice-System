# Calendar Integration - Where to Find It

## Quick Access Guide

The calendar integration is now available in your app! Here's where to find it:

### 1. **Calendar Integration Node** (In the Sidebar)

The calendar integration node is now available in the **Component Library** sidebar on the left side of your screen:

- **Location**: Left sidebar → "Data & API" section
- **Icon**: Green calendar icon
- **Label**: "Calendar" (with a "New" badge)
- **Description**: "Google, Outlook, Apple"

**How to use it:**
1. Drag the "Calendar" node from the sidebar onto your workflow canvas
2. Click on the node to configure it
3. Select your calendar provider (Google, Outlook, or Apple)
4. Click "Connect" to set up OAuth

### 2. **Calendar Connection Button** (Top Toolbar)

There's a new "Calendar" button in the top-right toolbar:

- **Location**: Top-right corner of the workflow editor
- **Icon**: Green calendar icon
- **Label**: "Calendar" (shows number of connected calendars)
- **Color**: Green button

**How to use it:**
1. Click the "Calendar" button in the top toolbar
2. A dialog will open showing:
   - Available calendar providers (Google, Outlook, Apple)
   - Your existing connections
   - Options to connect new calendars or disconnect existing ones

### 3. **Integration Node Configuration**

When you add a Calendar Integration node to your workflow:

1. **Select Integration Type**: Choose "Calendar" from the dropdown
2. **Select Provider**: Choose Google, Outlook, or Apple Calendar
3. **Connect**: Click the "Connect" button to start the OAuth flow
4. **Use Connection**: Once connected, the node will use that calendar connection for appointment operations

## Step-by-Step: Connecting Your First Calendar

### For Google Calendar:

1. Click the **"Calendar"** button in the top toolbar
2. Click **"Connect Google Calendar"**
3. You'll be redirected to Google's OAuth consent screen
4. Sign in and grant permissions
5. You'll be redirected back to the app
6. Your Google Calendar is now connected!

### For Outlook Calendar:

1. Click the **"Calendar"** button in the top toolbar
2. Click **"Connect Outlook Calendar"**
3. You'll be redirected to Microsoft's OAuth consent screen
4. Sign in with your Microsoft account
5. Grant calendar permissions
6. You'll be redirected back to the app
7. Your Outlook Calendar is now connected!

### For Apple Calendar:

1. Click the **"Calendar"** button in the top toolbar
2. Click **"Connect Apple Calendar"**
3. Follow the instructions for CalDAV setup
4. Enter your iCloud credentials or app-specific password
5. Your Apple Calendar is now connected!

## Using Calendar in Your Workflow

Once you have a calendar connected:

1. **Add a Calendar Integration Node** to your workflow
2. **Select the calendar type** (Google, Outlook, or Apple)
3. **Select your connection** from the dropdown
4. **Connect the node** to your appointment booking sub-agent
5. The calendar will be used for:
   - Checking available time slots
   - Booking appointments
   - Modifying appointments
   - Canceling appointments

## Troubleshooting

**Can't see the Calendar button?**
- Make sure you're in the Workflow Editor view
- Check the top-right toolbar area
- Refresh the page if needed

**Can't see the Calendar node in sidebar?**
- Look in the "Data & API" section
- It should be between "Mock Data" and "Knowledge Base"
- Scroll down if needed

**OAuth not working?**
- Make sure you've set up OAuth credentials (see `CALENDAR_OAUTH_SETUP.md`)
- Check that redirect URIs match your configuration
- Verify your OAuth app is approved (for Google/Microsoft)

## Visual Guide

```
┌─────────────────────────────────────────┐
│  [Top Toolbar]                          │
│  ... [Calendar] [Templates] [Deploy]    │  ← Calendar button here
└─────────────────────────────────────────┘
│                                         │
│  ┌─────────┐      ┌─────────┐          │
│  │ Sidebar │      │ Workflow│          │
│  │         │      │ Canvas  │          │
│  │ Data &  │      │         │          │
│  │ API:    │      │  [Calendar]       │  ← Calendar node here
│  │ • REST  │      │   Node  │          │
│  │ • GraphQL│      │         │          │
│  │ • Mock  │      │         │          │
│  │ • 📅 Calendar│  │         │          │  ← Calendar in sidebar
│  │ • KB    │      │         │          │
│  └─────────┘      └─────────┘          │
└─────────────────────────────────────────┘
```

## Next Steps

1. **Set up OAuth credentials** (see `docs/CALENDAR_OAUTH_SETUP.md`)
2. **Connect your calendar** using the Calendar button
3. **Add a Calendar Integration node** to your workflow
4. **Test appointment booking** using the Test Panel

For detailed setup instructions, see:
- `docs/CALENDAR_INTEGRATION.md` - Full integration guide
- `docs/CALENDAR_OAUTH_SETUP.md` - OAuth configuration

