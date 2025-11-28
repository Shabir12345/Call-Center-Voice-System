# Calendar OAuth Setup Guide

Step-by-step instructions for setting up OAuth for each calendar provider.

## Google Calendar OAuth Setup

### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" > "New Project"
3. Enter project name (e.g., "Call Center Calendar Integration")
4. Click "Create"

### Step 2: Enable Google Calendar API

1. In your project, go to "APIs & Services" > "Library"
2. Search for "Google Calendar API"
3. Click on it and press "Enable"

### Step 3: Create OAuth 2.0 Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. If prompted, configure OAuth consent screen:
   - User Type: External (or Internal for Google Workspace)
   - App name: Your app name
   - User support email: Your email
   - Developer contact: Your email
   - Click "Save and Continue"
   - Add scopes:
     - `https://www.googleapis.com/auth/calendar`
     - `https://www.googleapis.com/auth/calendar.events`
   - Click "Save and Continue"
   - Add test users if needed
   - Click "Save and Continue" > "Back to Dashboard"
4. Create OAuth client:
   - Application type: Web application
   - Name: "Call Center Calendar Integration"
   - Authorized redirect URIs:
     - `http://localhost:3000/oauth/callback` (for development)
     - `https://your-production-domain.com/oauth/callback` (for production)
   - Click "Create"
5. Copy your Client ID and Client Secret

### Step 4: Configure in Your App

Use these values in the Calendar Connection Dialog:
- **Client ID**: Your OAuth client ID
- **Client Secret**: Your OAuth client secret
- **Redirect URI**: Must match one of your authorized redirect URIs
- **Scopes**: 
  ```
  https://www.googleapis.com/auth/calendar,https://www.googleapis.com/auth/calendar.events
  ```

## Microsoft Outlook OAuth Setup

### Step 1: Register Application in Azure

1. Go to [Azure Portal](https://portal.azure.com/)
2. Navigate to "Azure Active Directory" > "App registrations"
3. Click "New registration"
4. Fill in:
   - Name: "Call Center Calendar Integration"
   - Supported account types: "Accounts in any organizational directory and personal Microsoft accounts"
   - Redirect URI: 
     - Platform: Web
     - URI: `https://your-app.com/oauth/callback`
5. Click "Register"

### Step 2: Create Client Secret

1. In your app registration, go to "Certificates & secrets"
2. Click "New client secret"
3. Enter description: "Calendar Integration Secret"
4. Choose expiration (recommend 24 months)
5. Click "Add"
6. **Important**: Copy the secret value immediately (it won't be shown again)

### Step 3: Configure API Permissions

1. Go to "API permissions"
2. Click "Add a permission"
3. Select "Microsoft Graph"
4. Select "Delegated permissions"
5. Add these permissions:
   - `Calendars.ReadWrite`
   - `offline_access` (for refresh tokens)
6. Click "Add permissions"
7. Click "Grant admin consent" (if you have admin rights)

### Step 4: Configure in Your App

Use these values:
- **Client ID**: Application (client) ID from Overview page
- **Client Secret**: The secret value you copied
- **Redirect URI**: Must match your registered redirect URI
- **Scopes**: 
  ```
  Calendars.ReadWrite offline_access
  ```

## Apple Calendar Setup

### Option 1: App-Specific Password (Recommended for CalDAV)

1. Go to [appleid.apple.com](https://appleid.apple.com/)
2. Sign in with your Apple ID
3. Go to "Sign-In and Security" > "App-Specific Passwords"
4. Click "Generate an app-specific password"
5. Enter label: "Call Center Calendar"
6. Copy the generated password
7. Use these credentials:
   - **Username**: Your Apple ID email
   - **Password**: The app-specific password
   - **Server URL**: `https://caldav.icloud.com`

### Option 2: OAuth 2.0 (Requires Server-Side Implementation)

Apple Calendar OAuth requires server-side token exchange. For now, use app-specific passwords with CalDAV.

## Testing Your Setup

### Test Google Calendar Connection

1. Open Calendar Connection Dialog
2. Select "Google Calendar"
3. Enter your OAuth credentials
4. Click "Connect via OAuth"
5. Complete the OAuth flow
6. Verify connection appears in your connections list

### Test Outlook Connection

1. Open Calendar Connection Dialog
2. Select "Microsoft Outlook"
3. Enter your OAuth credentials
4. Click "Connect via OAuth"
5. Sign in with Microsoft account
6. Grant permissions
7. Verify connection

### Test Apple Calendar Connection

1. Open Calendar Connection Dialog
2. Select "Apple Calendar"
3. Click "Manual Setup"
4. Enter:
   - CalDAV URL: `https://caldav.icloud.com`
   - Username: Your Apple ID
   - App-Specific Password: Generated password
5. Test connection

## Common Issues

### "Redirect URI mismatch"

- Ensure the redirect URI in your OAuth app matches exactly what you're using
- Check for trailing slashes, http vs https, etc.

### "Invalid client secret"

- For Google: Regenerate the secret if needed
- For Microsoft: Make sure you copied the secret value (not the secret ID)

### "Insufficient permissions"

- Verify all required scopes are added
- For Microsoft: Grant admin consent if needed
- For Google: Check OAuth consent screen configuration

### "Token expired"

- The system should auto-refresh, but you may need to reconnect
- Check that refresh tokens are being stored correctly

## Security Best Practices

1. **Never commit secrets**: Store OAuth credentials in environment variables
2. **Use HTTPS**: Always use HTTPS in production for redirect URIs
3. **Rotate secrets**: Regularly rotate client secrets
4. **Limit scopes**: Only request the minimum required permissions
5. **Monitor usage**: Set up alerts for unusual API usage

## Next Steps

After setting up OAuth:
1. Test the connection
2. List available calendars
3. Try booking a test appointment
4. Verify the appointment appears in your calendar
5. Test conflict detection

See [CALENDAR_INTEGRATION.md](./CALENDAR_INTEGRATION.md) for usage examples.

