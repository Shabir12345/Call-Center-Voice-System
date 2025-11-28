# Incoming Calls Setup Guide

This guide explains how to set up incoming call handling for your AI call center system using Twilio or Telnyx.

## Overview

The incoming call handler receives calls forwarded to your AI agent phone number, processes them through the AI system, and responds with synthesized speech. The system supports both Twilio and Telnyx phone providers.

## Architecture

```
Incoming Call → Twilio/Telnyx → Webhook → Backend Server → AI Agent System
                                      ↓
                           Voice Stream/Transcription
                                      ↓
                           MasterAgent.processCallerInput()
                                      ↓
                           Text Response → TTS → Caller
```

## Prerequisites

1. **Phone Number**: You need a phone number from Twilio or Telnyx that will receive forwarded calls
2. **Backend Server**: The server must be publicly accessible (use ngrok for local testing)
3. **Environment Variables**: Configure provider credentials and API keys

## Quick Start

### 1. Install Dependencies

```bash
cd server
npm install
```

### 2. Configure Environment Variables

Copy the example environment file and fill in your credentials:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Phone Providers
PHONE_PROVIDER=twilio  # Options: twilio, telnyx, both

# Twilio Configuration
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# Telnyx Configuration
TELNYX_API_KEY=your_telnyx_api_key
TELNYX_PHONE_NUMBER=+1234567890

# AI Agent Configuration
GEMINI_API_KEY=your_gemini_api_key
AI_AGENT_PHONE_NUMBER=+1234567890

# Server Configuration
PORT=3001
NODE_ENV=development
WEBHOOK_BASE_URL=http://your-public-url.com
```

### 3. Start the Server

```bash
npm run dev  # Development mode with hot reload
# or
npm run build && npm start  # Production mode
```

### 4. Configure Webhooks in Provider Dashboard

#### Twilio Setup

1. Log into your [Twilio Console](https://console.twilio.com/)
2. Navigate to Phone Numbers → Manage → Active Numbers
3. Click on your phone number
4. Under "Voice & Fax", set the webhook URL:
   - **A Call Comes In**: `https://your-public-url.com/webhooks/twilio/incoming`
   - **Status Callback URL**: `https://your-public-url.com/webhooks/twilio/status`
5. Set HTTP method to `POST`
6. Save configuration

#### Telnyx Setup

1. Log into your [Telnyx Portal](https://portal.telnyx.com/)
2. Navigate to Voice → Call Control → Applications
3. Create a new Call Control Application or edit existing
4. Set the webhook URL:
   - **Webhook URL**: `https://your-public-url.com/webhooks/telnyx/incoming`
   - **Status Callback URL**: `https://your-public-url.com/webhooks/telnyx/status`
5. Save configuration

### 5. Set Up Call Forwarding

#### Option 1: Forward to AI Agent Number

If you have a number that receives forwarded calls:

1. In your Twilio/Telnyx dashboard, configure call forwarding
2. Forward all calls to your `AI_AGENT_PHONE_NUMBER`
3. The webhook will fire when calls arrive at that number

#### Option 2: Direct Webhook Configuration

1. Set your phone number's webhook to point to the backend server
2. The server will handle incoming calls directly

## Testing

### Local Testing with ngrok

For local development, use ngrok to expose your server:

```bash
# Install ngrok
npm install -g ngrok

# Start your server
cd server
npm run dev

# In another terminal, start ngrok
ngrok http 3001

# Use the ngrok URL (e.g., https://abc123.ngrok.io) as WEBHOOK_BASE_URL
# Update webhook URLs in Twilio/Telnyx dashboard with ngrok URL
```

### Test Call Flow

1. Make a test call to your configured phone number
2. The call should be answered by the AI agent
3. Speak your request
4. The AI agent should respond with synthesized speech
5. Check server logs for call processing details

## Webhook Endpoints

### Twilio Endpoints

- `POST /webhooks/twilio/incoming` - Handle incoming calls
- `POST /webhooks/twilio/status` - Call status updates
- `POST /webhooks/twilio/transcription` - Transcription results

### Telnyx Endpoints

- `POST /webhooks/telnyx/incoming` - Handle incoming calls
- `POST /webhooks/telnyx/status` - Call status updates
- `POST /webhooks/telnyx/transcription` - Transcription results

### Health Check

- `GET /health` - Server health status

## Call Flow

1. **Incoming Call**: Call arrives at your phone number
2. **Webhook Trigger**: Provider sends webhook to `/webhooks/{provider}/incoming`
3. **Call Session Created**: Server creates a call session
4. **Transcription Started**: Server initiates transcription
5. **AI Processing**: Transcribed text is processed through the AI agent
6. **TTS Response**: AI response is converted to speech and sent to caller
7. **Call Ends**: Status webhook fires, session is cleaned up

## Configuration Options

### Phone Provider Selection

Set `PHONE_PROVIDER` environment variable:
- `twilio` - Use Twilio only
- `telnyx` - Use Telnyx only
- `both` - Support both providers (use different phone numbers)

### Voice Processing

Voice processing options can be configured in `server/src/config/appConfig.ts`:

- `enableTranscription`: Enable/disable transcription
- `enableTTS`: Enable/disable text-to-speech
- `language`: Language code (default: 'en-US')
- `sampleRate`: Audio sample rate (default: 16000)

## Security

### Webhook Validation

The server validates webhook signatures when configured:

1. Set `WEBHOOK_SECRET` in your `.env` file
2. Configure the same secret in your provider dashboard
3. Invalid signatures will be logged (and optionally rejected in production)

### Production Checklist

- [ ] Use HTTPS for webhook URLs
- [ ] Enable webhook signature validation
- [ ] Set secure `WEBHOOK_SECRET`
- [ ] Configure proper error handling
- [ ] Set up monitoring and logging
- [ ] Use environment-specific configurations

## Troubleshooting

### Calls Not Being Received

1. **Check Server Status**: Verify server is running and accessible
   ```bash
   curl https://your-url.com/health
   ```

2. **Verify Webhook URLs**: Check that webhook URLs in provider dashboard match your server

3. **Check Logs**: Review server logs for errors

4. **Test Webhook**: Use a tool like Postman to test webhook endpoints

### Transcription Not Working

1. **Check Provider Settings**: Verify transcription is enabled in provider dashboard
2. **Check Logs**: Look for transcription-related errors in server logs
3. **Verify Audio Stream**: Ensure call audio is being captured

### AI Responses Not Playing

1. **Check Agent Bridge**: Verify AI agent is initialized
2. **Check TTS Configuration**: Verify text-to-speech settings
3. **Check Provider Logs**: Review provider logs for TTS delivery

## Next Steps

- See [PHONE_PROVIDER_CONFIG.md](./PHONE_PROVIDER_CONFIG.md) for detailed provider configuration
- See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for common issues and solutions

