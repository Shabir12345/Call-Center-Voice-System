# Architecture Decisions

## Overview

This document records key architectural decisions made during the development of the Master-Sub-Agent architecture.

## Decision 1: Stateless Agents with Centralized State

**Decision**: Agents are stateless, but state is maintained centrally in StateManager.

**Rationale**:
- Simplifies agent implementation
- Enables horizontal scaling
- Centralized state management
- Easier debugging and monitoring

**Alternatives Considered**:
- Stateful agents (rejected: harder to scale)
- Distributed state (rejected: complexity)

## Decision 2: FIPA-ACL Inspired Protocols

**Decision**: Use FIPA-ACL inspired message types (INFORM, QUERY, REQUEST, CONFIRM, CLARIFY).

**Rationale**:
- Standardized communication
- Clear semantics
- Well-understood patterns
- Extensible

**Alternatives Considered**:
- Custom protocols (rejected: reinventing wheel)
- REST-style (rejected: not suitable for agent communication)

## Decision 3: JSON Schema Validation

**Decision**: Use JSON Schema for input/output validation.

**Rationale**:
- Standard format
- Tool support
- Clear validation rules
- Reusable schemas

**Alternatives Considered**:
- Pydantic (rejected: Python-specific)
- Custom validators (rejected: maintenance burden)

## Decision 4: Template-Based Configuration

**Decision**: Use JSON templates for app variants.

**Rationale**:
- Easy to customize
- Version control friendly
- Reusable across projects
- Human-readable

**Alternatives Considered**:
- Code-based config (rejected: harder to customize)
- Database config (rejected: deployment complexity)

## Decision 5: Hybrid Architecture

**Decision**: Support both session-based (complex) and direct (simple) agent calls.

**Rationale**:
- Flexibility
- Performance for simple cases
- Full capabilities for complex cases
- Best of both worlds

**Alternatives Considered**:
- Session-only (rejected: overhead for simple cases)
- Direct-only (rejected: limited capabilities)

## Decision 6: Centralized Logging

**Decision**: All logging goes through CentralLogger.

**Rationale**:
- Consistent format
- Centralized querying
- Easy to add persistence
- Better observability

**Alternatives Considered**:
- Distributed logging (rejected: complexity)
- Agent-specific logging (rejected: harder to query)

## Decision 7: Retry with Exponential Backoff

**Decision**: Use exponential backoff for retries.

**Rationale**:
- Reduces load on failing systems
- Industry standard
- Configurable
- Prevents thundering herd

**Alternatives Considered**:
- Fixed delay (rejected: less efficient)
- Linear backoff (rejected: slower recovery)

## Decision 8: LRU Cache Eviction

**Decision**: Use LRU (Least Recently Used) for cache eviction.

**Rationale**:
- Good hit rates
- Predictable behavior
- Memory efficient
- Well-understood algorithm

**Alternatives Considered**:
- FIFO (rejected: worse hit rates)
- LFU (rejected: more complex)

## Decision 9: Health Checks with Degraded State

**Decision**: Health checks return healthy/degraded/unhealthy states.

**Rationale**:
- More nuanced than binary
- Better alerting
- Graceful degradation
- Actionable information

**Alternatives Considered**:
- Binary healthy/unhealthy (rejected: less informative)
- Numeric scores (rejected: harder to interpret)

## Decision 10: Intent Recognition with Fallback

**Decision**: Use LLM for intent recognition with pattern matching fallback.

**Rationale**:
- Best accuracy with LLM
- Reliable fallback
- Cost-effective
- Fast pattern matching

**Alternatives Considered**:
- LLM only (rejected: cost and latency)
- Pattern only (rejected: less accurate)

