# Getting Started Guide

## Quick Start

### 1. Installation

The Master-Sub-Agent architecture is already integrated into your project. All utilities are available from `utils/index.ts`.

### 2. Basic Usage

```typescript
import { SystemOrchestrator } from './utils/systemOrchestrator';
import { ReservationAgentModule } from './utils/subAgents/reservationAgent';

// Create orchestrator
const orchestrator = new SystemOrchestrator({
  masterAgent: {
    agentId: 'master_001',
    systemPrompt: 'You are a helpful assistant.',
    intents: ['confirm_reservation'],
    voiceSettings: {
      speed: 1.0,
      tone: 'professional',
      language: 'en'
    }
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

// Initialize
await orchestrator.initialize();

// Register sub-agents
await orchestrator.registerSubAgent(
  {
    agentId: 'reservation_agent',
    specialty: 'reservations',
    systemPrompt: 'Handle reservations.',
    model: 'pro'
  },
  ReservationAgentModule
);

// Process caller input
const response = await orchestrator.processCallerInput(
  'Confirm my reservation',
  'session_123',
  'user_456'
);

console.log(response);
```

### 3. Using Templates

```typescript
import { AppVariantManager } from './utils/appVariant';

const manager = new AppVariantManager();

// Load a template
const config = manager.loadVariant('hospitality_hotel_v1');

// Use with orchestrator
const orchestrator = new SystemOrchestrator({
  masterAgent: config.masterAgentConfig,
  subAgents: config.subAgentConfigs,
  appVariant: 'hospitality_hotel_v1'
});
```

### 4. Integration with TestPanel

```typescript
import { TestPanelAdapter } from './utils/testPanelAdapter';

const adapter = new TestPanelAdapter();
await adapter.initializeFromNodes(nodes); // Your existing nodes

const response = await adapter.processCallerInput(
  'Confirm my reservation',
  'session_123'
);
```

## Next Steps

1. **Customize Agents**: Create your own sub-agents by extending `SubAgentModule`
2. **Configure Templates**: Modify or create new app variant templates
3. **Add Monitoring**: Set up performance monitoring and health checks
4. **Test**: Write unit and integration tests using the test helpers

## Common Patterns

### Creating a Custom Sub-Agent

```typescript
import { SubAgentModule, TaskResult } from './utils/subAgentModule';

class CustomAgent extends SubAgentModule {
  protected async processTask(
    task: string,
    parameters: Record<string, any>,
    context: ConversationContext
  ): Promise<TaskResult> {
    // Your logic here
    return {
      status: 'success',
      data: { result: 'value' }
    };
  }
}
```

### Error Handling

```typescript
import { ErrorCode, createErrorResponse } from './utils/errorHandling';

try {
  // Your code
} catch (error) {
  return createErrorResponse(
    ErrorCode.EXTERNAL_API_FAILURE,
    error.message,
    { details: error }
  );
}
```

### Caching

```typescript
import { CacheManagerFactory } from './utils/cacheManager';

const cache = CacheManagerFactory.getCache('my_cache');

const value = await cache.getOrSet('key', async () => {
  // Expensive operation
  return await fetchData();
});
```

