/**
 * Enhanced Validator
 * 
 * Comprehensive validation system for input/output schemas,
 * data types, constraints, and input sanitization.
 */

/**
 * Validation result structure
 */
export interface ValidationResult {
  isValid: boolean;
  error?: string;
  errorCode?: string;
  details?: {
    field?: string;
    expected?: string;
    actual?: string;
    violations?: ValidationViolation[];
  };
}

/**
 * Validation violation details
 */
export interface ValidationViolation {
  field: string;
  message: string;
  code: string;
  value?: any;
}

/**
 * Field validation schema
 */
export interface FieldSchema {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'json';
  required?: boolean;
  min?: number;
  max?: number;
  pattern?: string | RegExp;
  enum?: any[];
  items?: FieldSchema; // For array types
  properties?: Record<string, FieldSchema>; // For object types
  description?: string;
  example?: any;
}

/**
 * Input/Output schema definition
 */
export interface SchemaDefinition {
  type: 'object';
  properties: Record<string, FieldSchema>;
  required?: string[];
  additionalProperties?: boolean;
}

/**
 * Enhanced Validator class
 */
export class EnhancedValidator {
  private schemas: Map<string, SchemaDefinition> = new Map();

  /**
   * Register a named schema for later validation.
   */
  addSchema(name: string, schema: SchemaDefinition): void {
    this.schemas.set(name, schema);
  }

  /**
   * Check if a named schema exists.
   */
  hasSchema(name: string): boolean {
    return this.schemas.has(name);
  }

  /**
   * Validate a value against a previously registered schema.
   */
  validate(
    schemaName: string,
    value: any
  ): ValidationResult {
    const schema = this.schemas.get(schemaName);
    if (!schema) {
      return {
        isValid: false,
        error: `Schema '${schemaName}' not found`,
        errorCode: 'SCHEMA_NOT_FOUND'
      };
    }

    return this.validateInput(value, schema);
  }

  /**
   * Validate input against schema
   */
  validateInput(
    input: any,
    schema: SchemaDefinition
  ): ValidationResult {
    // Check if input is an object
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      return {
        isValid: false,
        error: 'Input must be an object',
        errorCode: 'INVALID_INPUT_TYPE',
        details: {
          expected: 'object',
          actual: typeof input
        }
      };
    }

    const violations: ValidationViolation[] = [];

    // Check required fields
    if (schema.required) {
      for (const field of schema.required) {
        if (!(field in input) || input[field] === undefined || input[field] === null) {
          violations.push({
            field,
            message: `Required field '${field}' is missing`,
            code: 'MISSING_REQUIRED_FIELD'
          });
        }
      }
    }

    // Validate each property
    for (const [fieldName, fieldSchema] of Object.entries(schema.properties)) {
      const value = input[fieldName];

      // Skip if field is not present and not required
      if (value === undefined || value === null) {
        if (!fieldSchema.required) {
          continue;
        }
      }

      // Validate field
      const fieldResult = this.validateField(value, fieldSchema, fieldName);
      if (!fieldResult.isValid) {
        violations.push({
          field: fieldName,
          message: fieldResult.error || 'Validation failed',
          code: fieldResult.errorCode || 'VALIDATION_FAILED',
          value
        });
      }
    }

    // Check for additional properties if not allowed
    if (schema.additionalProperties === false) {
      const allowedFields = new Set([
        ...Object.keys(schema.properties),
        ...(schema.required || [])
      ]);

      for (const field of Object.keys(input)) {
        if (!allowedFields.has(field)) {
          violations.push({
            field,
            message: `Unexpected field '${field}'`,
            code: 'UNEXPECTED_FIELD'
          });
        }
      }
    }

    if (violations.length > 0) {
      return {
        isValid: false,
        error: `Validation failed with ${violations.length} violation(s)`,
        errorCode: 'VALIDATION_FAILED',
        details: {
          violations
        }
      };
    }

    return { isValid: true };
  }

  /**
   * Validate a single field against its schema
   */
  validateField(
    value: any,
    schema: FieldSchema,
    fieldName: string
  ): ValidationResult {
    // Check required
    if (schema.required && (value === undefined || value === null)) {
      return {
        isValid: false,
        error: `Field '${fieldName}' is required`,
        errorCode: 'MISSING_REQUIRED_FIELD',
        details: { field: fieldName }
      };
    }

    // Skip validation if value is not provided and not required
    if (value === undefined || value === null) {
      return { isValid: true };
    }

    // Validate type
    const typeResult = this.validateType(value, schema.type, fieldName);
    if (!typeResult.isValid) {
      return typeResult;
    }

    // Validate constraints based on type
    switch (schema.type) {
      case 'string':
        return this.validateString(value, schema, fieldName);
      case 'number':
        return this.validateNumber(value, schema, fieldName);
      case 'array':
        return this.validateArray(value, schema, fieldName);
      case 'object':
        return this.validateObject(value, schema, fieldName);
      case 'boolean':
        return this.validateBoolean(value, fieldName);
      case 'json':
        return this.validateJson(value, fieldName);
      default:
        return { isValid: true };
    }
  }

  /**
   * Validate data type
   */
  private validateType(
    value: any,
    expectedType: FieldSchema['type'],
    fieldName: string
  ): ValidationResult {
    const actualType = this.getType(value);

    if (expectedType === 'json') {
      // JSON type accepts objects or arrays
      if (actualType === 'object' || actualType === 'array') {
        return { isValid: true };
      }
    }

    if (actualType !== expectedType) {
      return {
        isValid: false,
        error: `Field '${fieldName}' must be of type ${expectedType}, got ${actualType}`,
        errorCode: 'TYPE_MISMATCH',
        details: {
          field: fieldName,
          expected: expectedType,
          actual: actualType
        }
      };
    }

    return { isValid: true };
  }

  /**
   * Get JavaScript type of value
   */
  private getType(value: any): string {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
  }

  /**
   * Validate string field
   */
  private validateString(
    value: any,
    schema: FieldSchema,
    fieldName: string
  ): ValidationResult {
    if (typeof value !== 'string') {
      return {
        isValid: false,
        error: `Field '${fieldName}' must be a string`,
        errorCode: 'TYPE_MISMATCH',
        details: { field: fieldName }
      };
    }

    // Sanitize input to prevent XSS
    // Note: Sanitization should be done before validation in calling code
    // This is a validation layer, not a sanitization layer

    // Check min length
    if (schema.min !== undefined && value.length < schema.min) {
      return {
        isValid: false,
        error: `Field '${fieldName}' must be at least ${schema.min} characters`,
        errorCode: 'MIN_LENGTH_VIOLATION',
        details: { field: fieldName }
      };
    }

    // Check max length
    if (schema.max !== undefined && value.length > schema.max) {
      return {
        isValid: false,
        error: `Field '${fieldName}' must be at most ${schema.max} characters`,
        errorCode: 'MAX_LENGTH_VIOLATION',
        details: { field: fieldName }
      };
    }

    // Check pattern
    if (schema.pattern) {
      const regex = typeof schema.pattern === 'string' 
        ? new RegExp(schema.pattern) 
        : schema.pattern;
      
      if (!regex.test(value)) {
        return {
          isValid: false,
          error: `Field '${fieldName}' does not match required pattern`,
          errorCode: 'PATTERN_MISMATCH',
          details: { field: fieldName }
        };
      }
    }

    // Check enum
    if (schema.enum && !schema.enum.includes(value)) {
      return {
        isValid: false,
        error: `Field '${fieldName}' must be one of: ${schema.enum.join(', ')}`,
        errorCode: 'ENUM_VIOLATION',
        details: { field: fieldName }
      };
    }

    return { isValid: true };
  }

  /**
   * Validate number field
   */
  private validateNumber(
    value: any,
    schema: FieldSchema,
    fieldName: string
  ): ValidationResult {
    if (typeof value !== 'number' || isNaN(value)) {
      return {
        isValid: false,
        error: `Field '${fieldName}' must be a number`,
        errorCode: 'TYPE_MISMATCH',
        details: { field: fieldName }
      };
    }

    // Check min
    if (schema.min !== undefined && value < schema.min) {
      return {
        isValid: false,
        error: `Field '${fieldName}' must be at least ${schema.min}`,
        errorCode: 'MIN_VALUE_VIOLATION',
        details: { field: fieldName }
      };
    }

    // Check max
    if (schema.max !== undefined && value > schema.max) {
      return {
        isValid: false,
        error: `Field '${fieldName}' must be at most ${schema.max}`,
        errorCode: 'MAX_VALUE_VIOLATION',
        details: { field: fieldName }
      };
    }

    return { isValid: true };
  }

  /**
   * Validate array field
   */
  private validateArray(
    value: any,
    schema: FieldSchema,
    fieldName: string
  ): ValidationResult {
    if (!Array.isArray(value)) {
      return {
        isValid: false,
        error: `Field '${fieldName}' must be an array`,
        errorCode: 'TYPE_MISMATCH',
        details: { field: fieldName }
      };
    }

    // Check min length
    if (schema.min !== undefined && value.length < schema.min) {
      return {
        isValid: false,
        error: `Field '${fieldName}' must have at least ${schema.min} items`,
        errorCode: 'MIN_LENGTH_VIOLATION',
        details: { field: fieldName }
      };
    }

    // Check max length
    if (schema.max !== undefined && value.length > schema.max) {
      return {
        isValid: false,
        error: `Field '${fieldName}' must have at most ${schema.max} items`,
        errorCode: 'MAX_LENGTH_VIOLATION',
        details: { field: fieldName }
      };
    }

    // Validate items if schema provided
    if (schema.items) {
      for (let i = 0; i < value.length; i++) {
        const itemResult = this.validateField(value[i], schema.items, `${fieldName}[${i}]`);
        if (!itemResult.isValid) {
          return itemResult;
        }
      }
    }

    return { isValid: true };
  }

  /**
   * Validate object field
   */
  private validateObject(
    value: any,
    schema: FieldSchema,
    fieldName: string
  ): ValidationResult {
    if (typeof value !== 'object' || Array.isArray(value) || value === null) {
      return {
        isValid: false,
        error: `Field '${fieldName}' must be an object`,
        errorCode: 'TYPE_MISMATCH',
        details: { field: fieldName }
      };
    }

    // Validate properties if schema provided
    if (schema.properties) {
      for (const [propName, propSchema] of Object.entries(schema.properties)) {
        const propResult = this.validateField(
          value[propName],
          propSchema,
          `${fieldName}.${propName}`
        );
        if (!propResult.isValid) {
          return propResult;
        }
      }
    }

    return { isValid: true };
  }

  /**
   * Validate boolean field
   */
  private validateBoolean(
    value: any,
    fieldName: string
  ): ValidationResult {
    if (typeof value !== 'boolean') {
      return {
        isValid: false,
        error: `Field '${fieldName}' must be a boolean`,
        errorCode: 'TYPE_MISMATCH',
        details: { field: fieldName }
      };
    }

    return { isValid: true };
  }

  /**
   * Validate JSON field
   */
  private validateJson(
    value: any,
    fieldName: string
  ): ValidationResult {
    // JSON type accepts objects or arrays
    if (typeof value !== 'object' || value === null) {
      return {
        isValid: false,
        error: `Field '${fieldName}' must be a valid JSON object or array`,
        errorCode: 'TYPE_MISMATCH',
        details: { field: fieldName }
      };
    }

    return { isValid: true };
  }

  /**
   * Validate output against schema
   */
  validateOutput(
    output: any,
    schema: SchemaDefinition
  ): ValidationResult {
    // Same validation logic as input
    return this.validateInput(output, schema);
  }

  /**
   * Sanitize input to prevent injection attacks
   */
  sanitizeInput(input: any): any {
    if (typeof input === 'string') {
      // Remove potential script tags and dangerous patterns
      return input
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '')
        .trim();
    }

    if (Array.isArray(input)) {
      return input.map(item => this.sanitizeInput(item));
    }

    if (typeof input === 'object' && input !== null) {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(input)) {
        // Sanitize key
        const sanitizedKey = this.sanitizeInput(key);
        // Sanitize value
        sanitized[sanitizedKey] = this.sanitizeInput(value);
      }
      return sanitized;
    }

    return input;
  }

  /**
   * Check data type
   */
  checkDataType(value: any, expectedType: string): boolean {
    const actualType = this.getType(value);
    return actualType === expectedType;
  }

  /**
   * Validate constraint
   */
  validateConstraint(
    value: any,
    constraint: {
      type: 'min' | 'max' | 'pattern' | 'enum' | 'required';
      value: any;
    },
    fieldName: string
  ): ValidationResult {
    switch (constraint.type) {
      case 'min':
        if (typeof value === 'number' && value < constraint.value) {
          return {
            isValid: false,
            error: `Field '${fieldName}' must be at least ${constraint.value}`,
            errorCode: 'CONSTRAINT_VIOLATION',
            details: { field: fieldName }
          };
        }
        if (typeof value === 'string' && value.length < constraint.value) {
          return {
            isValid: false,
            error: `Field '${fieldName}' must be at least ${constraint.value} characters`,
            errorCode: 'CONSTRAINT_VIOLATION',
            details: { field: fieldName }
          };
        }
        break;

      case 'max':
        if (typeof value === 'number' && value > constraint.value) {
          return {
            isValid: false,
            error: `Field '${fieldName}' must be at most ${constraint.value}`,
            errorCode: 'CONSTRAINT_VIOLATION',
            details: { field: fieldName }
          };
        }
        if (typeof value === 'string' && value.length > constraint.value) {
          return {
            isValid: false,
            error: `Field '${fieldName}' must be at most ${constraint.value} characters`,
            errorCode: 'CONSTRAINT_VIOLATION',
            details: { field: fieldName }
          };
        }
        break;

      case 'pattern':
        const regex = typeof constraint.value === 'string'
          ? new RegExp(constraint.value)
          : constraint.value;
        if (typeof value === 'string' && !regex.test(value)) {
          return {
            isValid: false,
            error: `Field '${fieldName}' does not match required pattern`,
            errorCode: 'CONSTRAINT_VIOLATION',
            details: { field: fieldName }
          };
        }
        break;

      case 'enum':
        if (!constraint.value.includes(value)) {
          return {
            isValid: false,
            error: `Field '${fieldName}' must be one of: ${constraint.value.join(', ')}`,
            errorCode: 'CONSTRAINT_VIOLATION',
            details: { field: fieldName }
          };
        }
        break;

      case 'required':
        if (value === undefined || value === null) {
          return {
            isValid: false,
            error: `Field '${fieldName}' is required`,
            errorCode: 'CONSTRAINT_VIOLATION',
            details: { field: fieldName }
          };
        }
        break;
    }

    return { isValid: true };
  }
}

// Export singleton instance
export const validator = new EnhancedValidator();

