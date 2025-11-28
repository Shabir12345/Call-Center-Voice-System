# Error Codes Reference

## Overview

All error codes used in the Master-Sub-Agent architecture system.

## Error Categories

### Input Validation Errors

#### INVALID_INPUT
- **Code**: `INVALID_INPUT`
- **Retryable**: No
- **Message**: "The information provided is invalid. Please check and try again."
- **HTTP Status**: 400

#### MISSING_REQUIRED_DATA
- **Code**: `MISSING_REQUIRED_DATA`
- **Retryable**: No
- **Message**: "Some required information is missing. Please provide all necessary details."
- **HTTP Status**: 400

#### TYPE_MISMATCH
- **Code**: `TYPE_MISMATCH`
- **Retryable**: No
- **Message**: "The data format is incorrect. Please check your input."
- **HTTP Status**: 400

### External System Errors

#### EXTERNAL_API_FAILURE
- **Code**: `EXTERNAL_API_FAILURE`
- **Retryable**: Yes
- **Message**: "I'm having trouble accessing the system right now. Please try again in a moment."
- **HTTP Status**: 503

#### DATABASE_ERROR
- **Code**: `DATABASE_ERROR`
- **Retryable**: Yes
- **Message**: "The database is temporarily unavailable. Please try again."
- **HTTP Status**: 503

#### NETWORK_ERROR
- **Code**: `NETWORK_ERROR`
- **Retryable**: Yes
- **Message**: "A network error occurred. Please check your connection and try again."
- **HTTP Status**: 503

#### CONNECTION_TIMEOUT
- **Code**: `CONNECTION_TIMEOUT`
- **Retryable**: Yes
- **Message**: "The connection timed out. Please try again."
- **HTTP Status**: 504

### Timeout Errors

#### TIMEOUT_ERROR
- **Code**: `TIMEOUT_ERROR`
- **Retryable**: Yes
- **Message**: "The request took too long to process. Please try again."
- **HTTP Status**: 504

#### REQUEST_TIMEOUT
- **Code**: `REQUEST_TIMEOUT`
- **Retryable**: Yes
- **Message**: "Your request timed out. Please try again."
- **HTTP Status**: 504

### Permission Errors

#### UNAUTHORIZED
- **Code**: `UNAUTHORIZED`
- **Retryable**: No
- **Message**: "You are not authorized to perform this action."
- **HTTP Status**: 401

#### FORBIDDEN
- **Code**: `FORBIDDEN`
- **Retryable**: No
- **Message**: "You do not have permission to access this resource."
- **HTTP Status**: 403

#### PERMISSION_DENIED
- **Code**: `PERMISSION_DENIED`
- **Retryable**: No
- **Message**: "Permission denied. Please contact support if you believe this is an error."
- **HTTP Status**: 403

### Internal Errors

#### INTERNAL_ERROR
- **Code**: `INTERNAL_ERROR`
- **Retryable**: No
- **Message**: "An internal error occurred. Please try again or contact support."
- **HTTP Status**: 500

#### UNEXPECTED_ERROR
- **Code**: `UNEXPECTED_ERROR`
- **Retryable**: No
- **Message**: "An unexpected error occurred. Please try again."
- **HTTP Status**: 500

#### PROCESSING_ERROR
- **Code**: `PROCESSING_ERROR`
- **Retryable**: Yes
- **Message**: "There was an error processing your request. Please try again."
- **HTTP Status**: 500

### Business Logic Errors

#### BUSINESS_RULE_VIOLATION
- **Code**: `BUSINESS_RULE_VIOLATION`
- **Retryable**: No
- **Message**: "This action cannot be completed due to business rules."
- **HTTP Status**: 400

#### RESERVATION_NOT_FOUND
- **Code**: `RESERVATION_NOT_FOUND`
- **Retryable**: No
- **Message**: "I couldn't find a reservation with those details. Please verify your reservation number and name."
- **HTTP Status**: 404

#### BILLING_INFO_NOT_FOUND
- **Code**: `BILLING_INFO_NOT_FOUND`
- **Retryable**: No
- **Message**: "No billing information found for the specified period."
- **HTTP Status**: 404

### Rate Limiting

#### RATE_LIMIT_ERROR
- **Code**: `RATE_LIMIT_ERROR`
- **Retryable**: Yes
- **Message**: "Too many requests. Please wait a moment and try again."
- **HTTP Status**: 429

#### TOO_MANY_REQUESTS
- **Code**: `TOO_MANY_REQUESTS`
- **Retryable**: Yes
- **Message**: "Rate limit exceeded. Please wait before trying again."
- **HTTP Status**: 429

## Usage

```typescript
import { ErrorCode, createErrorResponse, getUserFriendlyErrorMessage } from './utils/errorHandling';

// Create error response
const error = createErrorResponse(
  ErrorCode.EXTERNAL_API_FAILURE,
  'API call failed',
  { details: 'more info' }
);

// Get user-friendly message
const message = getUserFriendlyErrorMessage(ErrorCode.RESERVATION_NOT_FOUND);
```

## Error Handling Best Practices

1. **Use Error Codes**: Always use error codes instead of string messages
2. **Check Retryable**: Check if error is retryable before retrying
3. **Log Errors**: Always log errors with full context
4. **User-Friendly Messages**: Use `getUserFriendlyErrorMessage()` for user-facing errors
5. **Error Categories**: Group errors by category for better handling

