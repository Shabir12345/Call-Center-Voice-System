# Developer Guide

## Overview

This guide is for developers who want to extend or customize the Master-Sub-Agent architecture.

## Architecture Overview

### Component Hierarchy

```
SystemOrchestrator
├── MasterAgent
├── CommunicationManager
├── StateManager
├── CentralLogger
├── AgentRegistry
│   └── SubAgentModule (multiple)
├── PerformanceMonitor
├── HealthChecker
└── AlertManager
```

### Extension Points

#### 1. Creating Custom Sub-Agents

```typescript
import { SubAgentModule, TaskResult } from './utils/subAgentModule';

export class MyCustomAgent extends SubAgentModule {
  protected async processTask(
    task: string,
    parameters: Record<string, any>,
    context: ConversationContext
  ): Promise<TaskResult> {
    // Your implementation
    return {
      status: 'success',
      data: { result: 'value' }
    };
  }

  protected setupSchemas(): void {
    // Define your schemas
    this.taskSchemas.set('my_task', {
      type: 'object',
      properties: {
        task: { type: 'string' },
        parameters: { type: 'object' }
      }
    });
  }
}
```

#### 2. Custom Intent Recognizer

```typescript
import { IntentRecognizer } from './utils/intentRecognizer';

const recognizer = new IntentRecognizer(apiKey);

// Add custom patterns
recognizer.addIntentPattern('my_intent', [
  /pattern1/i,
  /pattern2/i
]);

const result = await recognizer.parse(input, context);
```

#### 3. Custom Response Formatter

```typescript
import { ResponseFormatter } from './utils/responseFormatter';

const formatter = new ResponseFormatter(apiKey);

const formatted = await formatter.formatResponse(response, {
  style: 'friendly',
  includeDetails: true
});
```

#### 4. Custom Integration Handlers

```typescript
import { RestApiIntegration } from './utils/integrations/restIntegration';

class MyIntegration extends RestApiIntegration {
  // Override methods as needed
}
```

## Testing Strategies

### Unit Testing

```typescript
import { describe, it, expect } from 'vitest';
import { createMockContext, createMockMessage } from './utils/testHelpers';

describe('My Component', () => {
  it('should work correctly', () => {
    const context = createMockContext();
    const message = createMockMessage('from', 'to', 'REQUEST', {});
    // Test your component
  });
});
```

### Integration Testing

```typescript
import { SystemOrchestrator } from './utils/systemOrchestrator';

const orchestrator = new SystemOrchestrator(config);
await orchestrator.initialize();

const response = await orchestrator.processCallerInput('input', 'session');
```

### E2E Testing

```typescript
import { E2ETestFramework } from './tests/e2e/framework';

const framework = new E2ETestFramework();
await framework.initialize();

const result = await framework.runScenario({
  name: 'My Scenario',
  steps: [
    { input: 'Hello', expectedResponse: /hi|hello/i }
  ]
});
```

## Deployment Procedures

### Development

1. Install dependencies: `npm install`
2. Run tests: `npm test`
3. Start dev server: `npm run dev`

### Staging

1. Validate config: `npm run validate-config`
2. Run all tests: `npm test`
3. Build: `npm run build`
4. Deploy: `./scripts/deploy.sh staging`

### Production

1. Validate config: `npm run validate-config`
2. Run all tests: `npm test`
3. Build: `npm run build`
4. Deploy: `./scripts/deploy.sh production`
5. Monitor: Check health and performance metrics

## Code Style

- Use TypeScript strict mode
- Follow existing code patterns
- Add JSDoc comments for public APIs
- Write tests for new features
- Update documentation

## Contributing

1. Create feature branch
2. Implement feature with tests
3. Update documentation
4. Submit pull request

