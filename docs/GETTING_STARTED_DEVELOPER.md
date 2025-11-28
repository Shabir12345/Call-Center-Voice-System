# Getting Started - Developer Guide

## Welcome! 👋

This guide will help you understand the Call Center Voice System architecture and get started developing.

---

## 🏗️ Architecture Overview

### Two Main Layers

1. **Library Layer** (`utils/`) - Reusable orchestration system
   - `SystemOrchestrator` - Main coordination system
   - `MasterAgent` - Handles caller interactions
   - `SubAgentModule` - Specialized task handlers
   - `CommunicationManager` - Agent-to-agent communication

2. **Demo App Layer** (`components/`) - UI and testing interface
   - `TestPanel.tsx` - Main testing interface
   - `WorkflowEditor.tsx` - Visual workflow builder
   - Various node components for workflow editing

### Key Concepts

**Master-Sub-Agent Pattern**:
- **Master Agent**: Single point of contact with callers
- **Sub-Agents**: Specialized agents for specific tasks (reservations, billing, etc.)
- **Communication**: Structured messages between agents

**State Management**:
- Sessions track conversation state
- State stored in memory or localStorage (encrypted)
- Automatic cleanup of old sessions

**Error Handling**:
- Comprehensive error categories
- Automatic retries with exponential backoff
- Fallback strategies

---

## 🚀 Quick Start

### 1. Understand the Entry Points

**For Testing/UI Development**:
- Start with `components/TestPanel.tsx`
- This is the main interface for testing the system
- Contains the voice interaction UI

**For Library Development**:
- Start with `utils/systemOrchestrator.ts`
- This is the core orchestration system
- Used by TestPanel (or should be - see architecture notes)

### 2. Key Files to Know

**Core System**:
- `utils/systemOrchestrator.ts` - Main orchestrator
- `utils/masterAgent.ts` - Master agent implementation
- `utils/subAgentModule.ts` - Base class for sub-agents
- `utils/agentCommunication.ts` - Communication system

**State & Storage**:
- `utils/stateManager.ts` - Session and state management
- `utils/logger.ts` - Logging system
- `utils/encryption.ts` - Data encryption (NEW)

**Security**:
- `utils/rateLimiter.ts` - Rate limiting (NEW)
- `utils/inputSanitizer.ts` - Input sanitization (NEW)
- `utils/errorSanitizer.ts` - Error sanitization (NEW)
- `utils/resourceMonitor.ts` - Resource monitoring (NEW)

**Testing**:
- `tests/unit/` - Unit tests
- `tests/integration/` - Integration tests
- `tests/e2e/` - End-to-end tests

### 3. Development Workflow

1. **Make Changes**:
   ```bash
   npm run dev
   ```

2. **Run Tests**:
   ```bash
   npm test
   ```

3. **Check Types**:
   ```bash
   npx tsc --noEmit
   ```

4. **Build**:
   ```bash
   npm run build
   ```

---

## 📚 Learning Path

### Beginner Path

1. **Start Here**: Read `docs/ARCHITECTURE_OVERVIEW.md` (if exists) or `MASTER_SUB_AGENT_ARCHITECTURE_PLAN.md`
2. **Try the UI**: Run `npm run dev` and explore `TestPanel.tsx`
3. **Read Code**: Look at `utils/masterAgent.ts` to understand the flow
4. **Make a Change**: Add a simple feature or fix a bug

### Intermediate Path

1. **Understand Communication**: Study `utils/agentCommunication.ts`
2. **Create a Sub-Agent**: Extend `SubAgentModule` to create a new agent
3. **Add Integration**: Create a new integration in `utils/integrations/`
4. **Write Tests**: Add tests for your new code

### Advanced Path

1. **System Orchestration**: Deep dive into `SystemOrchestrator`
2. **Error Handling**: Understand the error handling system
3. **State Management**: Study session and state management
4. **Performance**: Optimize hot paths

---

## 🔍 Common Questions

### Q: Where do I start if I want to add a new feature?

**A**: It depends on the feature:
- **New Agent**: Create in `utils/subAgents/` extending `SubAgentModule`
- **New Integration**: Add to `utils/integrations/`
- **UI Feature**: Modify `components/TestPanel.tsx` or create new component
- **Core Feature**: Modify `utils/systemOrchestrator.ts` or related core files

### Q: How do agents communicate?

**A**: Through `CommunicationManager`:
```typescript
const message = createMessage({
  from: 'master_agent',
  to: 'reservation_agent',
  type: 'REQUEST',
  content: { task: 'confirm_reservation', parameters: {...} }
});

const response = await commManager.sendAndWait(message);
```

### Q: Where is state stored?

**A**: In `StateManager`:
- Ephemeral: In-memory only
- Session: localStorage (encrypted)
- Long-term: Database (interface exists, implementation needed)

### Q: How do I add error handling?

**A**: Use the error handling system:
```typescript
import { createErrorResponse, ErrorCode } from './utils/errorHandling';

try {
  // Your code
} catch (error) {
  return createErrorResponse(ErrorCode.EXTERNAL_API_FAILURE, error.message);
}
```

---

## 🛠️ Development Tips

### 1. Use TypeScript Types

All types are defined in `types.ts`. Use them for better IDE support.

### 2. Follow Error Handling Patterns

Use the error handling system instead of throwing raw errors:
```typescript
// Good
return createErrorResponse(ErrorCode.INVALID_INPUT, 'Invalid data');

// Bad
throw new Error('Invalid data');
```

### 3. Log Everything

Use the logger for all important events:
```typescript
logger.log({
  type: 'system',
  from: 'my_component',
  to: 'system',
  message: 'Important event',
  level: 'info'
});
```

### 4. Test Your Code

Write tests for new features:
```typescript
// tests/unit/myFeature.test.ts
import { describe, it, expect } from 'vitest';

describe('MyFeature', () => {
  it('should work correctly', () => {
    // Test code
  });
});
```

### 5. Sanitize Inputs

Always sanitize user inputs:
```typescript
import { sanitizeInput } from './utils/inputSanitizer';

const sanitized = sanitizeInput(userInput, {
  maxLength: 1000,
  allowHtml: false
});
```

---

## 📖 Documentation

- `docs/THREAT_ANALYSIS.md` - Security threats and mitigations
- `docs/ARCHITECTURE_DECISIONS.md` - Why we made certain choices
- `docs/BEST_PRACTICES.md` - Coding best practices
- `docs/API_REFERENCE.md` - API documentation
- `MASTER_SUB_AGENT_ARCHITECTURE_PLAN.md` - Complete architecture plan

---

## 🐛 Debugging

### Enable Debug Logging

```typescript
const logger = new CentralLogger('debug');
```

### Check System Health

```typescript
import { HealthChecker } from './utils/healthChecker';

const health = await healthChecker.checkHealth();
console.log(health);
```

### Monitor Resources

```typescript
import { globalResourceMonitor } from './utils/resourceMonitor';

const metrics = globalResourceMonitor.getMetrics();
console.log(metrics);
```

---

## ✅ Checklist for New Developers

- [ ] Read this guide
- [ ] Read architecture overview
- [ ] Set up development environment
- [ ] Run the app locally
- [ ] Explore TestPanel UI
- [ ] Read a core utility file (e.g., `masterAgent.ts`)
- [ ] Make a small change and test it
- [ ] Write a test for your change
- [ ] Submit a PR

---

## 🆘 Need Help?

1. Check the documentation in `docs/`
2. Read the code comments
3. Look at existing tests for examples
4. Check `docs/TROUBLESHOOTING.md`

---

**Welcome to the team!** 🎉

**Last Updated**: 2025-01-27

