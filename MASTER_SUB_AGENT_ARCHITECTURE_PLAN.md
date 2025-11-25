# Master-Sub-Agent Architecture Plan
## Comprehensive Design for Conversational AI Multi-Agent Systems

---

## Table of Contents
1. [Overview](#overview)
2. [Component Definitions](#component-definitions)
3. [Data Flow Diagrams](#data-flow-diagrams)
4. [Input-Output Model](#input-output-model)
5. [Implementation Guidelines](#implementation-guidelines)
6. [Error Handling and Reliability](#error-handling-and-reliability)
7. [State Management](#state-management)
8. [Customization Strategies](#customization-strategies)
9. [Example Scenarios](#example-scenarios)
10. [Testing and Best Practices](#testing-and-best-practices)

---

## Overview

### High-Level Summary

The Master-Sub-Agent architecture is a hierarchical, orchestrated system designed for conversational AI applications, particularly call center voice systems. The architecture follows a **request-delegation-response** pattern where:

- **Master Agent**: Acts as the single point of contact with callers, coordinates all interactions, and maintains conversation context
- **Sub-Agents**: Specialized agents that handle domain-specific tasks (e.g., reservations, billing, support)
- **Supporting Systems**: Logging, state management, validation, and routing infrastructure

### Key Principles

1. **Stateless Agents, Stateful System**: Individual agents are stateless, but the system maintains conversation state through centralized logging and session management
2. **Structured Communication**: All agent-to-agent communication uses standardized JSON schemas
3. **Fault Tolerance**: Multiple layers of error handling, retries, and fallback mechanisms
4. **Extensibility**: Plugin-based architecture allows easy addition of new sub-agents without core changes
5. **Observability**: Comprehensive logging and monitoring at every interaction point

### Architecture Layers

```
┌─────────────────────────────────────────────────────────┐
│                    Caller Interface                      │
│              (Voice/Text Input/Output)                   │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                  Master Agent                            │
│  • Intent Recognition                                    │
│  • Context Management                                    │
│  • Sub-Agent Orchestration                               │
│  • Response Formatting                                   │
└──────┬───────────────────────────────────┬──────────────┘
       │                                   │
       │                                   │
┌──────▼──────────┐              ┌────────▼──────────┐
│  Sub-Agent 1    │              │  Sub-Agent 2      │
│  (Reservations) │              │  (Billing)        │
└──────┬──────────┘              └────────┬──────────┘
       │                                   │
       │                                   │
┌──────▼──────────────────────────────────▼──────────┐
│           Supporting Infrastructure                │
│  • Communication Manager                           │
│  • State Manager                                   │
│  • Logger                                          │
│  • Validator                                       │
│  • External System Integrations                    │
└────────────────────────────────────────────────────┘
```

---

## Component Definitions

### 1. Master Agent (Router Node)

**Purpose**: Central coordinator that interfaces with callers and orchestrates sub-agents.

**Responsibilities**:
- Receive and parse caller input (voice/text)
- Determine intent and route to appropriate sub-agent
- Maintain conversation context and history
- Format and deliver responses to callers
- Handle errors and provide fallback responses
- Manage conversation flow (greetings, clarifications, confirmations)

**Key Attributes**:
- `agentId`: Unique identifier (e.g., "master_001")
- `systemPrompt`: Instructions for behavior and personality
- `voiceSettings`: Voice configuration (speed, tone, interruptibility)
- `intents`: List of recognized intents and their routing rules
- `guardrails`: Safety filters and fallback responses
- `bidirectionalEnabled`: Whether to allow sub-agents to ask questions back

**State Management**:
- Maintains active conversation sessions
- Tracks conversation history per session
- Stores pending requests awaiting sub-agent responses

### 2. Sub-Agents (Department Nodes)

**Purpose**: Specialized agents that handle domain-specific tasks.

**Responsibilities**:
- Process task-specific requests from master agent
- Execute business logic or data retrieval
- Validate input parameters
- Generate structured outputs (results, errors, or information requests)
- Optionally request clarifications from master agent
- Integrate with external systems (databases, APIs)

**Key Attributes**:
- `agentId`: Unique identifier (e.g., "reservation_agent_001")
- `specialty`: Domain expertise (e.g., "reservations", "billing", "support")
- `systemPrompt`: Domain-specific instructions
- `tools`: List of available tools/integrations
- `model`: AI model preference ('flash' for speed, 'pro' for complexity)
- `bidirectionalEnabled`: Whether agent can ask questions back
- `maxConversationDepth`: Maximum nested conversation depth

**Types of Sub-Agents**:
1. **Data Retrieval Agents**: Query databases, knowledge bases
2. **Action Agents**: Perform operations (create, update, delete)
3. **Validation Agents**: Verify data, check permissions
4. **Calculation Agents**: Perform computations, generate reports

### 3. Tool Agents (Sub-Agent Nodes)

**Purpose**: Direct execution units that connect to integration nodes.

**Responsibilities**:
- Execute specific tool functions
- Connect to external systems (REST APIs, GraphQL, databases)
- Return structured data to calling agent
- Handle tool-specific errors

**Key Attributes**:
- `functionName`: Name of the function/tool
- `apiEndpoint`: External system endpoint
- `parameters`: Input parameter schema
- `outputSchema`: Expected output structure
- `successCriteria`: Conditions for successful execution

### 4. Communication Manager

**Purpose**: Central coordinator for all agent-to-agent communication.

**Responsibilities**:
- Route messages between agents
- Manage message queues and priorities
- Handle request-response patterns
- Track conversation threads
- Implement retry logic and timeouts
- Emit communication events for monitoring

**Key Features**:
- Message validation using FIPA-ACL inspired protocols
- Priority-based message queuing
- Automatic retry for failed communications
- Thread management for multi-turn conversations
- Event emission for observability

### 5. State Manager

**Purpose**: Maintains conversation state and session data.

**Responsibilities**:
- Store conversation history per session
- Track conversation context (user preferences, pending actions)
- Manage session lifecycle (create, update, expire)
- Provide state retrieval for resumption
- Support state persistence (in-memory or database)

**Storage Options**:
- **Ephemeral**: In-memory only, lost on restart
- **Session**: Persisted for session duration
- **Long-term**: Persistent storage (database) for cross-session context

### 6. Logger

**Purpose**: Comprehensive logging and auditing system.

**Responsibilities**:
- Log all agent-caller interactions
- Log all agent-agent communications
- Record timestamps, participants, content
- Support log levels (debug, info, warn, error)
- Enable log querying and analysis
- Support log export for debugging

**Log Entry Structure**:
```json
{
  "id": "log_1234567890",
  "timestamp": 1234567890000,
  "sessionId": "session_abc123",
  "type": "agent_to_agent" | "caller_to_agent" | "agent_to_caller" | "system",
  "from": "agent_id",
  "to": "agent_id" | "caller",
  "message": "message_content",
  "metadata": {
    "messageId": "msg_123",
    "threadId": "thread_456",
    "duration": 150,
    "success": true,
    "error": null
  }
}
```

### 7. Validator

**Purpose**: Ensures data integrity and protocol compliance.

**Responsibilities**:
- Validate input schemas before processing
- Validate output schemas before returning
- Check protocol compliance (message format, required fields)
- Sanitize inputs to prevent injection attacks
- Verify data types and constraints

---

## Data Flow Diagrams

### Primary Flow: Caller Query → Response

```
┌─────────┐
│ Caller  │
└────┬────┘
     │ 1. Query: "Confirm my reservation"
     ▼
┌─────────────────────────────────────────┐
│         Master Agent                    │
│  • Parse input                           │
│  • Extract intent: "confirm_reservation"│
│  • Create session/thread                 │
│  • Log interaction                      │
└────┬────────────────────────────────────┘
     │ 2. Structured Input
     │ {
     │   "task": "confirm_reservation",
     │   "user_id": "123",
     │   "context": {...}
     │ }
     ▼
┌─────────────────────────────────────────┐
│    Communication Manager                │
│  • Route to reservation sub-agent        │
│  • Queue message                        │
│  • Track request                        │
└────┬────────────────────────────────────┘
     │ 3. Agent Message
     ▼
┌─────────────────────────────────────────┐
│    Reservation Sub-Agent                 │
│  • Validate input                        │
│  • Check required data                   │
│  • Determine: needs_info                 │
└────┬────────────────────────────────────┘
     │ 4. Structured Output
     │ {
     │   "status": "needs_info",
     │   "required": ["reservation_number", "full_name"]
     │ }
     ▼
┌─────────────────────────────────────────┐
│    Communication Manager                │
│  • Route response back                  │
│  • Update thread                        │
└────┬────────────────────────────────────┘
     │ 5. Response
     ▼
┌─────────────────────────────────────────┐
│         Master Agent                    │
│  • Parse sub-agent output               │
│  • Format user-friendly message         │
│  • Log interaction                      │
└────┬────────────────────────────────────┘
     │ 6. User Message: "I need your reservation number and full name"
     ▼
┌─────────┐
│ Caller  │
└─────────┘
```

### Bidirectional Flow: Sub-Agent Requests Clarification

```
┌─────────────────────────────────────────┐
│         Master Agent                    │
│  • Sends task to sub-agent              │
└────┬────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────┐
│    Reservation Sub-Agent                 │
│  • Processes request                    │
│  • Determines ambiguity                 │
│  • Generates clarification question     │
└────┬────────────────────────────────────┘
     │ Clarification Message (CLARIFY type)
     │ {
     │   "type": "CLARIFY",
     │   "question": "Which reservation? You have 3 upcoming."
     │ }
     ▼
┌─────────────────────────────────────────┐
│    Communication Manager                │
│  • Route clarification                  │
│  • Track conversation depth              │
└────┬────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────┐
│         Master Agent                    │
│  • Receives clarification request       │
│  • Formats for caller                   │
│  • Waits for caller response            │
└────┬────────────────────────────────────┘
     │
     ▼
┌─────────┐
│ Caller  │ Provides answer
└────┬────┘
     │
     ▼
┌─────────────────────────────────────────┐
│         Master Agent                    │
│  • Sends updated input to sub-agent     │
└────┬────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────┐
│    Reservation Sub-Agent                 │
│  • Processes with new information       │
│  • Returns result                       │
└─────────────────────────────────────────┘
```

### Error Flow: Sub-Agent Failure

```
┌─────────────────────────────────────────┐
│         Master Agent                    │
│  • Sends request to sub-agent           │
└────┬────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────┐
│    Communication Manager                │
│  • Routes message                       │
│  • Starts timeout timer                 │
└────┬────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────┐
│    Reservation Sub-Agent                 │
│  • Attempts to connect to external API  │
│  • Connection fails                     │
└────┬────────────────────────────────────┘
     │ Error Output
     │ {
     │   "status": "error",
     │   "errorCode": "EXTERNAL_API_FAILURE",
     │   "message": "Could not connect to reservation system"
     │ }
     ▼
┌─────────────────────────────────────────┐
│    Communication Manager                │
│  • Detects error                        │
│  • Logs error event                     │
│  • Routes error response                │
└────┬────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────┐
│         Master Agent                    │
│  • Receives error                       │
│  • Determines fallback strategy         │
│  • Option 1: Retry with different agent │
│  • Option 2: Use cached data            │
│  • Option 3: Apologize and offer alt     │
└────┬────────────────────────────────────┘
     │
     ▼
┌─────────┐
│ Caller  │ Receives: "I'm having trouble accessing the system. 
│         │ Can I help you with something else?"
└─────────┘
```

---

## Input-Output Model

### Input Schema: Master Agent → Sub-Agent

**Standard Input Format**:
```json
{
  "task": "string",                    // Required: Task identifier
  "parameters": {                     // Required: Task parameters
    "key1": "value1",
    "key2": "value2"
  },
  "context": {                         // Required: Conversation context
    "threadId": "thread_123",
    "sessionId": "session_456",
    "callerId": "user_789",
    "conversationHistory": [
      {
        "role": "caller",
        "content": "Confirm my reservation",
        "timestamp": 1234567890
      }
    ],
    "metadata": {
      "userPreferences": {},
      "accessLevel": "standard",
      "language": "en"
    }
  },
  "requestId": "req_abc123",           // Required: Unique request ID
  "timestamp": 1234567890000,          // Required: Unix timestamp (ms)
  "priority": "normal",                // Optional: "low" | "normal" | "high"
  "timeout": 30000,                    // Optional: Timeout in milliseconds
  "retryCount": 0                      // Optional: Current retry attempt
}
```

**Task-Specific Examples**:

1. **Reservation Confirmation**:
```json
{
  "task": "confirm_reservation",
  "parameters": {
    "reservation_number": "ABC123",
    "full_name": "John Doe"
  },
  "context": {...}
}
```

2. **Billing Inquiry**:
```json
{
  "task": "get_billing_info",
  "parameters": {
    "account_id": "acc_456",
    "month": "2025-01"
  },
  "context": {...}
}
```

3. **Support Ticket Creation**:
```json
{
  "task": "create_support_ticket",
  "parameters": {
    "issue_type": "technical",
    "description": "Cannot access account",
    "severity": "high"
  },
  "context": {...}
}
```

### Output Schema: Sub-Agent → Master Agent

**Standard Output Format**:
```json
{
  "status": "success" | "needs_info" | "error" | "partial",
  "data": {},                         // Result data (if status is success)
  "error": {                           // Error details (if status is error)
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {},
    "retryable": true
  },
  "required": [                        // Required fields (if status is needs_info)
    {
      "field": "reservation_number",
      "type": "string",
      "description": "Your 6-character reservation code",
      "validation": {
        "pattern": "^[A-Z0-9]{6}$",
        "example": "ABC123"
      }
    }
  ],
  "clarification": {                  // Clarification request (if needed)
    "question": "Which reservation would you like to confirm?",
    "options": [
      {"value": "res_1", "label": "Reservation ABC123 - Dec 1, 2025"},
      {"value": "res_2", "label": "Reservation XYZ789 - Dec 15, 2025"}
    ],
    "type": "single_choice" | "multiple_choice" | "text"
  },
  "metadata": {
    "processingTime": 150,             // Milliseconds
    "source": "direct" | "session",    // How response was generated
    "confidence": 0.95,                 // Confidence score (0-1)
    "suggestedActions": [               // Suggested next actions
      "view_details",
      "modify_reservation"
    ]
  },
  "requestId": "req_abc123",            // Echo of input requestId
  "timestamp": 1234567890000
}
```

**Status-Specific Examples**:

1. **Success Response**:
```json
{
  "status": "success",
  "data": {
    "reservation": {
      "number": "ABC123",
      "date": "2025-12-01",
      "status": "confirmed",
      "guest_name": "John Doe",
      "room_type": "Deluxe Suite"
    }
  },
  "metadata": {
    "processingTime": 120,
    "source": "direct",
    "confidence": 1.0
  },
  "requestId": "req_abc123",
  "timestamp": 1234567890000
}
```

2. **Needs Info Response**:
```json
{
  "status": "needs_info",
  "required": [
    {
      "field": "reservation_number",
      "type": "string",
      "description": "Your 6-character reservation code",
      "validation": {
        "pattern": "^[A-Z0-9]{6}$"
      }
    },
    {
      "field": "full_name",
      "type": "string",
      "description": "Full name as it appears on the reservation"
    }
  ],
  "requestId": "req_abc123",
  "timestamp": 1234567890000
}
```

3. **Error Response**:
```json
{
  "status": "error",
  "error": {
    "code": "RESERVATION_NOT_FOUND",
    "message": "No reservation found with the provided details",
    "details": {
      "searchedFields": ["reservation_number", "full_name"],
      "suggestions": [
        "Verify the reservation number",
        "Check if the name matches exactly"
      ]
    },
    "retryable": false
  },
  "requestId": "req_abc123",
  "timestamp": 1234567890000
}
```

4. **Clarification Response**:
```json
{
  "status": "needs_info",
  "clarification": {
    "question": "Which reservation would you like to confirm?",
    "options": [
      {
        "value": "res_1",
        "label": "Reservation ABC123 - December 1, 2025 - Deluxe Suite"
      },
      {
        "value": "res_2",
        "label": "Reservation XYZ789 - December 15, 2025 - Standard Room"
      }
    ],
    "type": "single_choice"
  },
  "requestId": "req_abc123",
  "timestamp": 1234567890000
}
```

### Message Protocol Types

Following FIPA-ACL inspired protocol:

1. **INFORM**: One-way information sharing (no response expected)
2. **QUERY**: Question that expects an answer (response required)
3. **REQUEST**: Action request (response required)
4. **CONFIRM**: Confirmation of understanding (no response expected)
5. **CLARIFY**: Request for clarification (response required)

---

## Implementation Guidelines

### Step 1: Master Agent Request Processing

**Pseudocode**:
```python
def process_caller_input(caller_input: str, session_id: str):
    """
    Main entry point for processing caller input
    """
    # 1. Create or retrieve session
    session = state_manager.get_or_create_session(session_id)
    
    # 2. Log caller input
    logger.log({
        "type": "caller_to_agent",
        "from": "caller",
        "to": "master_agent",
        "message": caller_input,
        "sessionId": session_id
    })
    
    # 3. Parse and extract intent
    intent_result = intent_recognizer.parse(caller_input, session.context)
    
    # 4. Determine target sub-agent
    target_agent = router.determine_agent(intent_result.intent)
    
    # 5. Build structured input
    structured_input = {
        "task": intent_result.task,
        "parameters": intent_result.parameters,
        "context": {
            "threadId": session.current_thread_id,
            "sessionId": session_id,
            "callerId": session.caller_id,
            "conversationHistory": session.get_recent_history(5),
            "metadata": session.metadata
        },
        "requestId": generate_request_id(),
        "timestamp": current_timestamp(),
        "priority": determine_priority(intent_result)
    }
    
    # 6. Send to sub-agent via communication manager
    try:
        response = await communication_manager.send_and_wait(
            create_message(
                from="master_agent",
                to=target_agent,
                type="REQUEST",
                content=structured_input,
                context=session.context
            ),
            timeout=30000
        )
        
        # 7. Process sub-agent response
        return process_sub_agent_response(response, session)
        
    except TimeoutError:
        return handle_timeout(session)
    except Exception as e:
        return handle_error(e, session)
```

### Step 2: Sub-Agent Request Processing

**Pseudocode**:
```python
async def handle_sub_agent_request(message: AgentMessage):
    """
    Sub-agent handler for incoming requests
    """
    # 1. Validate input
    validation_result = validator.validate_input(
        message.content,
        expected_schema=get_task_schema(message.content["task"])
    )
    
    if not validation_result.is_valid:
        return create_error_response(
            message,
            error_code="INVALID_INPUT",
            error_message=validation_result.error
        )
    
    # 2. Extract task and parameters
    task = message.content["task"]
    parameters = message.content["parameters"]
    context = message.content["context"]
    
    # 3. Process task based on type
    try:
        if task == "confirm_reservation":
            result = await process_confirm_reservation(parameters, context)
        elif task == "get_billing_info":
            result = await process_get_billing_info(parameters, context)
        # ... other tasks
        
        # 4. Validate output
        output_validation = validator.validate_output(
            result,
            expected_schema=get_output_schema(task)
        )
        
        if not output_validation.is_valid:
            return create_error_response(
                message,
                error_code="INVALID_OUTPUT",
                error_message="Sub-agent generated invalid output"
            )
        
        # 5. Return structured response
        return create_success_response(message, result)
        
    except MissingDataError as e:
        return create_needs_info_response(message, e.required_fields)
    except ExternalSystemError as e:
        return create_error_response(
            message,
            error_code=e.code,
            error_message=e.message,
            retryable=e.retryable
        )
    except Exception as e:
        logger.log_error(e, message)
        return create_error_response(
            message,
            error_code="INTERNAL_ERROR",
            error_message="An unexpected error occurred"
        )
```

### Step 3: Error Handling with Retry Logic

**Pseudocode**:
```python
async def send_with_retry(
    message: AgentMessage,
    max_retries: int = 2,
    initial_delay: int = 1000
):
    """
    Send message with automatic retry on failure
    """
    last_error = None
    
    for attempt in range(max_retries + 1):
        try:
            response = await communication_manager.send_and_wait(
                message,
                timeout=message.timeout or 30000
            )
            
            # Check if response indicates retryable error
            if response.get("status") == "error":
                error = response.get("error", {})
                if error.get("retryable") and attempt < max_retries:
                    delay = initial_delay * (2 ** attempt)  # Exponential backoff
                    await sleep(delay)
                    continue
                else:
                    return response
            
            return response
            
        except TimeoutError:
            last_error = TimeoutError("Request timed out")
            if attempt < max_retries:
                delay = initial_delay * (2 ** attempt)
                await sleep(delay)
                continue
                
        except NetworkError as e:
            last_error = e
            if attempt < max_retries and is_retryable_network_error(e):
                delay = initial_delay * (2 ** attempt)
                await sleep(delay)
                continue
            else:
                break
                
        except Exception as e:
            last_error = e
            if not is_retryable_error(e):
                break
            if attempt < max_retries:
                delay = initial_delay * (2 ** attempt)
                await sleep(delay)
                continue
    
    # All retries exhausted
    return create_error_response(
        message,
        error_code="MAX_RETRIES_EXCEEDED",
        error_message=f"Failed after {max_retries} retries: {str(last_error)}",
        retryable=False
    )
```

### Step 4: State Management

**Pseudocode**:
```python
class StateManager:
    def __init__(self, storage_type: str = "session"):
        self.storage = self._create_storage(storage_type)
        self.sessions: Dict[str, Session] = {}
    
    def get_or_create_session(self, session_id: str) -> Session:
        """
        Retrieve existing session or create new one
        """
        if session_id in self.sessions:
            session = self.sessions[session_id]
            # Check if session expired
            if session.is_expired():
                self.sessions.pop(session_id)
            else:
                return session
        
        # Create new session
        session = Session(
            id=session_id,
            created_at=current_timestamp(),
            expires_at=current_timestamp() + SESSION_TIMEOUT,
            context=ConversationContext(
                threadId=generate_thread_id(),
                sessionId=session_id
            )
        )
        self.sessions[session_id] = session
        
        # Persist if using persistent storage
        if self.storage.is_persistent():
            self.storage.save_session(session)
        
        return session
    
    def update_session(self, session_id: str, updates: Dict):
        """
        Update session with new information
        """
        session = self.get_or_create_session(session_id)
        
        # Update session attributes
        for key, value in updates.items():
            setattr(session, key, value)
        
        session.updated_at = current_timestamp()
        
        # Persist if using persistent storage
        if self.storage.is_persistent():
            self.storage.update_session(session)
    
    def add_to_history(self, session_id: str, entry: HistoryEntry):
        """
        Add entry to conversation history
        """
        session = self.get_or_create_session(session_id)
        session.history.append(entry)
        
        # Limit history size (keep last N entries)
        if len(session.history) > MAX_HISTORY_SIZE:
            session.history = session.history[-MAX_HISTORY_SIZE:]
        
        # Persist if using persistent storage
        if self.storage.is_persistent():
            self.storage.update_session(session)
```

### Step 5: Response Formatting

**Pseudocode**:
```python
def format_response_for_caller(
    sub_agent_response: Dict,
    session: Session
) -> str:
    """
    Convert structured sub-agent response to natural language for caller
    """
    status = sub_agent_response["status"]
    
    if status == "success":
        return format_success_message(
            sub_agent_response["data"],
            session.context
        )
    
    elif status == "needs_info":
        if "clarification" in sub_agent_response:
            return format_clarification_question(
                sub_agent_response["clarification"]
            )
        else:
            return format_info_request(
                sub_agent_response["required"]
            )
    
    elif status == "error":
        error = sub_agent_response["error"]
        
        # Check for user-friendly error messages
        user_message = get_user_friendly_error_message(
            error["code"],
            error["message"]
        )
        
        # Add suggestions if available
        if "details" in error and "suggestions" in error["details"]:
            suggestions = error["details"]["suggestions"]
            user_message += format_suggestions(suggestions)
        
        return user_message
    
    else:
        return "I'm not sure how to respond to that. Can you rephrase?"
```

---

## Error Handling and Reliability

### Error Categories

1. **Input Validation Errors**
   - **Code**: `INVALID_INPUT`
   - **Retryable**: No
   - **Action**: Return error to master agent, request corrected input

2. **External System Errors**
   - **Code**: `EXTERNAL_API_FAILURE`, `DATABASE_ERROR`, `NETWORK_ERROR`
   - **Retryable**: Yes (with exponential backoff)
   - **Action**: Retry up to max_retries, then fallback

3. **Timeout Errors**
   - **Code**: `TIMEOUT_ERROR`
   - **Retryable**: Yes
   - **Action**: Retry with same or increased timeout

4. **Missing Data Errors**
   - **Code**: `MISSING_REQUIRED_DATA`
   - **Retryable**: No
   - **Action**: Return needs_info response with required fields

5. **Permission/Authentication Errors**
   - **Code**: `UNAUTHORIZED`, `FORBIDDEN`
   - **Retryable**: No
   - **Action**: Return error, may trigger re-authentication

6. **Internal Errors**
   - **Code**: `INTERNAL_ERROR`, `UNEXPECTED_ERROR`
   - **Retryable**: Depends on error type
   - **Action**: Log error, return generic error message

### Retry Strategy

```python
RETRY_CONFIG = {
    "max_retries": 2,
    "initial_delay_ms": 1000,
    "max_delay_ms": 5000,
    "backoff_multiplier": 2,
    "retryable_errors": [
        "EXTERNAL_API_FAILURE",
        "NETWORK_ERROR",
        "TIMEOUT_ERROR",
        "RATE_LIMIT_ERROR"
    ]
}

def should_retry(error_code: str, attempt: int) -> bool:
    """
    Determine if error should be retried
    """
    if attempt >= RETRY_CONFIG["max_retries"]:
        return False
    
    if error_code in RETRY_CONFIG["retryable_errors"]:
        return True
    
    return False

def calculate_retry_delay(attempt: int) -> int:
    """
    Calculate delay before retry (exponential backoff)
    """
    delay = RETRY_CONFIG["initial_delay_ms"] * (
        RETRY_CONFIG["backoff_multiplier"] ** attempt
    )
    return min(delay, RETRY_CONFIG["max_delay_ms"])
```

### Timeout Management

```python
TIMEOUT_CONFIG = {
    "default": 30000,           # 30 seconds
    "fast_agent": 10000,        # 10 seconds (for simple queries)
    "complex_agent": 60000,     # 60 seconds (for complex operations)
    "external_api": 15000,      # 15 seconds
    "database_query": 10000     # 10 seconds
}

def get_timeout_for_task(task: str, agent_type: str) -> int:
    """
    Determine appropriate timeout based on task and agent
    """
    # Task-specific timeouts
    if task in ["simple_query", "get_status"]:
        return TIMEOUT_CONFIG["fast_agent"]
    
    if task in ["complex_calculation", "generate_report"]:
        return TIMEOUT_CONFIG["complex_agent"]
    
    # Agent-specific timeouts
    if agent_type == "data_retrieval":
        return TIMEOUT_CONFIG["database_query"]
    
    if agent_type == "external_integration":
        return TIMEOUT_CONFIG["external_api"]
    
    return TIMEOUT_CONFIG["default"]
```

### Fallback Strategies

1. **Cached Data Fallback**: Use previously cached data if available
2. **Alternative Agent Fallback**: Route to backup agent if primary fails
3. **Degraded Mode**: Return partial results if full processing fails
4. **Human Escalation**: Escalate to human agent if all automated options fail

```python
async def handle_with_fallback(
    primary_action: Callable,
    fallback_actions: List[Callable],
    session: Session
):
    """
    Execute primary action with fallback chain
    """
    try:
        return await primary_action()
    except Exception as e:
        logger.log_fallback_triggered(e, session)
        
        for fallback in fallback_actions:
            try:
                result = await fallback(session)
                if result:
                    logger.log_fallback_success(fallback, session)
                    return result
            except Exception as fallback_error:
                logger.log_fallback_failure(fallback, fallback_error, session)
                continue
        
        # All fallbacks exhausted
        return escalate_to_human(session)
```

### Centralized Logging

```python
class CentralLogger:
    def __init__(self, log_level: str = "info"):
        self.log_level = log_level
        self.logs: List[LogEntry] = []
        self.max_logs = 10000  # Keep last 10k logs in memory
    
    def log(self, entry: Dict):
        """
        Log an interaction or event
        """
        log_entry = LogEntry(
            id=generate_log_id(),
            timestamp=current_timestamp(),
            sessionId=entry.get("sessionId"),
            type=entry.get("type"),
            from=entry.get("from"),
            to=entry.get("to"),
            message=entry.get("message"),
            metadata=entry.get("metadata", {})
        )
        
        # Add to in-memory log
        self.logs.append(log_entry)
        
        # Limit log size
        if len(self.logs) > self.max_logs:
            self.logs = self.logs[-self.max_logs:]
        
        # Persist to database if configured
        if self.persistent_storage:
            self.persistent_storage.save_log(log_entry)
        
        # Emit event for real-time monitoring
        self.emit_log_event(log_entry)
    
    def query_logs(
        self,
        session_id: str = None,
        agent_id: str = None,
        start_time: int = None,
        end_time: int = None,
        log_type: str = None
    ) -> List[LogEntry]:
        """
        Query logs with filters
        """
        results = self.logs
        
        if session_id:
            results = [l for l in results if l.sessionId == session_id]
        if agent_id:
            results = [l for l in results if l.from == agent_id or l.to == agent_id]
        if start_time:
            results = [l for l in results if l.timestamp >= start_time]
        if end_time:
            results = [l for l in results if l.timestamp <= end_time]
        if log_type:
            results = [l for l in results if l.type == log_type]
        
        return sorted(results, key=lambda x: x.timestamp)
```

---

## State Management

### Session Structure

```python
class Session:
    def __init__(self, id: str, created_at: int):
        self.id = id
        self.created_at = created_at
        self.updated_at = created_at
        self.expires_at = created_at + SESSION_TIMEOUT
        self.caller_id: Optional[str] = None
        self.current_thread_id: str = generate_thread_id()
        self.history: List[HistoryEntry] = []
        self.context: ConversationContext = ConversationContext(
            threadId=self.current_thread_id,
            sessionId=self.id
        )
        self.metadata: Dict = {
            "userPreferences": {},
            "accessLevel": "standard",
            "language": "en",
            "timezone": "UTC"
        }
        self.pending_requests: Dict[str, PendingRequest] = {}
    
    def is_expired(self) -> bool:
        return current_timestamp() > self.expires_at
    
    def extend(self, duration: int = SESSION_TIMEOUT):
        self.expires_at = current_timestamp() + duration
        self.updated_at = current_timestamp()
    
    def get_recent_history(self, count: int = 5) -> List[HistoryEntry]:
        return self.history[-count:] if len(self.history) > count else self.history
```

### Conversation Context

```python
class ConversationContext:
    def __init__(
        self,
        threadId: str,
        sessionId: str,
        parentMessageId: Optional[str] = None,
        metadata: Optional[Dict] = None
    ):
        self.threadId = threadId
        self.sessionId = sessionId
        self.parentMessageId = parentMessageId
        self.metadata = metadata or {}
        self.history: List[str] = []  # Brief history for context
    
    def add_to_history(self, entry: str):
        self.history.append(entry)
        # Keep last 10 entries
        if len(self.history) > 10:
            self.history = self.history[-10:]
```

### State Persistence Options

1. **Ephemeral (In-Memory)**
   - Fast, no persistence
   - Lost on restart
   - Use for: Development, testing

2. **Session-Based (Temporary Storage)**
   - Persisted for session duration
   - Cleared after session expiry
   - Use for: Production with session management

3. **Long-Term (Database)**
   - Persistent across sessions
   - Enables conversation resumption
   - Use for: Production with user accounts

```python
class PersistentStateManager:
    def __init__(self, database: Database):
        self.db = database
    
    def save_session(self, session: Session):
        """
        Save session to database
        """
        self.db.sessions.upsert({
            "id": session.id,
            "caller_id": session.caller_id,
            "created_at": session.created_at,
            "updated_at": session.updated_at,
            "expires_at": session.expires_at,
            "current_thread_id": session.current_thread_id,
            "history": json.dumps([h.to_dict() for h in session.history]),
            "metadata": json.dumps(session.metadata)
        })
    
    def load_session(self, session_id: str) -> Optional[Session]:
        """
        Load session from database
        """
        record = self.db.sessions.get(session_id)
        if not record:
            return None
        
        session = Session(
            id=record["id"],
            created_at=record["created_at"]
        )
        session.caller_id = record["caller_id"]
        session.current_thread_id = record["current_thread_id"]
        session.history = [HistoryEntry.from_dict(h) for h in json.loads(record["history"])]
        session.metadata = json.loads(record["metadata"])
        
        return session
```

---

## Customization Strategies

### 1. User-Specific Customization

**Personalization Points**:
- Voice settings (speed, tone, language)
- Response style (formal, casual, technical)
- Preferred communication channel
- Access level and permissions
- Historical preferences

**Implementation**:
```python
class UserProfile:
    def __init__(self, user_id: str):
        self.user_id = user_id
        self.preferences = {
            "voice": {
                "speed": 1.0,
                "tone": "professional",
                "language": "en"
            },
            "communication": {
                "style": "concise",
                "detail_level": "standard"
            },
            "access": {
                "level": "standard",
                "permissions": ["view_reservations", "modify_reservations"]
            }
        }
    
    def apply_to_context(self, context: ConversationContext):
        """
        Apply user preferences to conversation context
        """
        context.metadata["userPreferences"] = self.preferences
        context.metadata["accessLevel"] = self.preferences["access"]["level"]
        return context
```

### 2. App Variant Customization

**Configuration Templates**:
```python
APP_VARIANTS = {
    "hospitality": {
        "sub_agents": [
            {
                "id": "reservation_agent",
                "specialty": "reservations",
                "tasks": ["confirm_reservation", "modify_reservation", "cancel_reservation"],
                "business_rules": "hospitality_rules.json"
            },
            {
                "id": "concierge_agent",
                "specialty": "concierge",
                "tasks": ["request_service", "get_recommendations"]
            }
        ],
        "voice_settings": {
            "tone": "welcoming",
            "greeting": "Welcome to our hotel. How can I assist you today?"
        }
    },
    "travel": {
        "sub_agents": [
            {
                "id": "booking_agent",
                "specialty": "bookings",
                "tasks": ["search_flights", "book_flight", "modify_booking"],
                "business_rules": "travel_rules.json"
            },
            {
                "id": "loyalty_agent",
                "specialty": "loyalty_program",
                "tasks": ["check_points", "redeem_points"]
            }
        ],
        "voice_settings": {
            "tone": "efficient",
            "greeting": "Hello, how can I help with your travel today?"
        }
    }
}

def load_app_variant(variant_name: str) -> AppConfig:
    """
    Load configuration for specific app variant
    """
    if variant_name not in APP_VARIANTS:
        raise ValueError(f"Unknown app variant: {variant_name}")
    
    variant_config = APP_VARIANTS[variant_name]
    
    # Load business rules
    business_rules = {}
    for agent_config in variant_config["sub_agents"]:
        if "business_rules" in agent_config:
            business_rules[agent_config["id"]] = load_business_rules(
                agent_config["business_rules"]
            )
    
    return AppConfig(
        variant_name=variant_name,
        sub_agents=variant_config["sub_agents"],
        voice_settings=variant_config["voice_settings"],
        business_rules=business_rules
    )
```

### 3. Dynamic Sub-Agent Configuration

**Module-Based Architecture**:
```python
class SubAgentModule:
    """
    Base class for sub-agent modules
    """
    def __init__(self, config: Dict):
        self.config = config
        self.agent_id = config["id"]
        self.specialty = config["specialty"]
        self.system_prompt = config.get("system_prompt", "")
        self.tools = config.get("tools", [])
    
    async def process_task(self, task: str, parameters: Dict, context: ConversationContext) -> Dict:
        """
        Process a task - to be implemented by subclasses
        """
        raise NotImplementedError
    
    def get_task_schema(self, task: str) -> Dict:
        """
        Get input schema for a task
        """
        return self.config.get("task_schemas", {}).get(task, {})
    
    def get_output_schema(self, task: str) -> Dict:
        """
        Get output schema for a task
        """
        return self.config.get("output_schemas", {}).get(task, {})

class ReservationAgentModule(SubAgentModule):
    """
    Customizable reservation agent module
    """
    def __init__(self, config: Dict):
        super().__init__(config)
        self.business_rules = config.get("business_rules", {})
        self.data_source = config.get("data_source", "default")
    
    async def process_task(self, task: str, parameters: Dict, context: ConversationContext) -> Dict:
        if task == "confirm_reservation":
            return await self.confirm_reservation(parameters, context)
        elif task == "modify_reservation":
            return await self.modify_reservation(parameters, context)
        else:
            raise ValueError(f"Unknown task: {task}")
    
    async def confirm_reservation(self, parameters: Dict, context: ConversationContext) -> Dict:
        # Apply business rules
        validation_rules = self.business_rules.get("reservation_validation", {})
        
        # Check required fields based on business rules
        required_fields = validation_rules.get("required_fields", [])
        missing_fields = [f for f in required_fields if f not in parameters]
        
        if missing_fields:
            return {
                "status": "needs_info",
                "required": [
                    {
                        "field": field,
                        "type": "string",
                        "description": validation_rules.get("field_descriptions", {}).get(field, "")
                    }
                    for field in missing_fields
                ]
            }
        
        # Process reservation confirmation using data source
        reservation_data = await self.data_source.get_reservation(
            parameters["reservation_number"],
            parameters["full_name"]
        )
        
        if not reservation_data:
            return {
                "status": "error",
                "error": {
                    "code": "RESERVATION_NOT_FOUND",
                    "message": "No reservation found with the provided details",
                    "retryable": False
                }
            }
        
        return {
            "status": "success",
            "data": {
                "reservation": reservation_data
            }
        }
```

### 4. Template System

**Template Structure**:
```json
{
  "template_id": "hospitality_reservation_v1",
  "name": "Hospitality Reservation Agent",
  "description": "Template for hotel/resort reservation management",
  "sub_agents": [
    {
      "module": "ReservationAgentModule",
      "config": {
        "specialty": "reservations",
        "business_rules": "hospitality_rules.json",
        "data_source": "hospitality_db"
      }
    }
  ],
  "master_agent_config": {
    "system_prompt": "You are a helpful hotel reservation assistant...",
    "intents": ["confirm_reservation", "modify_reservation", "cancel_reservation"],
    "voice_settings": {
      "tone": "welcoming"
    }
  }
}
```

**Template Application**:
```python
def apply_template(template_id: str, customizations: Dict = None) -> AppConfig:
    """
    Load and apply a template with optional customizations
    """
    template = load_template(template_id)
    
    # Merge customizations
    if customizations:
        template = deep_merge(template, customizations)
    
    # Instantiate sub-agents from template
    sub_agents = []
    for agent_config in template["sub_agents"]:
        module_class = get_module_class(agent_config["module"])
        agent = module_class(agent_config["config"])
        sub_agents.append(agent)
    
    return AppConfig(
        sub_agents=sub_agents,
        master_agent_config=template["master_agent_config"]
    )
```

---

## Example Scenarios

### Scenario 1: Reservation Confirmation (Basic Flow)

**Caller**: "Confirm my reservation"

**Step 1 - Master Agent Processing**:
```json
{
  "input": "Confirm my reservation",
  "intent": "confirm_reservation",
  "extracted_parameters": {}
}
```

**Step 2 - Master to Sub-Agent**:
```json
{
  "task": "confirm_reservation",
  "parameters": {},
  "context": {
    "threadId": "thread_123",
    "sessionId": "session_456",
    "callerId": "user_789"
  },
  "requestId": "req_001"
}
```

**Step 3 - Sub-Agent Response**:
```json
{
  "status": "needs_info",
  "required": [
    {
      "field": "reservation_number",
      "type": "string",
      "description": "Your 6-character reservation code"
    },
    {
      "field": "full_name",
      "type": "string",
      "description": "Full name as it appears on the reservation"
    }
  ],
  "requestId": "req_001"
}
```

**Step 4 - Master to Caller**:
"I'll need a bit more information to confirm your reservation. Can you please provide your reservation number and the full name on the reservation?"

**Step 5 - Caller Response**:
"Sure, it's ABC123 and the name is John Doe"

**Step 6 - Master to Sub-Agent (Updated)**:
```json
{
  "task": "confirm_reservation",
  "parameters": {
    "reservation_number": "ABC123",
    "full_name": "John Doe"
  },
  "context": {
    "threadId": "thread_123",
    "sessionId": "session_456",
    "callerId": "user_789",
    "conversationHistory": [
      {"role": "caller", "content": "Confirm my reservation"},
      {"role": "agent", "content": "I'll need your reservation number and name"},
      {"role": "caller", "content": "ABC123, John Doe"}
    ]
  },
  "requestId": "req_002"
}
```

**Step 7 - Sub-Agent Response (Success)**:
```json
{
  "status": "success",
  "data": {
    "reservation": {
      "number": "ABC123",
      "date": "2025-12-01",
      "status": "confirmed",
      "guest_name": "John Doe",
      "room_type": "Deluxe Suite",
      "check_in": "2025-12-01T15:00:00Z",
      "check_out": "2025-12-05T11:00:00Z"
    }
  },
  "requestId": "req_002"
}
```

**Step 8 - Master to Caller (Final)**:
"Great! I've confirmed your reservation. You have a Deluxe Suite reserved for December 1st through December 5th. Check-in is at 3:00 PM and check-out is at 11:00 AM. Is there anything else I can help you with?"

---

### Scenario 2: Billing Inquiry with Clarification

**Caller**: "What's my bill this month?"

**Step 1 - Master Agent Processing**:
```json
{
  "input": "What's my bill this month?",
  "intent": "get_billing_info",
  "extracted_parameters": {
    "month": "current"  // Needs resolution
  }
}
```

**Step 2 - Master to Sub-Agent**:
```json
{
  "task": "get_billing_info",
  "parameters": {
    "account_id": "acc_456",  // From session context
    "month": "current"
  },
  "context": {...},
  "requestId": "req_003"
}
```

**Step 3 - Sub-Agent Processing**:
- Determines user has multiple accounts
- Needs clarification on which account

**Step 4 - Sub-Agent Response (Clarification)**:
```json
{
  "status": "needs_info",
  "clarification": {
    "question": "Which account would you like to see the bill for?",
    "options": [
      {
        "value": "acc_456",
        "label": "Personal Account (ending in 4567)"
      },
      {
        "value": "acc_789",
        "label": "Business Account (ending in 7890)"
      }
    ],
    "type": "single_choice"
  },
  "requestId": "req_003"
}
```

**Step 5 - Master to Caller**:
"I see you have two accounts. Which one would you like to see the bill for? You have a Personal Account ending in 4567, or a Business Account ending in 7890."

**Step 6 - Caller Response**:
"The personal one"

**Step 7 - Master to Sub-Agent (Updated)**:
```json
{
  "task": "get_billing_info",
  "parameters": {
    "account_id": "acc_456",
    "month": "2025-01"
  },
  "context": {...},
  "requestId": "req_004"
}
```

**Step 8 - Sub-Agent Response (Success)**:
```json
{
  "status": "success",
  "data": {
    "account_id": "acc_456",
    "month": "2025-01",
    "total_amount": 125.50,
    "currency": "USD",
    "items": [
      {"description": "Monthly service fee", "amount": 99.99},
      {"description": "Additional features", "amount": 25.51}
    ],
    "due_date": "2025-02-01",
    "status": "pending"
  },
  "requestId": "req_004"
}
```

**Step 9 - Master to Caller (Final)**:
"Your bill for January 2025 is $125.50. This includes your monthly service fee of $99.99 and additional features totaling $25.51. The payment is due by February 1st. Would you like me to help you make a payment?"

---

### Scenario 3: Error Handling and Fallback

**Caller**: "Cancel my reservation for next week"

**Step 1 - Master Agent Processing**:
```json
{
  "input": "Cancel my reservation for next week",
  "intent": "cancel_reservation",
  "extracted_parameters": {
    "timeframe": "next_week"
  }
}
```

**Step 2 - Master to Sub-Agent**:
```json
{
  "task": "cancel_reservation",
  "parameters": {
    "timeframe": "next_week",
    "user_id": "user_789"
  },
  "context": {...},
  "requestId": "req_005"
}
```

**Step 3 - Sub-Agent Processing**:
- Attempts to connect to external reservation system
- Connection fails (network error)

**Step 4 - Sub-Agent Response (Error)**:
```json
{
  "status": "error",
  "error": {
    "code": "EXTERNAL_API_FAILURE",
    "message": "Could not connect to reservation system",
    "details": {
      "error_type": "NetworkError",
      "retryable": true
    },
    "retryable": true
  },
  "requestId": "req_005"
}
```

**Step 5 - Master Agent Retry Logic**:
- Detects retryable error
- Waits 1 second (exponential backoff)
- Retries request

**Step 6 - Retry Attempt Fails Again**:
```json
{
  "status": "error",
  "error": {
    "code": "EXTERNAL_API_FAILURE",
    "message": "Could not connect to reservation system",
    "retryable": true
  },
  "requestId": "req_005",
  "metadata": {
    "retryCount": 1
  }
}
```

**Step 7 - Master Agent Fallback Strategy**:
- Checks for cached reservation data
- Finds cached data from earlier in session
- Uses cached data to proceed

**Step 8 - Master to Sub-Agent (Fallback)**:
```json
{
  "task": "cancel_reservation",
  "parameters": {
    "reservation_number": "ABC123",  // From cache
    "full_name": "John Doe"          // From cache
  },
  "context": {...},
  "requestId": "req_006"
}
```

**Step 9 - Sub-Agent Response (Success with Cache)**:
```json
{
  "status": "success",
  "data": {
    "reservation": {
      "number": "ABC123",
      "status": "cancelled",
      "cancellation_fee": 25.00,
      "refund_amount": 475.00
    }
  },
  "metadata": {
    "source": "cached_data",
    "note": "Used cached data due to external system unavailability"
  },
  "requestId": "req_006"
}
```

**Step 10 - Master to Caller (Final)**:
"I've cancelled your reservation ABC123 for next week. There's a cancellation fee of $25.00, and you'll receive a refund of $475.00. The refund will be processed within 5-7 business days. Is there anything else I can help you with?"

---

## Testing and Best Practices

### Testing Strategy

#### 1. Unit Tests

**Test Individual Components**:
```python
def test_sub_agent_input_validation():
    """
    Test that sub-agent correctly validates input
    """
    agent = ReservationAgentModule(config)
    
    # Valid input
    valid_input = {
        "task": "confirm_reservation",
        "parameters": {
            "reservation_number": "ABC123",
            "full_name": "John Doe"
        }
    }
    result = agent.validate_input(valid_input)
    assert result.is_valid == True
    
    # Invalid input (missing required field)
    invalid_input = {
        "task": "confirm_reservation",
        "parameters": {
            "reservation_number": "ABC123"
            # Missing full_name
        }
    }
    result = agent.validate_input(invalid_input)
    assert result.is_valid == False
    assert "full_name" in result.missing_fields

def test_retry_logic():
    """
    Test retry logic with exponential backoff
    """
    attempt = 0
    delay = calculate_retry_delay(attempt)
    assert delay == 1000  # Initial delay
    
    attempt = 1
    delay = calculate_retry_delay(attempt)
    assert delay == 2000  # 2x initial delay
    
    attempt = 2
    delay = calculate_retry_delay(attempt)
    assert delay == 4000  # 4x initial delay
```

#### 2. Integration Tests

**Test Agent-to-Agent Communication**:
```python
async def test_master_sub_agent_communication():
    """
    Test full communication flow between master and sub-agent
    """
    # Setup
    master_agent = MasterAgent(config)
    sub_agent = ReservationAgentModule(config)
    comm_manager = CommunicationManager()
    
    # Register agents
    comm_manager.register_agent("master", master_agent.handle_message)
    comm_manager.register_agent("reservation", sub_agent.handle_message)
    
    # Send request
    message = create_message(
        from="master",
        to="reservation",
        type="REQUEST",
        content={
            "task": "confirm_reservation",
            "parameters": {
                "reservation_number": "ABC123",
                "full_name": "John Doe"
            }
        },
        context=create_context()
    )
    
    # Wait for response
    response = await comm_manager.send_and_wait(message, timeout=10000)
    
    # Assertions
    assert response["status"] == "success"
    assert "reservation" in response["data"]
    assert response["data"]["reservation"]["number"] == "ABC123"
```

#### 3. End-to-End Tests

**Test Complete User Flows**:
```python
async def test_reservation_confirmation_flow():
    """
    Test complete flow from caller input to final response
    """
    # Simulate caller input
    caller_input = "Confirm my reservation"
    
    # Process through master agent
    response = await master_agent.process_caller_input(
        caller_input,
        session_id="test_session_001"
    )
    
    # First response should request information
    assert "reservation number" in response.lower()
    assert "full name" in response.lower()
    
    # Provide information
    caller_input_2 = "ABC123, John Doe"
    response_2 = await master_agent.process_caller_input(
        caller_input_2,
        session_id="test_session_001"
    )
    
    # Final response should confirm reservation
    assert "confirmed" in response_2.lower()
    assert "ABC123" in response_2
```

#### 4. Error Scenario Tests

**Test Error Handling**:
```python
async def test_timeout_handling():
    """
    Test that timeouts are handled gracefully
    """
    # Create slow sub-agent (simulates timeout)
    slow_agent = SlowSubAgent(delay=40000)  # 40 second delay
    
    comm_manager.register_agent("slow", slow_agent.handle_message)
    
    message = create_message(
        from="master",
        to="slow",
        type="REQUEST",
        content={"task": "slow_task"},
        context=create_context()
    )
    
    # Should timeout after 30 seconds
    with pytest.raises(TimeoutError):
        await comm_manager.send_and_wait(message, timeout=30000)

async def test_retry_on_failure():
    """
    Test that retries work correctly
    """
    # Create flaky agent (fails first 2 times, succeeds on 3rd)
    flaky_agent = FlakySubAgent(fail_count=2)
    
    comm_manager.register_agent("flaky", flaky_agent.handle_message)
    
    message = create_message(
        from="master",
        to="flaky",
        type="REQUEST",
        content={"task": "flaky_task"},
        context=create_context()
    )
    
    # Should succeed after retries
    response = await send_with_retry(message, max_retries=3)
    assert response["status"] == "success"
```

### Best Practices

#### 1. Input Validation

- **Always validate inputs** before processing
- **Use schema validation** (JSON Schema, Pydantic, etc.)
- **Sanitize user inputs** to prevent injection attacks
- **Provide clear error messages** for validation failures

#### 2. Error Handling

- **Categorize errors** (retryable vs. non-retryable)
- **Implement exponential backoff** for retries
- **Set appropriate timeouts** for different operations
- **Log all errors** with sufficient context
- **Provide fallback strategies** for critical failures

#### 3. Logging

- **Log all interactions** (caller-agent, agent-agent)
- **Include timestamps** and unique identifiers
- **Use structured logging** (JSON format)
- **Set appropriate log levels** (debug, info, warn, error)
- **Rotate logs** to prevent disk space issues

#### 4. State Management

- **Keep agents stateless** where possible
- **Centralize state management** in State Manager
- **Set appropriate session timeouts**
- **Limit conversation history** size
- **Persist critical state** for resumption

#### 5. Performance

- **Use connection pooling** for external systems
- **Implement caching** for frequently accessed data
- **Set appropriate timeouts** to prevent hanging
- **Monitor performance metrics** (latency, throughput)
- **Optimize database queries** if using persistent storage

#### 6. Security

- **Validate all inputs** to prevent injection
- **Sanitize outputs** before returning to callers
- **Implement authentication** for sensitive operations
- **Use HTTPS** for all external communications
- **Encrypt sensitive data** in logs and storage

#### 7. Monitoring and Observability

- **Track key metrics**:
  - Request latency
  - Success/failure rates
  - Retry counts
  - Timeout occurrences
  - Active sessions
- **Set up alerts** for error rates, timeouts
- **Monitor resource usage** (CPU, memory, network)
- **Track conversation quality** metrics

### Edge Cases to Handle

1. **Concurrent Requests**: Same user making multiple simultaneous requests
2. **Session Expiration**: User returns after session expired
3. **Partial Failures**: Some sub-agents succeed, others fail
4. **Circular Dependencies**: Sub-agents calling each other in loops
5. **Very Long Conversations**: History size management
6. **Unicode and Special Characters**: Proper encoding/decoding
7. **Large Payloads**: Handling large data in messages
8. **Network Partitions**: System continues operating with degraded functionality
9. **Rate Limiting**: Handling external API rate limits
10. **Data Consistency**: Ensuring data consistency across agents

---

## Conclusion

This architecture provides a robust, scalable, and maintainable foundation for building conversational AI systems with multi-agent coordination. Key strengths include:

- **Clear separation of concerns** between master and sub-agents
- **Structured communication** protocols for reliability
- **Comprehensive error handling** with retries and fallbacks
- **Flexible customization** for different users and use cases
- **Observable system** with detailed logging and monitoring
- **Extensible design** for adding new agents and capabilities

The architecture can be implemented using frameworks like:
- **LangChain** for agent orchestration and tool integration
- **AutoGen** for multi-agent conversation management
- **FastAPI** for API endpoints
- **Redis** for session management and caching
- **PostgreSQL** for persistent state storage

---

**Document Version**: 1.0  
**Last Updated**: 2025-01-27  
**Author**: AI System Architect

