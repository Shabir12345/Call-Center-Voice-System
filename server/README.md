# Incoming Call Handler Server

Backend server for handling incoming phone calls from Twilio and Telnyx, connecting them to the AI agent system.

## Quick Start

1. **Install dependencies:**
   ```bash
   cd server
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

3. **Start server:**
   ```bash
   npm run dev  # Development
   # or
   npm run build && npm start  # Production
   ```

## Configuration

See [docs/INCOMING_CALLS_SETUP.md](../docs/INCOMING_CALLS_SETUP.md) for detailed setup instructions.

## Project Structure

```
server/
├── src/
│   ├── config/          # Configuration loaders
│   ├── routes/          # Express route handlers
│   ├── services/        # Core business logic
│   ├── types/           # TypeScript type definitions
│   ├── tests/           # Test files
│   └── index.ts         # Main server entry point
├── package.json
├── tsconfig.json
└── .env.example
```

## Key Features

- Support for Twilio and Telnyx phone providers
- Automatic transcription of voice calls
- Integration with AI agent system
- Text-to-speech responses
- Call session management
- Webhook signature validation

## API Endpoints

- `POST /webhooks/twilio/incoming` - Twilio incoming call webhook
- `POST /webhooks/twilio/status` - Twilio call status updates
- `POST /webhooks/twilio/transcription` - Twilio transcription results
- `POST /webhooks/telnyx/incoming` - Telnyx incoming call webhook
- `POST /webhooks/telnyx/status` - Telnyx call status updates
- `POST /webhooks/telnyx/transcription` - Telnyx transcription results
- `GET /health` - Health check endpoint

## Development

```bash
# Run in development mode with hot reload
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

## Documentation

- [Incoming Calls Setup](../docs/INCOMING_CALLS_SETUP.md)
- [Phone Provider Configuration](../docs/PHONE_PROVIDER_CONFIG.md)
- [Troubleshooting](../docs/TROUBLESHOOTING.md)
