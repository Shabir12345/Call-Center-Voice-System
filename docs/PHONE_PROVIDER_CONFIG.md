# Phone Provider Configuration Guide

Detailed configuration guide for Twilio and Telnyx phone providers.

## Twilio Configuration

### Getting Credentials

1. Sign up for a [Twilio account](https://www.twilio.com/try-twilio)
2. Get your credentials from the [Console Dashboard](https://console.twilio.com/):
   - **Account SID**: Found on the dashboard home
   - **Auth Token**: Found on the dashboard home (click to reveal)
   - **Phone Number**: Purchase or use trial number

### Environment Variables

```env
PHONE_PROVIDER=twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+1234567890
```

### Webhook Configuration

1. Navigate to Phone Numbers → Manage → Active Numbers
2. Click on your phone number
3. Scroll to "Voice & Fax" section
4. Configure:
   - **A Call Comes In**: `POST https://your-domain.com/webhooks/twilio/incoming`
   - **Status Callback URL**: `POST https://your-domain.com/webhooks/twilio/status`
5. Save configuration

### Transcription Setup

Twilio uses Real-Time Transcription for speech-to-text:

1. In the incoming webhook, transcription is started automatically
2. Transcription results are sent to `/webhooks/twilio/transcription`
3. Configure transcription callback URL in webhook settings

### Text-to-Speech

Twilio uses TwiML `<Say>` verb for text-to-speech:

- Voice options: `alice`, `man`, `woman`
- Language codes: `en-US`, `en-GB`, etc.
- Configured in `twilioProvider.ts`

## Telnyx Configuration

### Getting Credentials

1. Sign up for a [Telnyx account](https://telnyx.com/)
2. Get your credentials from the [Portal](https://portal.telnyx.com/):
   - **API Key**: Navigate to Settings → API Keys
   - **Phone Number**: Purchase or port a number

### Environment Variables

```env
PHONE_PROVIDER=telnyx
TELNYX_API_KEY=KEYxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TELNYX_PHONE_NUMBER=+1234567890
```

### Call Control Application Setup

1. Navigate to Voice → Call Control → Applications
2. Create a new application or edit existing
3. Configure webhooks:
   - **Webhook Event URL**: `https://your-domain.com/webhooks/telnyx/incoming`
   - **Webhook Event Failover URL**: (optional)
   - **Status Callback URL**: `https://your-domain.com/webhooks/telnyx/status`
4. Assign application to your phone number

### Transcription Setup

Telnyx uses Call Control API for transcription:

1. Transcription is started via API call in the handler
2. Transcription results are sent to webhook configured in Call Control
3. Configure transcription webhook in Call Control Application settings

### Text-to-Speech

Telnyx uses Call Control API `speak` command:

- Voice options: `female`, `male`
- Language codes: `en-US`, etc.
- Configured in `telnyxProvider.ts`

## Using Both Providers

You can configure both providers simultaneously:

```env
PHONE_PROVIDER=both
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=+1234567890
TELNYX_API_KEY=KEYxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TELNYX_PHONE_NUMBER=+0987654321
```

### Provider Selection

When both are configured:
- Different phone numbers use different providers
- Webhook routes handle both provider types
- Each call is processed through the appropriate provider

## Webhook Security

### Twilio Signature Validation

Twilio uses HMAC-SHA1 for webhook signatures:

1. Set `WEBHOOK_SECRET` in `.env`
2. Configure same secret in Twilio webhook settings
3. Server validates signatures automatically

### Telnyx Signature Validation

Telnyx uses Ed25519 signatures:

1. Set `WEBHOOK_SECRET` in `.env`
2. Configure webhook signing in Telnyx portal
3. Server validates signatures automatically

## Testing Configuration

### Test Webhook Receipt

```bash
# Test Twilio webhook
curl -X POST http://localhost:3001/webhooks/twilio/incoming \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "CallSid=test123&From=%2B1234567890&To=%2B0987654321&CallStatus=ringing"

# Test Telnyx webhook
curl -X POST http://localhost:3001/webhooks/telnyx/incoming \
  -H "Content-Type: application/json" \
  -d '{"data":{"call_control_id":"test123","from":"+1234567890","to":"+0987654321","event_type":"call.initiated"}}'
```

### Verify Health

```bash
curl http://localhost:3001/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-01-27T12:00:00.000Z",
  "uptime": 123.456
}
```

## Common Configuration Issues

### Invalid Credentials

**Symptom**: Provider initialization fails

**Solution**:
- Verify credentials are correct
- Check for extra spaces or special characters
- Ensure credentials match the correct provider

### Webhook Not Receiving Calls

**Symptom**: Calls not triggering webhooks

**Solution**:
- Verify webhook URL is publicly accessible
- Check webhook URL format (must be HTTPS in production)
- Verify webhook is configured in provider dashboard
- Check server logs for incoming requests

### Transcription Not Working

**Symptom**: No transcription results

**Solution**:
- Verify transcription is enabled in provider settings
- Check transcription webhook URL is configured
- Verify audio stream is active during call
- Check provider logs for transcription errors

## Advanced Configuration

### Custom Voice Settings

Modify voice settings in provider implementation files:
- `server/src/services/twilioProvider.ts`
- `server/src/services/telnyxProvider.ts`

### Custom Call Response

Modify call response generation in:
- `server/src/routes/calls.ts`

### Custom AI Agent Configuration

Modify agent configuration in:
- `server/src/services/agentBridge.ts`

## Support

For provider-specific issues:
- **Twilio**: [Twilio Support](https://support.twilio.com/)
- **Telnyx**: [Telnyx Support](https://support.telnyx.com/)

For implementation issues, check the troubleshooting guide or server logs.

