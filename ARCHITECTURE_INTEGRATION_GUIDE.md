# Architecture Integration Guide

## Quick Start

### 1. Import the System Orchestrator

```typescript
import { SystemOrchestrator, SystemConfig } from './utils/systemOrchestrator';
import { ReservationAgentModule } from './utils/subAgents/reservationAgent';
```

### 2. Initialize the System

```typescript
const orchestrator = new SystemOrchestrator({
  masterAgent: {
    agentId: 'master_001',
    systemPrompt: 'You are a helpful assistant.',
    intents: ['confirm_reservation', 'get_billing_info'],
    voiceSettings: { speed: 1.0, tone: 'professional' }
  },
  subAgents: [
    {
      agentId: 'reservation_agent',
      specialty: 'reservations',
      systemPrompt: 'Handle reservations.',
      model: 'pro'
    }
  ]
});

await orchestrator.initialize();
```

### 3. Register Sub-Agents

```typescript
await orchestrator.registerSubAgent(
  {
    agentId: 'reservation_agent',
    specialty: 'reservations',
    systemPrompt: 'Handle reservations.',
    model: 'pro'
  },
  ReservationAgentModule
);
```

### 4. Process Caller Input

```typescript
const response = await orchestrator.processCallerInput(
  'Confirm my reservation',
  'session_123',
  'user_456'
);
```

## Integration with Existing TestPanel

### Option 1: Replace Current Implementation

Replace the existing agent communication in `TestPanel.tsx` with the new orchestrator:

```typescript
import { SystemOrchestrator } from '../utils/systemOrchestrator';

// In TestPanel component
const orchestrator = useRef<SystemOrchestrator | null>(null);

useEffect(() => {
  orchestrator.current = new SystemOrchestrator({
    masterAgent: {
      agentId: routerNode.id,
      systemPrompt: routerNode.data.systemPrompt,
      intents: routerNode.data.intents,
      voiceSettings: routerNode.data.voiceSettings
    }
  });
  
  orchestrator.current.initialize();
}, [routerNode]);
```

### Option 2: Gradual Migration

Keep existing code and gradually migrate:

```typescript
// Use new system for new features
const newSystem = new SystemOrchestrator(config);
const response = await newSystem.processCallerInput(input, sessionId);

// Keep old system for existing features
// ... existing code ...
```

## Component Usage

### State Manager

```typescript
import { StateManager } from './utils/stateManager';

const stateManager = new StateManager('session');
const session = await stateManager.getOrCreateSession('session_123');
await stateManager.addToHistory('session_123', {
  role: 'caller',
  content: 'Hello',
  timestamp: Date.now()
});
```

### Logger

```typescript
import { logger } from './utils/logger';

logger.log({
  type: 'agent_to_agent',
  from: 'master',
  to: 'reservation',
  message: 'Request data',
  sessionId: 'session_123'
});

const logs = await logger.queryLogs({ sessionId: 'session_123' });
```

### Communication Manager

```typescript
import { CommunicationManager } from './utils/agentCommunication';

const commManager = new CommunicationManager();
commManager.registerAgent('reservation', async (message) => {
  // Handle message
  return { status: 'success', data: {} };
});

const response = await commManager.sendAndWait(message, 30000);
```

## Next Steps

1. **Integration**: Connect orchestrator to TestPanel.tsx
2. **Testing**: Write unit tests for components
3. **Documentation**: Complete API documentation
4. **Deployment**: Set up production environment

