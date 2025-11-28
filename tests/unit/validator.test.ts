/**
 * Unit tests for Enhanced Validator
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EnhancedValidator } from '../../utils/enhancedValidator';

describe('EnhancedValidator', () => {
  let validator: EnhancedValidator;

  beforeEach(() => {
    validator = new EnhancedValidator();
  });

  it('should validate data against schema', () => {
    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'number' }
      },
      required: ['name', 'age']
    };

    validator.addSchema('test_schema', schema as any);

    const valid = validator.validate('test_schema', {
      name: 'John',
      age: 30
    });

    expect(valid.isValid).toBe(true);
  });

  it('should reject invalid data', () => {
    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'number' }
      },
      required: ['name', 'age']
    };

    validator.addSchema('test_schema', schema as any);

    const invalid = validator.validate('test_schema', {
      name: 'John'
      // Missing age
    });

    expect(invalid.isValid).toBe(false);
    expect(invalid.error).toBeDefined();
  });

  it('should check if schema exists', () => {
    const schema = {
      type: 'object',
      properties: {}
    };

    validator.addSchema('test_schema', schema as any);
    expect(validator.hasSchema('test_schema')).toBe(true);
    expect(validator.hasSchema('nonexistent')).toBe(false);
  });
});

