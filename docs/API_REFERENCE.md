# API Reference

## Master-Sub-Agent Architecture API Documentation

### Core Classes

#### SystemOrchestrator

Main entry point for the Master-Sub-Agent architecture system.

```typescript
import { SystemOrchestrator, SystemConfig } from './utils/systemOrchestrator';

const orchestrator = new SystemOrchestrator({
  masterAgent: {
    agentId: 'master_001',
    systemPrompt: 'You are a helpful assistant.',
    intents: ['confirm_reservation', 'get_billing_info'],
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

await orchestrator.initialize();
const response = await orchestrator.processCallerInput(
  'Confirm my reservation',
  'session_123',
  'user_456'
);
```

**Methods:**
- `initialize()`: Initialize the system
- `processCallerInput(input, sessionId, userId?)`: Process caller input
- `registerSubAgent(config, moduleClass?)`: Register a sub-agent
- `getStatistics()`: Get system statistics
- `shutdown()`: Shutdown the system

#### CommunicationManager

Manages inter-agent communication.

```typescript
import { CommunicationManager } from './utils/agentCommunication';

const commManager = new CommunicationManager({
  enabled: true,
  maxConversationDepth: 5,
  timeout: 30000
});

commManager.registerAgent('agent_id', async (message) => {
  // Handle message
  return { status: 'success' };
});

const response = await commManager.sendAndWait(message, 30000);
```

#### StateManager

Manages session state and conversation history.

```typescript
import { StateManager } from './utils/stateManager';

const stateManager = new StateManager('session');

const session = await stateManager.getOrCreateSession('session_123');
await stateManager.addMessageToHistory('session_123', 'user', 'Hello');
const history = await stateManager.getSessionHistory('session_123');
```

#### CentralLogger

Centralized logging system.

```typescript
import { CentralLogger } from './utils/logger';

const logger = new CentralLogger('in-memory', {
  logLevel: 'info',
  maxInMemoryLogs: 10000
});

await logger.info('Message', { metadata: 'value' }, 'session_123');
const logs = await logger.queryLogs({ sessionId: 'session_123' });
```

### Sub-Agent Modules

#### SubAgentModule (Base Class)

Base class for all sub-agents.

```typescript
import { SubAgentModule, SubAgentConfig, TaskResult } from './utils/subAgentModule';

class MyAgent extends SubAgentModule {
  protected async processTask(
    task: string,
    parameters: Record<string, any>,
    context: ConversationContext
  ): Promise<TaskResult> {
    // Implement task processing
    return {
      status: 'success',
      data: { result: 'value' }
    };
  }
}
```

### Error Handling

#### Error Codes

```typescript
import { ErrorCode, createErrorResponse, isRetryableError } from './utils/errorHandling';

const error = createErrorResponse(
  ErrorCode.EXTERNAL_API_FAILURE,
  'API call failed',
  { details: 'more info' }
);

if (isRetryableError(ErrorCode.EXTERNAL_API_FAILURE)) {
  // Retry logic
}
```

### Configuration

#### App Variant Templates

```typescript
import { AppVariantManager } from './utils/appVariant';

const manager = new AppVariantManager();
const config = manager.loadVariant('hospitality_hotel_v1');
```

### Monitoring

#### Performance Monitor

```typescript
import { PerformanceMonitor } from './utils/performanceMonitor';

const monitor = new PerformanceMonitor(logger);
const requestId = monitor.startRequest('agent_id');
// ... process request
monitor.endRequest(requestId, true);
const metrics = monitor.getMetrics();
```

#### Health Checker

```typescript
import { HealthChecker } from './utils/healthChecker';

const healthChecker = new HealthChecker(
  commManager,
  stateManager,
  logger,
  performanceMonitor
);

const report = await healthChecker.checkHealth();
healthChecker.startPeriodicChecks(60000);
```

### Caching

```typescript
import { CacheManagerFactory } from './utils/cacheManager';

const cache = CacheManagerFactory.getCache('my_cache', {
  maxSize: 1000,
  defaultTTL: 3600000,
  evictionPolicy: 'lru'
});

cache.set('key', 'value', 60000);
const value = cache.get('key');
const stats = cache.getStats();
```

