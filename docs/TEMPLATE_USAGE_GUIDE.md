# Template Usage Guide

## Overview

Templates provide pre-configured app variants for different use cases. They include master agent settings, sub-agent configurations, and business rules.

## Loading Templates

### Basic Usage

```typescript
import { AppVariantManager } from './utils/appVariant';
import { SystemOrchestrator } from './utils/systemOrchestrator';

const manager = new AppVariantManager();

// Load template
const config = manager.loadVariant('hospitality_hotel_v1');

// Use with orchestrator
const orchestrator = new SystemOrchestrator({
  masterAgent: config.masterAgentConfig,
  subAgents: config.subAgentConfigs,
  appVariant: 'hospitality_hotel_v1'
});
```

### Customizing Templates

```typescript
const customConfig = manager.loadVariant('hospitality_hotel_v1', {
  masterAgent: {
    voiceSettings: {
      tone: 'friendly'
    }
  },
  communicationConfig: {
    timeout: {
      subAgentLoop: 45000
    }
  }
});
```

## Available Templates

### 1. Hospitality/Hotel

**Template ID**: `hospitality_hotel_v1`

**Features**:
- Reservation management
- Concierge services
- Loyalty program

**Intents**:
- `book_room`
- `confirm_reservation`
- `modify_reservation`
- `cancel_reservation`
- `request_service`

### 2. Travel/Airline

**Template ID**: `travel_airline_v1`

**Features**:
- Flight booking
- Flight status
- Booking modifications

**Intents**:
- `search_flights`
- `book_flight`
- `modify_booking`
- `check_in`
- `get_flight_status`

### 3. E-Commerce

**Template ID**: `ecommerce_support_v1`

**Features**:
- Order tracking
- Product information
- Returns and refunds

**Intents**:
- `track_order`
- `check_order_status`
- `return_item`
- `get_product_info`

### 4. Healthcare

**Template ID**: `healthcare_appointments_v1`

**Features**:
- Appointment scheduling
- Patient information
- HIPAA compliance

**Intents**:
- `schedule_appointment`
- `modify_appointment`
- `cancel_appointment`
- `check_appointment`

### 5. Financial Services

**Template ID**: `financial_services_v1`

**Features**:
- Account management
- Transaction processing
- Security and compliance

**Intents**:
- `check_balance`
- `get_transaction_history`
- `transfer_funds`
- `pay_bill`

## Creating Custom Templates

### Step 1: Define Template Structure

```json
{
  "templateId": "my_template_v1",
  "name": "My Template",
  "description": "Description",
  "version": "1.0",
  "masterAgent": { ... },
  "subAgents": [ ... ]
}
```

### Step 2: Register Template

```typescript
import { AppVariantManager } from './utils/appVariant';

const manager = new AppVariantManager();
manager.loadTemplateFromJSON(templateJson);
```

### Step 3: Use Template

```typescript
const config = manager.loadVariant('my_template_v1');
```

## Template Validation

```typescript
import { ConfigValidator } from './utils/configValidator';

const validator = new ConfigValidator();
const result = validator.validateTemplate(template);

if (!result.valid) {
  console.error('Template errors:', result.errors);
}
```

## Best Practices

1. **Version Templates**: Use semantic versioning
2. **Document Changes**: Keep changelog for templates
3. **Test Templates**: Validate before use
4. **Reuse Components**: Share sub-agents across templates
5. **Environment-Specific**: Create dev/staging/prod variants

