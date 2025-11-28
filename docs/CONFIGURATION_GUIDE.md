# Configuration Guide

## Overview

The Master-Sub-Agent architecture supports extensive configuration through templates, system configs, and runtime settings.

## System Configuration

### Basic Configuration

```typescript
import { SystemOrchestrator } from './utils/systemOrchestrator';

const config = {
  masterAgent: {
    agentId: 'master_001',
    systemPrompt: 'You are a helpful assistant.',
    intents: ['confirm_reservation', 'get_billing_info'],
    voiceSettings: {
      speed: 1.0,
      tone: 'professional',
      language: 'en'
    },
    guardrails: {
      bannedPhrases: [],
      fallbackResponse: "I'm sorry, I didn't understand."
    }
  },
  subAgents: [
    {
      agentId: 'reservation_agent',
      specialty: 'reservations',
      systemPrompt: 'Handle reservations.',
      model: 'pro'
    }
  ],
  communication: {
    enabled: true,
    maxConversationDepth: 5,
    timeout: 30000
  },
  stateManagement: {
    storageType: 'session' // 'ephemeral' | 'session' | 'long_term'
  },
  logging: {
    level: 'info',
    maxLogs: 10000
  }
};
```

## App Variant Templates

### Using Templates

```typescript
import { AppVariantManager } from './utils/appVariant';

const manager = new AppVariantManager();

// Load template
const config = manager.loadVariant('hospitality_hotel_v1');

// Customize template
const customConfig = manager.loadVariant('hospitality_hotel_v1', {
  masterAgent: {
    voiceSettings: {
      tone: 'welcoming'
    }
  }
});
```

### Available Templates

1. **hospitality_hotel_v1** - Hotel management system
2. **travel_airline_v1** - Airline booking system
3. **ecommerce_support_v1** - E-commerce customer service
4. **healthcare_appointments_v1** - Healthcare appointment system
5. **financial_services_v1** - Financial services support

### Creating Custom Templates

```json
{
  "templateId": "my_custom_template",
  "name": "My Custom System",
  "description": "Description of the system",
  "version": "1.0",
  "masterAgent": {
    "agentId": "master",
    "systemPrompt": "You are...",
    "intents": ["intent1", "intent2"],
    "voiceSettings": {
      "speed": 1.0,
      "tone": "professional"
    }
  },
  "subAgents": [
    {
      "module": "MyAgentModule",
      "config": {
        "agentId": "agent_1",
        "specialty": "specialty_name",
        "systemPrompt": "Agent prompt",
        "model": "pro"
      }
    }
  ]
}
```

## Validation

### Validate Configuration

```typescript
import { ConfigValidator } from './utils/configValidator';

const validator = new ConfigValidator();
const result = validator.validateSystemConfig(config);

if (!result.valid) {
  console.error('Configuration errors:', result.errors);
}

if (result.warnings.length > 0) {
  console.warn('Configuration warnings:', result.warnings);
}
```

## Environment Variables

Recommended environment variables:

```bash
# API Keys
GEMINI_API_KEY=your_key_here

# Logging
LOG_LEVEL=info
MAX_LOGS=10000

# Performance
MAX_SESSIONS=10000
SESSION_TIMEOUT_MS=1800000

# Monitoring
ENABLE_MONITORING=true
HEALTH_CHECK_INTERVAL_MS=60000
```

## Best Practices

1. **Use Templates**: Start with existing templates and customize
2. **Validate Configs**: Always validate before deployment
3. **Environment-Specific**: Use different configs for dev/staging/prod
4. **Monitor**: Enable monitoring and alerting in production
5. **Test**: Test configurations in staging before production

