# Master-Sub-Agent Architecture

A comprehensive, production-ready master-sub-agent architecture system for conversational AI applications.

## Features

- ✅ **Complete Architecture**: Master agent, sub-agents, and tool agents
- ✅ **Robust Communication**: FIPA-ACL inspired protocols with bidirectional support
- ✅ **State Management**: Session management with automatic cleanup
- ✅ **Error Handling**: Comprehensive error handling with retry logic
- ✅ **Monitoring**: Performance monitoring, health checks, and alerting
- ✅ **Customization**: User profiles, app variants, and templates
- ✅ **Integration**: REST, GraphQL, and database integrations
- ✅ **Testing**: Unit, integration, and E2E test frameworks
- ✅ **Documentation**: Complete API reference and guides
- ✅ **Security**: Input sanitization and security auditing
- ✅ **Optimization**: Caching, performance profiling, and optimization tools

## Quick Start

```typescript
import { SystemOrchestrator } from './utils/systemOrchestrator';
import { ReservationAgentModule } from './utils/subAgents/reservationAgent';

// Create orchestrator
const orchestrator = new SystemOrchestrator({
  masterAgent: {
    agentId: 'master_001',
    systemPrompt: 'You are a helpful assistant.',
    intents: ['confirm_reservation'],
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

// Initialize
await orchestrator.initialize();

// Register agents
await orchestrator.registerSubAgent(
  { agentId: 'reservation_agent', specialty: 'reservations', systemPrompt: 'Handle reservations.', model: 'pro' },
  ReservationAgentModule
);

// Process input
const response = await orchestrator.processCallerInput(
  'Confirm my reservation',
  'session_123',
  'user_456'
);
```

## Architecture

```
┌─────────────────┐
│  SystemOrchestrator │
└────────┬──────────┘
         │
    ┌────┴────┐
    │         │
┌───▼───┐ ┌──▼──────────┐
│Master │ │Communication │
│Agent  │ │Manager       │
└───┬───┘ └──────────────┘
    │
    ├──► Sub-Agent 1
    ├──► Sub-Agent 2
    └──► Sub-Agent N
```

## Components

### Core
- **SystemOrchestrator**: Main entry point
- **MasterAgent**: Central coordinator
- **CommunicationManager**: Inter-agent communication
- **StateManager**: Session and state management
- **CentralLogger**: Centralized logging

### Sub-Agents
- **SubAgentModule**: Base class for all sub-agents
- **ReservationAgentModule**: Reservation handling
- **BillingAgentModule**: Billing inquiries
- **SupportAgentModule**: Support tickets
- **Pattern Agents**: Data retrieval, action, validation, calculation

### Integration
- **REST Integration**: REST API calls
- **GraphQL Integration**: GraphQL queries
- **Database Integration**: Database operations
- **Tool Agent Executor**: Tool execution

### Monitoring
- **PerformanceMonitor**: Performance metrics
- **HealthChecker**: System health
- **AlertManager**: Alerting system
- **AnalyticsManager**: Usage analytics
- **DashboardProvider**: Dashboard data

### Utilities
- **IntentRecognizer**: Intent recognition (LLM + patterns)
- **ResponseFormatter**: Response formatting (LLM + templates)
- **CacheManager**: Caching system
- **SecurityManager**: Security utilities
- **BackupManager**: Backup and recovery
- **Tracer**: Distributed tracing

## Documentation

- [Getting Started](./docs/GETTING_STARTED.md)
- [API Reference](./docs/API_REFERENCE.md)
- [Configuration Guide](./docs/CONFIGURATION_GUIDE.md)
- [Template Usage](./docs/TEMPLATE_USAGE_GUIDE.md)
- [Error Codes](./docs/ERROR_CODES.md)
- [Troubleshooting](./docs/TROUBLESHOOTING.md)
- [Best Practices](./docs/BEST_PRACTICES.md)
- [Developer Guide](./docs/DEVELOPER_GUIDE.md)
- [Architecture Decisions](./docs/ARCHITECTURE_DECISIONS.md)
- [Deployment](./docs/DEPLOYMENT.md)

## Testing

```bash
# Run all tests
npm test

# Run unit tests
npm run test:unit

# Run integration tests
npm run test:integration

# Run E2E tests
npm run test:e2e

# Run performance benchmarks
npm run test:performance
```

## Templates

Pre-configured templates for different use cases:
- `hospitality_hotel_v1` - Hotel management
- `travel_airline_v1` - Airline booking
- `ecommerce_support_v1` - E-commerce support
- `healthcare_appointments_v1` - Healthcare appointments
- `financial_services_v1` - Financial services
- `customer_support_v1` - General customer support

## Integration

### With Existing TestPanel

```typescript
import { TestPanelAdapter } from './utils/testPanelAdapter';

const adapter = new TestPanelAdapter();
await adapter.initializeFromNodes(nodes);
const response = await adapter.processCallerInput('input', 'session');
```

## Status

**Completion: 84.9%** (203/239 tasks)

All core components are implemented and production-ready!

