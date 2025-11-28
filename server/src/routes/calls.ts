/**
 * Call webhook routes for Twilio and Telnyx
 */

import { Router, Request, Response } from 'express';
import { CallHandler } from '../services/callHandler.js';
import { VoiceProcessor } from '../services/voiceProcessor.js';
import { AgentBridge, getAgentBridge } from '../services/agentBridge.js';

const router = Router();

// Initialize services (singletons)
const callHandler = new CallHandler();
const agentBridge = getAgentBridge();
const voiceProcessor = new VoiceProcessor(agentBridge, callHandler);

// Initialize agent bridge on startup
agentBridge.initialize().catch((error) => {
  console.error('Failed to initialize agent bridge:', error);
});

/**
 * Twilio incoming call webhook
 */
/**
 * Twilio incoming call webhook
 */
router.post('/twilio/incoming', async (req: Request, res: Response) => {
  try {
    const provider = callHandler.getProvider('twilio');
    if (!provider) {
      return res.status(503).json({ error: 'Twilio provider not configured' });
    }

    // Validate webhook (optional but recommended)
    const signature = req.headers['x-twilio-signature'] as string;
    if (!provider.validateWebhook(req.body, req.headers as Record<string, string>, signature || '')) {
      console.warn('Invalid Twilio webhook signature');
      // In production, you might want to reject invalid signatures
      // return res.status(403).json({ error: 'Invalid signature' });
    }

    // Handle incoming call
    const { event, session } = await callHandler.handleIncomingCall('twilio', req.body, req.headers as Record<string, string>);

    // Generate call response
    const callResponse = {
      status: 'answered' as const,
      message: 'Hello, how can I help you today?',
    };

    const twiml = provider.generateCallResponse(callResponse);

    // Start transcription
    try {
      await voiceProcessor.startTranscription(event.callSid, provider);
    } catch (error) {
      console.error('Failed to start transcription:', error);
    }

    res.type('text/xml');
    res.send(twiml);
  } catch (error: any) {
    console.error('Error handling Twilio incoming call:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

/**
 * Twilio call status webhook
 */
router.post('/twilio/status', async (req: Request, res: Response) => {
  try {
    await callHandler.handleCallStatusUpdate('twilio', req.body, req.headers as Record<string, string>);
    res.status(200).json({ status: 'ok' });
  } catch (error: any) {
    console.error('Error handling Twilio call status:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

/**
 * Twilio transcription webhook
 */
router.post('/twilio/transcription', async (req: Request, res: Response) => {
  try {
    const provider = callHandler.getProvider('twilio');
    if (!provider) {
      return res.status(503).json({ error: 'Twilio provider not configured' });
    }

    // Handle transcription
    const transcription = await callHandler.handleTranscription('twilio', req.body, req.headers as Record<string, string>);
    
    if (transcription && transcription.isFinal) {
      const callSid = req.body.CallSid || req.body.call_sid;
      if (callSid && provider) {
        // Process transcription and send response
        await voiceProcessor.processCompleteFlow(transcription, callSid, provider);
      }
    }

    res.status(200).json({ status: 'ok' });
  } catch (error: any) {
    console.error('Error handling Twilio transcription:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

/**
 * Telnyx incoming call webhook
 */
router.post('/telnyx/incoming', async (req: Request, res: Response) => {
  try {
    const provider = callHandler.getProvider('telnyx');
    if (!provider) {
      return res.status(503).json({ error: 'Telnyx provider not configured' });
    }

    // Validate webhook (optional but recommended)
    const signature = req.headers['telnyx-signature-ed25519'] as string;
    if (!provider.validateWebhook(req.body, req.headers as Record<string, string>, signature || '')) {
      console.warn('Invalid Telnyx webhook signature');
      // In production, you might want to reject invalid signatures
      // return res.status(403).json({ error: 'Invalid signature' });
    }

    // Handle incoming call
    const { event, session } = await callHandler.handleIncomingCall('telnyx', req.body, req.headers as Record<string, string>);

    // Generate call response
    const callResponse = {
      status: 'answered' as const,
      message: 'Hello, how can I help you today?',
    };

    const telnyxResponse = provider.generateCallResponse(callResponse);

    // Start transcription
    try {
      await voiceProcessor.startTranscription(event.callSid, provider);
    } catch (error) {
      console.error('Failed to start transcription:', error);
    }

    res.json(telnyxResponse);
  } catch (error: any) {
    console.error('Error handling Telnyx incoming call:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

/**
 * Telnyx call status webhook
 */
router.post('/telnyx/status', async (req: Request, res: Response) => {
  try {
    await callHandler.handleCallStatusUpdate('telnyx', req.body, req.headers as Record<string, string>);
    res.status(200).json({ status: 'ok' });
  } catch (error: any) {
    console.error('Error handling Telnyx call status:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

/**
 * Telnyx transcription webhook
 */
router.post('/telnyx/transcription', async (req: Request, res: Response) => {
  try {
    const provider = callHandler.getProvider('telnyx');
    if (!provider) {
      return res.status(503).json({ error: 'Telnyx provider not configured' });
    }

    // Handle transcription
    const transcription = await callHandler.handleTranscription('telnyx', req.body, req.headers as Record<string, string>);
    
    if (transcription && transcription.isFinal) {
      const callSid = req.body.data?.call_control_id || req.body.call_control_id;
      if (callSid && provider) {
        // Process transcription and send response
        await voiceProcessor.processCompleteFlow(transcription, callSid, provider);
      }
    }

    res.status(200).json({ status: 'ok' });
  } catch (error: any) {
    console.error('Error handling Telnyx transcription:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

export default router;

