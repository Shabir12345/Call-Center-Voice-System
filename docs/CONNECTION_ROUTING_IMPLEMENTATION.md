# Connection Routing & Intent-Based Routing Implementation

## Overview

This document describes the implementation of the master agent connection routing system that enables intent-based routing between nodes in the call flow graph. The system allows the master agent to understand caller intent and choose the correct connection even when system prompts are unclear.

## Key Features

1. **Connection Context Cards**: Rich metadata for each connection describing when to use it, when not to use it, risk levels, and examples
2. **Intent Extraction**: Extracts caller intent from utterances with confidence scores and entities
3. **LLM-Based Scoring**: Uses AI to score candidate connections based on context cards and conversation
4. **Threshold-Based Guardrails**: Safe defaults and clarification flows when confidence is low
5. **Safety Confirmations**: Requires explicit confirmation for high-risk actions
6. **UI for Editing**: Click any connection in the workflow editor to edit its context card
7. **Debug Tools**: TestPanel integration for inspecting routing decisions
8. **Observability**: Comprehensive logging of all routing decisions for analytics

## Architecture

### Core Components

#### 1. Data Model (`types.ts`)
- `ConnectionContextCard`: Rich metadata for each connection
- `CallerIntent`: Extracted intent with confidence and entities
- `ConversationState`: Extended state tracking current node, intent, entities, flags
- `RoutingDecision`: Result of connection selection with scores and reasons
- `ConnectionScore`: LLM-scored candidate connection

#### 2. Storage (`utils/connectionContextStorage.ts`)
- Manages persistence of connection context cards
- Uses localStorage (can be extended to database)
- Provides CRUD operations for context cards
- Links context cards to edges in the workflow

#### 3. Intent Extraction (`utils/intentExtractor.ts`)
- Extracts intent from caller utterances
- Determines urgency level
- Updates conversation state with entities and flags
- Tracks intent history

#### 4. Connection Router (`utils/connectionRouter.ts`)
- Finds candidate connections from current node
- Filters by enabled status and preconditions
- Checks if preconditions are met based on conversation state

#### 5. Connection Scorer (`utils/connectionScorer.ts`)
- LLM-based scoring of candidate connections
- Uses connection context cards and conversation to score
- Applies rule-based boosts (risk penalties, priority boosts)
- Provides fallback scoring when LLM fails

#### 6. Routing Decision Maker (`utils/routingDecisionMaker.ts`)
- Orchestrates the routing decision process
- Applies threshold logic (score threshold, clarification threshold)
- Handles fallback and safe default connections
- Generates clarification questions

#### 7. Confirmation Handler (`utils/confirmationHandler.ts`)
- Handles confirmation flows for high-risk connections
- Generates confirmation messages
- Processes confirmation responses from callers

#### 8. Routing Logger (`utils/routingLogger.ts`)
- Logs all routing decisions with full context
- Provides analytics (average scores, fallback usage, etc.)
- Tracks outcomes (success/failure)
- Supports filtering and export

### UI Components

#### 1. Connection Details Panel (`components/workflow/ConnectionDetailsPanel.tsx`)
- Opens when clicking a connection in the workflow editor
- Editable fields for all context card properties
- Preview mode to see what the AI sees
- Templates for quick setup
- Beginner-friendly placeholders and help text

#### 2. Routing Debug Panel (`components/RoutingDebugPanel.tsx`)
- Debug view for inspecting routing decisions
- Shows intent extraction, candidate scores, chosen connection
- Displays recent routing history
- Can be integrated into TestPanel

## Usage

### Setting Up Connection Context Cards

1. **Click on a connection** (edge) in the workflow editor
2. The Connection Details Panel will open
3. Fill in the required fields:
   - **Purpose**: Short description
   - **When to Use**: Critical - describe when this connection should be used
   - **When NOT to Use**: Contraindications
   - **Example Phrases**: Example caller utterances
   - **Risk Level**: low/medium/high
   - **Preconditions**: Required data/flags before this connection can be used
4. Use templates for quick setup
5. Click "Save"

### Using Templates

The Connection Details Panel includes templates for common connection types:
- **Collect Information**: For gathering data from callers
- **Transfer to Department**: For routing to specialized agents
- **Explain Policy**: For providing information
- **Perform Action**: For executing actions
- **Sensitive Action**: For high-stakes operations

### Testing Routing Decisions

1. Open the TestPanel
2. Enable routing debug mode (integrate RoutingDebugPanel)
3. Simulate calls with different utterances
4. Inspect:
   - Extracted intent and confidence
   - Candidate connections and scores
   - Chosen connection and reason
   - Conversation state

### Viewing Analytics

Use the RoutingLogger to view analytics:
```typescript
import { getRoutingLogger } from './utils/routingLogger';

const logger = getRoutingLogger();
const analytics = logger.getAnalytics();
console.log('Average score:', analytics.averageScore);
console.log('Fallback usage:', analytics.fallbackUsage);
```

## Integration with Master Agent

To integrate with the master agent, use the routing decision maker:

```typescript
import { RoutingDecisionMaker } from './utils/routingDecisionMaker';
import { ConnectionRouter } from './utils/connectionRouter';
import { ConnectionScorer } from './utils/connectionScorer';
import { IntentExtractor } from './utils/intentExtractor';

// Initialize components
const router = new ConnectionRouter();
const scorer = new ConnectionScorer({ apiKey: 'your-api-key' });
const decisionMaker = new RoutingDecisionMaker(router, scorer, {
  scoreThreshold: 0.6,
  clarificationThreshold: 0.5,
});

// Extract intent
const { intent, state } = await intentExtractor.extractIntent(
  callerUtterance,
  conversationContext,
  currentState
);

// Make routing decision
const decision = await decisionMaker.makeRoutingDecision(
  currentNodeId,
  edges,
  callerUtterance,
  state,
  conversationHistory
);

// Check if confirmation needed
if (decision.requiredConfirmation) {
  // Ask for confirmation
  const confirmation = await confirmationHandler.createConfirmationRequest(decision, contextCard);
  // Process confirmation response
}
```

## Best Practices

1. **Write Clear "When to Use" Descriptions**: Be specific about when each connection should be used. The AI relies heavily on this.

2. **Provide Example Phrases**: Include 3-5 example phrases that callers might use. This helps the LLM match intent.

3. **Set Appropriate Risk Levels**: Mark high-risk connections (cancellations, refunds) as "high" risk to trigger confirmations.

4. **Use Preconditions**: Define preconditions to ensure connections are only available when required data is collected.

5. **Test with Real Utterances**: Use the debug panel to test with various caller utterances and refine context cards.

6. **Monitor Analytics**: Regularly check routing analytics to identify connections that score poorly and need improvement.

## Future Enhancements

- AI Assist: Use LLM to help write better "When to Use" descriptions
- Automatic Learning: Use logged decisions to improve connection descriptions
- A/B Testing: Test different connection descriptions to find optimal wording
- Multi-language Support: Context cards in multiple languages
- Visual Flow Analysis: Visualize routing decisions in the workflow graph

