/**
 * Main server file for incoming call handler
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { loadAppConfig } from './config/appConfig.js';
import { loadPhoneProviderConfig } from './config/phoneProviders.js';
import callsRouter from './routes/calls.js';
import healthRouter from './routes/health.js';

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/webhooks', callsRouter);
app.use('/', healthRouter);

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// 404 handler
app.use((req: express.Request, res: express.Response) => {
  res.status(404).json({ error: 'Not found' });
});

// Initialize and start server
async function startServer() {
  try {
    // Load configuration
    const appConfig = loadAppConfig();
    const phoneConfig = loadPhoneProviderConfig();

    console.log('Starting incoming call handler server...');
    console.log(`Phone Provider: ${phoneConfig.provider}`);
    console.log(`Port: ${appConfig.port}`);
    console.log(`Environment: ${appConfig.nodeEnv}`);

    // Validate configuration
    if (phoneConfig.provider === 'twilio' || phoneConfig.provider === 'both') {
      if (!phoneConfig.twilio) {
        throw new Error('Twilio configuration missing');
      }
      console.log(`Twilio Phone Number: ${phoneConfig.twilio.phoneNumber}`);
      console.log(`Twilio Webhook URL: ${phoneConfig.webhookBaseUrl}/webhooks/twilio/incoming`);
    }

    if (phoneConfig.provider === 'telnyx' || phoneConfig.provider === 'both') {
      if (!phoneConfig.telnyx) {
        throw new Error('Telnyx configuration missing');
      }
      console.log(`Telnyx Phone Number: ${phoneConfig.telnyx.phoneNumber}`);
      console.log(`Telnyx Webhook URL: ${phoneConfig.webhookBaseUrl}/webhooks/telnyx/incoming`);
    }

    // Start server
    const server = app.listen(appConfig.port, () => {
      console.log(`\n✅ Server running on port ${appConfig.port}`);
      console.log(`📞 Webhook endpoints ready:`);
      if (phoneConfig.provider === 'twilio' || phoneConfig.provider === 'both') {
        console.log(`   - POST ${phoneConfig.webhookBaseUrl}/webhooks/twilio/incoming`);
        console.log(`   - POST ${phoneConfig.webhookBaseUrl}/webhooks/twilio/status`);
        console.log(`   - POST ${phoneConfig.webhookBaseUrl}/webhooks/twilio/transcription`);
      }
      if (phoneConfig.provider === 'telnyx' || phoneConfig.provider === 'both') {
        console.log(`   - POST ${phoneConfig.webhookBaseUrl}/webhooks/telnyx/incoming`);
        console.log(`   - POST ${phoneConfig.webhookBaseUrl}/webhooks/telnyx/status`);
        console.log(`   - POST ${phoneConfig.webhookBaseUrl}/webhooks/telnyx/transcription`);
      }
      console.log(`   - GET  ${phoneConfig.webhookBaseUrl}/health\n`);
    });

    // Graceful shutdown
    const shutdown = async () => {
      console.log('\nShutting down server...');
      server.close(() => {
        console.log('Server closed');
        process.exit(0);
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

  } catch (error: any) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
}

// Start server
startServer();

