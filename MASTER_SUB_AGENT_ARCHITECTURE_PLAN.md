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

### Scenario 4: Multi-Step Task with Multiple Sub-Agents

**Caller**: "I want to book a room for next weekend, but I need to check my loyalty points first"

**Step 1 - Master Agent Processing**:
- Recognizes two intents: "check_loyalty_points" and "book_room"
- Determines sequential execution needed

**Step 2 - Master to Loyalty Sub-Agent**:
```json
{
  "task": "check_loyalty_points",
  "parameters": {
    "user_id": "user_789"
  },
  "context": {...},
  "requestId": "req_007"
}
```

**Step 3 - Loyalty Sub-Agent Response**:
```json
{
  "status": "success",
  "data": {
    "points": 5000,
    "tier": "gold",
    "points_value_usd": 50.00,
    "expiration_date": "2025-12-31"
  },
  "requestId": "req_007"
}
```

**Step 4 - Master to Caller (Intermediate)**:
"You have 5,000 loyalty points worth $50.00. Your points expire on December 31st, 2025. Now, let me help you book a room for next weekend. What dates are you looking for?"

**Step 5 - Caller Response**:
"December 6th to 8th, and I'd like to use my points"

**Step 6 - Master to Reservation Sub-Agent**:
```json
{
  "task": "book_room",
  "parameters": {
    "check_in": "2025-12-06",
    "check_out": "2025-12-08",
    "user_id": "user_789",
    "use_loyalty_points": true,
    "available_points": 5000
  },
  "context": {
    "previousTaskResults": {
      "loyalty_points": {
        "points": 5000,
        "value_usd": 50.00
      }
    }
  },
  "requestId": "req_008"
}
```

**Step 7 - Reservation Sub-Agent Response**:
```json
{
  "status": "success",
  "data": {
    "reservation": {
      "number": "XYZ789",
      "check_in": "2025-12-06",
      "check_out": "2025-12-08",
      "room_type": "Standard Room",
      "total_cost": 200.00,
      "points_used": 5000,
      "points_discount": 50.00,
      "final_cost": 150.00,
      "payment_method": "credit_card"
    }
  },
  "requestId": "req_008"
}
```

**Step 8 - Master to Caller (Final)**:
"Perfect! I've booked a Standard Room for December 6th through 8th. I've applied your 5,000 loyalty points, which gives you a $50.00 discount. Your total is $150.00. Your reservation number is XYZ789. Would you like me to send a confirmation email?"

---

### Scenario 5: Session Resumption After Disconnection

**Context**: User was in the middle of a conversation, connection dropped, user reconnects

**Step 1 - User Reconnects**:
- System detects returning session ID
- Master agent retrieves session state

**Step 2 - Master Agent State Retrieval**:
```json
{
  "sessionId": "session_456",
  "lastActivity": 1234567890000,
  "conversationHistory": [
    {"role": "caller", "content": "I want to modify my reservation"},
    {"role": "agent", "content": "Which reservation would you like to modify?"},
    {"role": "caller", "content": "The one for December 1st"}
  ],
  "pendingAction": {
    "task": "modify_reservation",
    "status": "awaiting_confirmation",
    "parameters": {
      "reservation_number": "ABC123",
      "modification_type": "date_change"
    }
  }
}
```

**Step 3 - Master to Caller (Resumption)**:
"Welcome back! I see you were in the process of modifying your reservation for December 1st. Would you like to continue with that, or is there something else I can help you with?"

**Step 4 - Caller Response**:
"Yes, let's continue. I want to change it to December 15th"

**Step 5 - Master to Sub-Agent (With Full Context)**:
```json
{
  "task": "modify_reservation",
  "parameters": {
    "reservation_number": "ABC123",
    "new_check_in": "2025-12-15",
    "new_check_out": "2025-12-19"
  },
  "context": {
    "threadId": "thread_123",
    "sessionId": "session_456",
    "resumedSession": true,
    "conversationHistory": [...previous history...]
  },
  "requestId": "req_009"
}
```

**Step 6 - Sub-Agent Response**:
```json
{
  "status": "success",
  "data": {
    "reservation": {
      "number": "ABC123",
      "old_dates": {"check_in": "2025-12-01", "check_out": "2025-12-05"},
      "new_dates": {"check_in": "2025-12-15", "check_out": "2025-12-19"},
      "status": "modified",
      "change_fee": 0.00
    }
  },
  "requestId": "req_009"
}
```

**Step 7 - Master to Caller (Final)**:
"Great! I've successfully changed your reservation dates from December 1st-5th to December 15th-19th. There's no change fee for this modification. Your updated reservation number is still ABC123. Is there anything else?"

---

### Scenario 6: Complex Query Requiring Multiple Sub-Agents

**Caller**: "I need to know if I can get a refund for my cancelled flight and how much it will cost to rebook"

**Step 1 - Master Agent Processing**:
- Identifies two related tasks: "check_refund_eligibility" and "get_rebooking_cost"
- Determines parallel execution possible

**Step 2 - Master to Refund Sub-Agent**:
```json
{
  "task": "check_refund_eligibility",
  "parameters": {
    "booking_number": "FLT123",
    "user_id": "user_789",
    "cancellation_date": "2025-01-15"
  },
  "context": {...},
  "requestId": "req_010"
}
```

**Step 3 - Master to Pricing Sub-Agent (Parallel)**:
```json
{
  "task": "get_rebooking_cost",
  "parameters": {
    "original_route": {"from": "NYC", "to": "LAX"},
    "original_date": "2025-01-20",
    "new_date": "2025-01-25"
  },
  "context": {...},
  "requestId": "req_011"
}
```

**Step 4 - Refund Sub-Agent Response**:
```json
{
  "status": "success",
  "data": {
    "eligible": true,
    "refund_amount": 350.00,
    "refund_type": "partial",
    "processing_time": "7-10 business days",
    "reason": "Cancelled within 24 hours of booking"
  },
  "requestId": "req_010"
}
```

**Step 5 - Pricing Sub-Agent Response**:
```json
{
  "status": "success",
  "data": {
    "rebooking_cost": 425.00,
    "price_difference": 75.00,
    "available_flights": [
      {"flight": "AA123", "departure": "2025-01-25T08:00", "price": 425.00},
      {"flight": "AA456", "departure": "2025-01-25T14:00", "price": 450.00}
    ]
  },
  "requestId": "req_011"
}
```

**Step 6 - Master Agent Aggregation**:
- Combines results from both sub-agents
- Calculates net cost: $425.00 (rebooking) - $350.00 (refund) = $75.00 additional

**Step 7 - Master to Caller (Final)**:
"Good news! You're eligible for a partial refund of $350.00, which will be processed within 7-10 business days. For rebooking on January 25th, the cost would be $425.00. After your refund, you'd pay an additional $75.00. I have two flight options available: one at 8:00 AM for $425.00, or one at 2:00 PM for $450.00. Would you like to proceed with the rebooking?"

---

### Scenario 7: Error Recovery with Alternative Path

**Caller**: "Show me my order history"

**Step 1 - Master to Order Sub-Agent**:
```json
{
  "task": "get_order_history",
  "parameters": {
    "user_id": "user_789",
    "limit": 10
  },
  "context": {...},
  "requestId": "req_012"
}
```

**Step 2 - Order Sub-Agent Attempts Database Query**:
- Primary database connection fails
- Sub-agent attempts retry (fails again)

**Step 3 - Order Sub-Agent Response (Error)**:
```json
{
  "status": "error",
  "error": {
    "code": "DATABASE_ERROR",
    "message": "Unable to connect to primary database",
    "details": {
      "error_type": "ConnectionTimeout",
      "retryable": true,
      "suggested_fallback": "cache_or_secondary_db"
    },
    "retryable": true
  },
  "requestId": "req_012"
}
```

**Step 4 - Master Agent Fallback Strategy**:
- Detects database error
- Checks for cached order data in session
- Finds partial cache from earlier interaction
- Routes to backup data source

**Step 5 - Master to Order Sub-Agent (Fallback)**:
```json
{
  "task": "get_order_history",
  "parameters": {
    "user_id": "user_789",
    "limit": 10,
    "use_cache": true,
    "fallback_source": "secondary_db"
  },
  "context": {...},
  "requestId": "req_013"
}
```

**Step 6 - Order Sub-Agent Response (Partial Success)**:
```json
{
  "status": "partial",
  "data": {
    "orders": [
      {"id": "ORD001", "date": "2025-01-10", "total": 99.99},
      {"id": "ORD002", "date": "2025-01-05", "total": 149.50}
    ],
    "total_count": 2,
    "note": "Showing cached data. Some recent orders may not be visible."
  },
  "metadata": {
    "source": "cache",
    "data_freshness": "5 minutes old"
  },
  "requestId": "req_013"
}
```

**Step 7 - Master to Caller (With Transparency)**:
"I'm showing you your recent orders from our cached data. You have 2 orders: Order ORD001 from January 10th for $99.99, and Order ORD002 from January 5th for $149.50. Note that this information is about 5 minutes old, so any very recent orders might not appear yet. Would you like me to try refreshing this information, or can I help you with something specific about these orders?"

---

## Configuration Templates

### Template 1: Hospitality/Hotel Management

**Use Case**: Hotel reservation and concierge services

**Configuration**:
```json
{
  "template_id": "hospitality_hotel_v1",
  "name": "Hotel Management System",
  "description": "Complete hotel reservation and concierge management",
  "version": "1.0",
  
  "master_agent": {
    "agent_id": "hotel_master",
    "system_prompt": "You are a friendly and professional hotel concierge. You help guests with reservations, modifications, cancellations, and general inquiries. Always be courteous and helpful.",
    "voice_settings": {
      "speed": 1.0,
      "tone": "welcoming",
      "language": "en",
      "interruptible": true
    },
    "intents": [
      "book_room",
      "modify_reservation",
      "cancel_reservation",
      "confirm_reservation",
      "check_in",
      "check_out",
      "request_service",
      "get_recommendations"
    ],
    "guardrails": {
      "banned_phrases": [],
      "fallback_response": "I apologize, but I'm having trouble understanding. Could you please rephrase that?"
    }
  },
  
  "sub_agents": [
    {
      "agent_id": "reservation_agent",
      "specialty": "reservations",
      "system_prompt": "You are a reservation specialist. You handle booking, modification, and cancellation of hotel reservations. Always verify guest information and confirm all details.",
      "model": "pro",
      "tasks": [
        "book_room",
        "modify_reservation",
        "cancel_reservation",
        "confirm_reservation",
        "check_availability"
      ],
      "tools": ["reservation_database", "availability_checker", "pricing_engine"],
      "business_rules": {
        "cancellation_policy": {
          "free_cancellation_hours": 48,
          "partial_refund_hours": 24,
          "no_refund_hours": 0
        },
        "modification_policy": {
          "free_modification_hours": 72,
          "change_fee": 25.00
        }
      },
      "bidirectional_enabled": true,
      "max_conversation_depth": 3
    },
    {
      "agent_id": "concierge_agent",
      "specialty": "concierge",
      "system_prompt": "You are a hotel concierge. You help guests with local recommendations, service requests, and general inquiries about the hotel and area.",
      "model": "flash",
      "tasks": [
        "request_service",
        "get_recommendations",
        "get_local_info",
        "schedule_service"
      ],
      "tools": ["local_database", "service_scheduler", "recommendation_engine"],
      "bidirectional_enabled": true
    },
    {
      "agent_id": "loyalty_agent",
      "specialty": "loyalty_program",
      "system_prompt": "You manage the hotel loyalty program. You check points, process redemptions, and explain benefits.",
      "model": "flash",
      "tasks": [
        "check_loyalty_points",
        "redeem_points",
        "check_tier_status",
        "explain_benefits"
      ],
      "tools": ["loyalty_database", "points_calculator"]
    }
  ],
  
  "communication_config": {
    "timeout": {
      "sub_agent_loop": 30000,
      "tool_execution": 10000
    },
    "retry": {
      "enabled": true,
      "max_retries": 2,
      "initial_delay": 1000,
      "max_delay": 5000
    }
  },
  
  "state_management": {
    "storage_type": "session",
    "session_timeout": 3600000,
    "max_history_size": 20
  }
}
```

### Template 2: Travel/Airline Management

**Use Case**: Flight booking and travel services

**Configuration**:
```json
{
  "template_id": "travel_airline_v1",
  "name": "Airline Booking System",
  "description": "Flight booking, modifications, and travel services",
  "version": "1.0",
  
  "master_agent": {
    "agent_id": "airline_master",
    "system_prompt": "You are an efficient airline booking assistant. You help customers book flights, manage reservations, check flight status, and handle travel-related inquiries. Be clear and concise.",
    "voice_settings": {
      "speed": 1.1,
      "tone": "efficient",
      "language": "en"
    },
    "intents": [
      "search_flights",
      "book_flight",
      "modify_booking",
      "cancel_booking",
      "check_in",
      "get_flight_status",
      "request_assistance",
      "upgrade_seat"
    ]
  },
  
  "sub_agents": [
    {
      "agent_id": "booking_agent",
      "specialty": "flight_booking",
      "system_prompt": "You handle flight searches, bookings, and modifications. Always verify travel dates, passenger information, and preferences.",
      "model": "pro",
      "tasks": [
        "search_flights",
        "book_flight",
        "modify_booking",
        "cancel_booking",
        "get_booking_details"
      ],
      "tools": ["flight_search_api", "booking_system", "seat_map"],
      "business_rules": {
        "booking_policy": {
          "hold_time_minutes": 15,
          "payment_required": true
        },
        "cancellation_policy": {
          "refundable_ticket_hours": 24,
          "non_refundable_fee": 200.00
        }
      }
    },
    {
      "agent_id": "flight_status_agent",
      "specialty": "flight_information",
      "system_prompt": "You provide real-time flight status information, gate changes, and delay notifications.",
      "model": "flash",
      "tasks": [
        "get_flight_status",
        "check_delays",
        "get_gate_info"
      ],
      "tools": ["flight_status_api", "airport_database"]
    },
    {
      "agent_id": "loyalty_agent",
      "specialty": "frequent_flyer",
      "system_prompt": "You manage frequent flyer accounts, miles, and upgrades.",
      "model": "flash",
      "tasks": [
        "check_miles",
        "redeem_miles",
        "request_upgrade",
        "check_elite_status"
      ],
      "tools": ["loyalty_database", "upgrade_engine"]
    }
  ],
  
  "communication_config": {
    "timeout": {
      "sub_agent_loop": 45000,
      "tool_execution": 15000
    },
    "retry": {
      "enabled": true,
      "max_retries": 3,
      "initial_delay": 2000
    }
  }
}
```

### Template 3: E-Commerce Customer Service

**Use Case**: Online shopping support and order management

**Configuration**:
```json
{
  "template_id": "ecommerce_support_v1",
  "name": "E-Commerce Customer Service",
  "description": "Order management, product inquiries, and customer support",
  "version": "1.0",
  
  "master_agent": {
    "agent_id": "ecommerce_master",
    "system_prompt": "You are a helpful e-commerce customer service representative. You assist customers with orders, products, returns, and general inquiries. Be friendly and solution-oriented.",
    "voice_settings": {
      "speed": 1.0,
      "tone": "friendly",
      "language": "en"
    },
    "intents": [
      "track_order",
      "check_order_status",
      "return_item",
      "get_product_info",
      "process_refund",
      "update_shipping",
      "apply_promo_code",
      "get_recommendations"
    ]
  },
  
  "sub_agents": [
    {
      "agent_id": "order_agent",
      "specialty": "order_management",
      "system_prompt": "You handle order inquiries, tracking, and status updates. Always provide accurate shipping information and delivery estimates.",
      "model": "pro",
      "tasks": [
        "track_order",
        "check_order_status",
        "get_order_history",
        "update_shipping_address",
        "cancel_order"
      ],
      "tools": ["order_database", "shipping_api", "inventory_system"],
      "business_rules": {
        "return_policy": {
          "return_window_days": 30,
          "free_return_threshold": 50.00
        }
      }
    },
    {
      "agent_id": "product_agent",
      "specialty": "product_information",
      "system_prompt": "You provide detailed product information, availability, and recommendations.",
      "model": "flash",
      "tasks": [
        "get_product_info",
        "check_availability",
        "get_recommendations",
        "compare_products"
      ],
      "tools": ["product_catalog", "inventory_api", "recommendation_engine"]
    },
    {
      "agent_id": "returns_agent",
      "specialty": "returns_refunds",
      "system_prompt": "You process returns, refunds, and exchanges. Always verify return eligibility and explain the process clearly.",
      "model": "pro",
      "tasks": [
        "return_item",
        "process_refund",
        "initiate_exchange",
        "check_return_status"
      ],
      "tools": ["returns_system", "payment_processor", "inventory_system"]
    }
  ]
}
```

### Template 4: Healthcare Appointment System

**Use Case**: Medical appointment scheduling and patient inquiries

**Configuration**:
```json
{
  "template_id": "healthcare_appointments_v1",
  "name": "Healthcare Appointment System",
  "description": "Medical appointment scheduling and patient information",
  "version": "1.0",
  
  "master_agent": {
    "agent_id": "healthcare_master",
    "system_prompt": "You are a professional medical appointment scheduler. You help patients schedule, modify, and cancel appointments. Always maintain patient privacy and be empathetic.",
    "voice_settings": {
      "speed": 0.9,
      "tone": "professional_caring",
      "language": "en"
    },
    "intents": [
      "schedule_appointment",
      "modify_appointment",
      "cancel_appointment",
      "check_appointment",
      "get_doctor_info",
      "request_prescription_refill"
    ],
    "guardrails": {
      "banned_phrases": [],
      "privacy_required": true,
      "hipaa_compliant": true
    }
  },
  
  "sub_agents": [
    {
      "agent_id": "appointment_agent",
      "specialty": "appointment_scheduling",
      "system_prompt": "You schedule medical appointments. Verify patient information, preferred dates, and reason for visit. Always confirm appointment details.",
      "model": "pro",
      "tasks": [
        "schedule_appointment",
        "modify_appointment",
        "cancel_appointment",
        "check_appointment",
        "get_availability"
      ],
      "tools": ["appointment_system", "doctor_schedule", "patient_database"],
      "business_rules": {
        "cancellation_policy": {
          "advance_notice_hours": 24,
          "late_cancellation_fee": 25.00
        },
        "appointment_types": [
          "general_checkup",
          "specialist_consultation",
          "follow_up",
          "urgent_care"
        ]
      },
      "bidirectional_enabled": true
    },
    {
      "agent_id": "patient_info_agent",
      "specialty": "patient_information",
      "system_prompt": "You provide general patient information while maintaining HIPAA compliance. Only share information the patient is authorized to access.",
      "model": "flash",
      "tasks": [
        "get_doctor_info",
        "get_facility_info",
        "check_insurance",
        "get_directions"
      ],
      "tools": ["doctor_directory", "facility_database", "insurance_verifier"],
      "privacy_level": "high"
    }
  ],
  
  "state_management": {
    "storage_type": "long_term",
    "encryption_required": true,
    "hipaa_compliant": true
  }
}
```

### Template 5: Financial Services Support

**Use Case**: Banking and financial account inquiries

**Configuration**:
```json
{
  "template_id": "financial_services_v1",
  "name": "Financial Services Support",
  "description": "Banking account management and financial inquiries",
  "version": "1.0",
  
  "master_agent": {
    "agent_id": "financial_master",
    "system_prompt": "You are a secure banking assistant. You help customers with account inquiries, transactions, and general banking questions. Always verify identity and maintain security.",
    "voice_settings": {
      "speed": 1.0,
      "tone": "professional_secure",
      "language": "en"
    },
    "intents": [
      "check_balance",
      "get_transaction_history",
      "transfer_funds",
      "pay_bill",
      "get_account_info",
      "report_fraud"
    ],
    "guardrails": {
      "security_required": true,
      "authentication_required": true,
      "pci_compliant": true
    }
  },
  
  "sub_agents": [
    {
      "agent_id": "account_agent",
      "specialty": "account_management",
      "system_prompt": "You handle account inquiries and balance checks. Always verify customer identity before providing sensitive information.",
      "model": "pro",
      "tasks": [
        "check_balance",
        "get_account_info",
        "get_transaction_history",
        "get_statement"
      ],
      "tools": ["account_database", "transaction_api"],
      "security_level": "high",
      "authentication_required": true
    },
    {
      "agent_id": "transaction_agent",
      "specialty": "transactions",
      "system_prompt": "You process financial transactions including transfers and bill payments. Always confirm transaction details and require authorization.",
      "model": "pro",
      "tasks": [
        "transfer_funds",
        "pay_bill",
        "schedule_payment",
        "cancel_transaction"
      ],
      "tools": ["payment_processor", "transfer_system", "bill_pay_api"],
      "security_level": "critical",
      "requires_confirmation": true
    },
    {
      "agent_id": "security_agent",
      "specialty": "security_fraud",
      "system_prompt": "You handle security concerns and fraud reports. Escalate immediately for suspicious activity.",
      "model": "pro",
      "tasks": [
        "report_fraud",
        "freeze_account",
        "report_suspicious_activity",
        "update_security_settings"
      ],
      "tools": ["fraud_detection", "security_system"],
      "security_level": "critical",
      "escalation_required": true
    }
  ],
  
  "state_management": {
    "storage_type": "long_term",
    "encryption_required": true,
    "audit_logging": true
  }
}
```

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

## Implementation Todo List

### Phase 1: Foundation & Core Infrastructure (Weeks 1-2)

#### 1.1 Project Setup
- [ ] Initialize project structure (TypeScript/React or Python)
- [ ] Set up development environment and dependencies
- [ ] Configure build tools and testing framework
- [ ] Set up version control and branching strategy
- [ ] Create initial project documentation structure

#### 1.2 Core Type Definitions
- [ ] Define `AgentMessage` interface with all required fields
- [ ] Define `ConversationContext` interface
- [ ] Define `ConversationThread` interface
- [ ] Define `CommunicationEvent` interface
- [ ] Define input/output schemas for master-sub-agent communication
- [ ] Define error response structures
- [ ] Create TypeScript types file (or Python dataclasses)

#### 1.3 Communication Protocols
- [ ] Implement `MessageType` enum (INFORM, QUERY, REQUEST, CONFIRM, CLARIFY)
- [ ] Implement `validateProtocol()` function
- [ ] Implement `createMessage()` function
- [ ] Implement `createResponse()` function
- [ ] Implement `createClarification()` function
- [ ] Implement `MessageRouter` class
- [ ] Write unit tests for protocol functions

#### 1.4 Communication Manager
- [ ] Implement `CommunicationManager` class
- [ ] Implement message queue with priority sorting
- [ ] Implement pending request tracking
- [ ] Implement conversation thread management
- [ ] Implement `sendMessage()` method (fire-and-forget)
- [ ] Implement `sendAndWait()` method (request-response)
- [ ] Implement `handleResponse()` method
- [ ] Implement retry logic with exponential backoff
- [ ] Implement timeout handling
- [ ] Implement event emission system
- [ ] Write unit tests for CommunicationManager

### Phase 2: State Management & Logging (Weeks 3-4)

#### 2.1 State Manager
- [ ] Implement `Session` class
- [ ] Implement `ConversationContext` class
- [ ] Implement `StateManager` class
- [ ] Implement session creation and retrieval
- [ ] Implement session expiration handling
- [ ] Implement conversation history management
- [ ] Implement history size limiting
- [ ] Implement ephemeral storage (in-memory)
- [ ] Implement session-based storage
- [ ] Implement long-term storage interface (database)
- [ ] Write unit tests for StateManager

#### 2.2 Logger
- [ ] Implement `LogEntry` interface/class
- [ ] Implement `CentralLogger` class
- [ ] Implement log entry creation
- [ ] Implement log querying with filters
- [ ] Implement log level management (debug, info, warn, error)
- [ ] Implement in-memory log storage with size limits
- [ ] Implement persistent log storage interface
- [ ] Implement log export functionality
- [ ] Write unit tests for Logger

#### 2.3 Validator
- [ ] Implement input validation functions
- [ ] Implement output validation functions
- [ ] Implement schema validation (JSON Schema or Pydantic)
- [ ] Implement data type checking
- [ ] Implement constraint validation
- [ ] Implement input sanitization
- [ ] Write unit tests for Validator

### Phase 3: Master Agent Implementation (Weeks 5-6)

#### 3.1 Master Agent Core
- [ ] Implement `MasterAgent` class
- [ ] Implement caller input parsing
- [ ] Implement intent recognition
- [ ] Implement sub-agent routing logic
- [ ] Implement structured input building
- [ ] Implement response formatting for callers
- [ ] Implement error message formatting
- [ ] Implement clarification question formatting
- [ ] Write unit tests for MasterAgent

#### 3.2 Master Agent Features
- [ ] Implement conversation flow management
- [ ] Implement greeting handling
- [ ] Implement context maintenance
- [ ] Implement session resumption
- [ ] Implement guardrails and safety filters
- [ ] Implement voice settings application
- [ ] Implement user preference application
- [ ] Write integration tests for MasterAgent

#### 3.3 Intent Recognition
- [ ] Implement intent extraction from natural language
- [ ] Implement parameter extraction
- [ ] Implement context-aware intent resolution
- [ ] Implement intent-to-agent mapping
- [ ] Write unit tests for intent recognition

### Phase 4: Sub-Agent Implementation (Weeks 7-8)

#### 4.1 Sub-Agent Base
- [ ] Implement `SubAgentModule` base class
- [ ] Implement task processing interface
- [ ] Implement input validation
- [ ] Implement output validation
- [ ] Implement error handling
- [ ] Implement bidirectional communication support
- [ ] Write unit tests for SubAgentModule

#### 4.2 Sub-Agent Types
- [ ] Implement `ReservationAgentModule` (example)
- [ ] Implement `BillingAgentModule` (example)
- [ ] Implement `SupportAgentModule` (example)
- [ ] Implement data retrieval agent pattern
- [ ] Implement action agent pattern
- [ ] Implement validation agent pattern
- [ ] Implement calculation agent pattern
- [ ] Write unit tests for each agent type

#### 4.3 Sub-Agent Features
- [ ] Implement business rules application
- [ ] Implement external system integration
- [ ] Implement clarification request generation
- [ ] Implement missing data detection
- [ ] Implement retry logic for external calls
- [ ] Write integration tests for Sub-Agents

### Phase 5: Error Handling & Reliability (Weeks 9-10)

#### 5.1 Error Categories
- [ ] Implement error code definitions
- [ ] Implement error categorization (retryable vs non-retryable)
- [ ] Implement error response formatting
- [ ] Implement user-friendly error messages
- [ ] Write unit tests for error handling

#### 5.2 Retry Logic
- [ ] Implement retry configuration
- [ ] Implement exponential backoff calculation
- [ ] Implement retry decision logic
- [ ] Implement retry tracking
- [ ] Implement max retry limits
- [ ] Write unit tests for retry logic

#### 5.3 Timeout Management
- [ ] Implement timeout configuration
- [ ] Implement task-specific timeouts
- [ ] Implement agent-specific timeouts
- [ ] Implement timeout handling
- [ ] Implement timeout error responses
- [ ] Write unit tests for timeout handling

#### 5.4 Fallback Strategies
- [ ] Implement cached data fallback
- [ ] Implement alternative agent fallback
- [ ] Implement degraded mode
- [ ] Implement human escalation
- [ ] Implement fallback chain execution
- [ ] Write integration tests for fallback strategies

### Phase 6: Customization & Configuration (Weeks 11-12)

#### 6.1 User Customization
- [ ] Implement `UserProfile` class
- [ ] Implement preference storage and retrieval
- [ ] Implement preference application to context
- [ ] Implement access level management
- [ ] Implement language preference handling
- [ ] Write unit tests for UserProfile

#### 6.2 App Variant System
- [ ] Implement app variant configuration structure
- [ ] Implement variant loading
- [ ] Implement variant validation
- [ ] Implement template system
- [ ] Implement template application
- [ ] Implement template customization
- [ ] Write unit tests for variant system

#### 6.3 Configuration Templates
- [ ] Create hospitality/hotel template
- [ ] Create travel/airline template
- [ ] Create e-commerce template
- [ ] Create healthcare template
- [ ] Create financial services template
- [ ] Validate all templates
- [ ] Document template usage

#### 6.4 Dynamic Agent Configuration
- [ ] Implement agent module loading
- [ ] Implement agent registration system
- [ ] Implement agent discovery
- [ ] Implement runtime agent addition
- [ ] Write unit tests for dynamic configuration

### Phase 7: Integration & External Systems (Weeks 13-14)

#### 7.1 Integration Node Support
- [ ] Implement REST API integration
- [ ] Implement GraphQL integration
- [ ] Implement database integration
- [ ] Implement authentication handling
- [ ] Implement request/response transformation
- [ ] Write unit tests for integrations

#### 7.2 Tool Agent Implementation
- [ ] Implement tool execution interface
- [ ] Implement parameter validation for tools
- [ ] Implement output schema validation
- [ ] Implement success criteria checking
- [ ] Implement tool error handling
- [ ] Write unit tests for Tool Agents

#### 7.3 External System Error Handling
- [ ] Implement connection error handling
- [ ] Implement rate limit handling
- [ ] Implement authentication error handling
- [ ] Implement timeout handling for external calls
- [ ] Implement retry logic for external systems
- [ ] Write integration tests

### Phase 8: Testing & Quality Assurance (Weeks 15-16)

#### 8.1 Unit Testing
- [ ] Complete unit tests for all core components
- [ ] Achieve >80% code coverage
- [ ] Test all error paths
- [ ] Test edge cases
- [ ] Set up continuous integration

#### 8.2 Integration Testing
- [ ] Test master-sub-agent communication
- [ ] Test multi-agent scenarios
- [ ] Test error recovery flows
- [ ] Test session resumption
- [ ] Test concurrent requests
- [ ] Test timeout scenarios

#### 8.3 End-to-End Testing
- [ ] Implement E2E test framework
- [ ] Test complete user flows (all scenarios)
- [ ] Test template configurations
- [ ] Test customization features
- [ ] Test performance under load
- [ ] Test failure scenarios

#### 8.4 Performance Testing
- [ ] Implement performance benchmarks
- [ ] Test latency requirements
- [ ] Test throughput requirements
- [ ] Test memory usage
- [ ] Test concurrent session handling
- [ ] Optimize bottlenecks

### Phase 9: Documentation & Deployment (Weeks 17-18)

#### 9.1 API Documentation
- [ ] Document all public APIs
- [ ] Create API reference documentation
- [ ] Document configuration options
- [ ] Document error codes and messages
- [ ] Create code examples

#### 9.2 User Documentation
- [ ] Create getting started guide
- [ ] Create configuration guide
- [ ] Create template usage guide
- [ ] Create troubleshooting guide
- [ ] Create best practices guide

#### 9.3 Developer Documentation
- [ ] Document architecture decisions
- [ ] Document extension points
- [ ] Document testing strategies
- [ ] Create developer onboarding guide
- [ ] Document deployment procedures

#### 9.4 Deployment
- [ ] Set up production environment
- [ ] Configure monitoring and alerting
- [ ] Set up logging aggregation
- [ ] Configure backup and recovery
- [ ] Create deployment scripts
- [ ] Perform security audit

### Phase 10: Monitoring & Observability (Week 19)

#### 10.1 Monitoring Setup
- [ ] Implement metrics collection
- [ ] Set up dashboards
- [ ] Configure alerts
- [ ] Set up log aggregation
- [ ] Implement health checks

#### 10.2 Observability
- [ ] Implement distributed tracing
- [ ] Implement request correlation IDs
- [ ] Implement performance monitoring
- [ ] Implement error tracking
- [ ] Implement usage analytics

### Phase 11: Optimization & Refinement (Week 20+)

#### 11.1 Performance Optimization
- [ ] Profile and optimize hot paths
- [ ] Implement caching where appropriate
- [ ] Optimize database queries
- [ ] Optimize network calls
- [ ] Reduce memory footprint

#### 11.2 Code Quality
- [ ] Code review and refactoring
- [ ] Remove technical debt
- [ ] Improve error messages
- [ ] Enhance logging
- [ ] Improve test coverage

#### 11.3 Feature Enhancements
- [ ] Implement additional templates
- [ ] Add new agent types
- [ ] Enhance customization options
- [ ] Improve error recovery
- [ ] Add new features based on feedback

---

## Implementation Priority

### Critical Path (Must Have)
1. Phase 1: Foundation & Core Infrastructure
2. Phase 2: State Management & Logging
3. Phase 3: Master Agent Implementation
4. Phase 4: Sub-Agent Implementation
5. Phase 5: Error Handling & Reliability

### Important (Should Have)
6. Phase 6: Customization & Configuration
7. Phase 7: Integration & External Systems
8. Phase 8: Testing & Quality Assurance

### Nice to Have (Could Have)
9. Phase 9: Documentation & Deployment
10. Phase 10: Monitoring & Observability
11. Phase 11: Optimization & Refinement

---

## Estimated Timeline

- **Minimum Viable Product (MVP)**: 12-14 weeks (Phases 1-5)
- **Full Implementation**: 20 weeks (All phases)
- **Production Ready**: 22-24 weeks (including refinement)

---

## Resource Requirements

### Development Team
- 1-2 Backend Engineers (TypeScript/Python)
- 1 Frontend Engineer (if UI needed)
- 1 DevOps Engineer (for deployment)
- 1 QA Engineer (for testing)

### Infrastructure
- Development environment
- Testing environment
- Staging environment
- Production environment
- Database (PostgreSQL/Redis)
- Monitoring tools
- Logging infrastructure

---

**Document Version**: 1.1  
**Last Updated**: 2025-01-27  
**Author**: AI System Architect

