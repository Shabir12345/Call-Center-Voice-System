/**
 * Basic Usage Example
 * 
 * Example of how to use the Master-Sub-Agent architecture system
 */

import { SystemOrchestrator, SystemConfig } from '../utils/systemOrchestrator';
import { ReservationAgentModule } from '../utils/subAgents/reservationAgent';
import { BillingAgentModule } from '../utils/subAgents/billingAgent';
import { SupportAgentModule } from '../utils/subAgents/supportAgent';
import { CentralLogger } from '../utils/logger';

/**
 * Example: Basic system setup and usage
 */
export async function basicUsageExample() {
  // 1. Create system configuration
  const config: SystemConfig = {
    masterAgent: {
      agentId: 'master_001',
      systemPrompt: 'You are a helpful customer service assistant.',
      voiceSettings: {
        speed: 1.0,
        tone: 'professional',
        language: 'en'
      },
      intents: [
        'confirm_reservation',
        'get_billing_info',
        'create_support_ticket'
      ],
      guardrails: {
        bannedPhrases: [],
        fallbackResponse: "I'm sorry, I didn't understand. Could you rephrase?"
      }
    },
    subAgents: [
      {
        agentId: 'reservation_agent',
        specialty: 'reservations',
        systemPrompt: 'You handle reservation-related tasks.',
        model: 'pro',
        tasks: ['confirm_reservation', 'modify_reservation', 'cancel_reservation']
      },
      {
        agentId: 'billing_agent',
        specialty: 'billing',
        systemPrompt: 'You handle billing inquiries.',
        model: 'flash',
        tasks: ['get_billing_info']
      },
      {
        agentId: 'support_agent',
        specialty: 'support',
        systemPrompt: 'You handle support tickets.',
        model: 'pro',
        tasks: ['create_support_ticket']
      }
    ],
    logging: {
      level: 'info',
      maxLogs: 10000
    }
  };

  // 2. Create orchestrator
  const orchestrator = new SystemOrchestrator(config);

  // 3. Initialize system
  await orchestrator.initialize();

  // 4. Register sub-agents
  const logger = orchestrator.getLogger();
  
  await orchestrator.registerSubAgent(
    {
      agentId: 'reservation_agent',
      specialty: 'reservations',
      systemPrompt: 'You handle reservation-related tasks.',
      model: 'pro'
    },
    ReservationAgentModule
  );

  await orchestrator.registerSubAgent(
    {
      agentId: 'billing_agent',
      specialty: 'billing',
      systemPrompt: 'You handle billing inquiries.',
      model: 'flash'
    },
    BillingAgentModule
  );

  await orchestrator.registerSubAgent(
    {
      agentId: 'support_agent',
      specialty: 'support',
      systemPrompt: 'You handle support tickets.',
      model: 'pro'
    },
    SupportAgentModule
  );

  // 5. Process caller input
  const sessionId = `session_${Date.now()}`;
  const userId = 'user_123';

  // Example 1: Reservation confirmation
  const response1 = await orchestrator.processCallerInput(
    'Confirm my reservation',
    sessionId,
    userId
  );
  console.log('Response 1:', response1);

  // Example 2: Billing inquiry
  const response2 = await orchestrator.processCallerInput(
    "What's my bill this month?",
    sessionId,
    userId
  );
  console.log('Response 2:', response2);

  // 6. Get system statistics
  const stats = orchestrator.getStatistics();
  console.log('System Statistics:', stats);

  // 7. Cleanup
  await orchestrator.shutdown();
}

/**
 * Example: Using app variant template
 */
export async function templateUsageExample() {
  const orchestrator = new SystemOrchestrator({
    masterAgent: {
      agentId: 'hotel_master',
      systemPrompt: 'You are a hotel concierge.',
      intents: ['book_room', 'confirm_reservation'],
      voiceSettings: {
        tone: 'welcoming'
      }
    },
    appVariant: 'hospitality_hotel_v1'
  });

  await orchestrator.initialize();

  const response = await orchestrator.processCallerInput(
    'I want to book a room',
    `session_${Date.now()}`
  );

  console.log('Template Response:', response);
}

