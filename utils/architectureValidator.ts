/**
 * Architecture Validator
 * 
 * Validates architecture integrity, module boundaries, and export consistency.
 * Ensures clean separation of concerns and prevents architectural violations.
 */

// File system operations removed - this validator works with in-memory module definitions

/**
 * Module category for validation
 */
export enum ModuleCategory {
  CORE = 'core',
  AGENTS = 'agents',
  INTEGRATIONS = 'integrations',
  MONITORING = 'monitoring',
  UTILITIES = 'utilities',
  SUB_AGENTS = 'sub-agents'
}

/**
 * Module definition
 */
export interface ModuleDefinition {
  name: string;
  category: ModuleCategory;
  filePath: string;
  exports: string[];
  dependencies: string[];
  allowedDependencies?: string[];
}

/**
 * Architecture validation result
 */
export interface ArchitectureValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  circularDependencies: string[][];
  boundaryViolations: Array<{
    module: string;
    violation: string;
    dependency: string;
  }>;
  missingExports: Array<{
    file: string;
    expectedExports: string[];
  }>;
}

/**
 * Expected module structure
 */
const MODULE_STRUCTURE: Record<ModuleCategory, {
  allowedDependencies: ModuleCategory[];
  description: string;
}> = {
  [ModuleCategory.CORE]: {
    allowedDependencies: [],
    description: 'Core modules (state, logging, types) - no dependencies on other categories'
  },
  [ModuleCategory.AGENTS]: {
    allowedDependencies: [ModuleCategory.CORE, ModuleCategory.UTILITIES],
    description: 'Agent modules (master, sub-agents) - depend on core and utilities'
  },
  [ModuleCategory.INTEGRATIONS]: {
    allowedDependencies: [ModuleCategory.CORE, ModuleCategory.UTILITIES],
    description: 'Integration modules - depend on core and utilities'
  },
  [ModuleCategory.MONITORING]: {
    allowedDependencies: [ModuleCategory.CORE, ModuleCategory.UTILITIES],
    description: 'Monitoring modules - depend on core and utilities'
  },
  [ModuleCategory.UTILITIES]: {
    allowedDependencies: [ModuleCategory.CORE],
    description: 'Utility modules - depend on core only'
  },
  [ModuleCategory.SUB_AGENTS]: {
    allowedDependencies: [ModuleCategory.CORE, ModuleCategory.AGENTS, ModuleCategory.UTILITIES],
    description: 'Sub-agent implementations - depend on core, agents, and utilities'
  }
};

/**
 * Architecture Validator class
 */
export class ArchitectureValidator {
  private modules: Map<string, ModuleDefinition> = new Map();
  private validationResults: ArchitectureValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    circularDependencies: [],
    boundaryViolations: [],
    missingExports: []
  };

  /**
   * Register a module
   */
  registerModule(module: ModuleDefinition): void {
    this.modules.set(module.name, module);
  }

  /**
   * Validate architecture
   */
  validate(): ArchitectureValidationResult {
    this.validationResults = {
      isValid: true,
      errors: [],
      warnings: [],
      circularDependencies: [],
      boundaryViolations: [],
      missingExports: []
    };

    // Check for circular dependencies
    this.detectCircularDependencies();

    // Check module boundaries
    this.validateModuleBoundaries();

    // Check exports consistency
    this.validateExports();

    // Determine overall validity
    this.validationResults.isValid = 
      this.validationResults.errors.length === 0 &&
      this.validationResults.circularDependencies.length === 0 &&
      this.validationResults.boundaryViolations.length === 0;

    return { ...this.validationResults };
  }

  /**
   * Detect circular dependencies
   */
  private detectCircularDependencies(): void {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const cycles: string[][] = [];

    const dfs = (moduleName: string, path: string[]): void => {
      visited.add(moduleName);
      recursionStack.add(moduleName);

      const module = this.modules.get(moduleName);
      if (!module) return;

      for (const dep of module.dependencies) {
        if (!visited.has(dep)) {
          dfs(dep, [...path, dep]);
        } else if (recursionStack.has(dep)) {
          // Found a cycle
          const cycleStart = path.indexOf(dep);
          if (cycleStart !== -1) {
            cycles.push([...path.slice(cycleStart), dep]);
          }
        }
      }

      recursionStack.delete(moduleName);
    };

    for (const moduleName of this.modules.keys()) {
      if (!visited.has(moduleName)) {
        dfs(moduleName, [moduleName]);
      }
    }

    this.validationResults.circularDependencies = cycles;
  }

  /**
   * Validate module boundaries
   */
  private validateModuleBoundaries(): void {
    for (const [moduleName, module] of this.modules.entries()) {
      const category = module.category;
      const allowedCategories = MODULE_STRUCTURE[category].allowedDependencies;

      for (const dep of module.dependencies) {
        const depModule = this.modules.get(dep);
        if (!depModule) continue;

        // Check if dependency category is allowed
        if (!allowedCategories.includes(depModule.category)) {
          this.validationResults.boundaryViolations.push({
            module: moduleName,
            violation: `Module in category '${category}' cannot depend on category '${depModule.category}'`,
            dependency: dep
          });
        }

        // Check explicit allowed dependencies
        if (module.allowedDependencies && 
            !module.allowedDependencies.includes(dep) &&
            !allowedCategories.includes(depModule.category)) {
          this.validationResults.boundaryViolations.push({
            module: moduleName,
            violation: `Dependency '${dep}' is not in allowed dependencies list`,
            dependency: dep
          });
        }
      }
    }
  }

  /**
   * Validate exports consistency with index.ts
   */
  private validateExports(): void {
    // This would need to parse index.ts and compare with actual module exports
    // For now, we'll provide a structure for this validation
    this.validationResults.warnings.push(
      'Export validation requires parsing index.ts file - implement file system parsing for full validation'
    );
  }

  /**
   * Get module health score
   */
  getHealthScore(): number {
    const totalIssues = 
      this.validationResults.errors.length +
      this.validationResults.circularDependencies.length +
      this.validationResults.boundaryViolations.length;

    const maxIssues = Math.max(1, this.modules.size * 2);
    const score = Math.max(0, 100 - (totalIssues / maxIssues) * 100);
    
    return Math.round(score);
  }

  /**
   * Generate architecture report
   */
  generateReport(): string {
    const report: string[] = [];
    report.push('=== Architecture Validation Report ===\n');
    
    report.push(`Status: ${this.validationResults.isValid ? '✅ VALID' : '❌ INVALID'}\n`);
    report.push(`Health Score: ${this.getHealthScore()}/100\n`);
    report.push(`Total Modules: ${this.modules.size}\n`);

    if (this.validationResults.errors.length > 0) {
      report.push(`\nErrors (${this.validationResults.errors.length}):`);
      this.validationResults.errors.forEach((error, idx) => {
        report.push(`  ${idx + 1}. ${error}`);
      });
    }

    if (this.validationResults.circularDependencies.length > 0) {
      report.push(`\nCircular Dependencies (${this.validationResults.circularDependencies.length}):`);
      this.validationResults.circularDependencies.forEach((cycle, idx) => {
        report.push(`  ${idx + 1}. ${cycle.join(' -> ')}`);
      });
    }

    if (this.validationResults.boundaryViolations.length > 0) {
      report.push(`\nBoundary Violations (${this.validationResults.boundaryViolations.length}):`);
      this.validationResults.boundaryViolations.forEach((violation, idx) => {
        report.push(`  ${idx + 1}. [${violation.module}] ${violation.violation}`);
        report.push(`     Dependency: ${violation.dependency}`);
      });
    }

    if (this.validationResults.warnings.length > 0) {
      report.push(`\nWarnings (${this.validationResults.warnings.length}):`);
      this.validationResults.warnings.forEach((warning, idx) => {
        report.push(`  ${idx + 1}. ${warning}`);
      });
    }

    return report.join('\n');
  }
}

/**
 * Quick validation function
 */
export function validateArchitecture(modules: ModuleDefinition[]): ArchitectureValidationResult {
  const validator = new ArchitectureValidator();
  modules.forEach(module => validator.registerModule(module));
  return validator.validate();
}

/**
 * Predefined module definitions based on current architecture
 */
export const ARCHITECTURE_MODULES: ModuleDefinition[] = [
  {
    name: 'stateManager',
    category: ModuleCategory.CORE,
    filePath: 'utils/stateManager.ts',
    exports: ['StateManager', 'Session', 'HistoryEntry', 'StorageInterface', 'LongTermStorage'],
    dependencies: []
  },
  {
    name: 'logger',
    category: ModuleCategory.CORE,
    filePath: 'utils/logger.ts',
    exports: ['CentralLogger', 'LogEntry', 'LogLevel', 'LogQueryFilters', 'LogStorage'],
    dependencies: []
  },
  {
    name: 'masterAgent',
    category: ModuleCategory.AGENTS,
    filePath: 'utils/masterAgent.ts',
    exports: ['MasterAgent', 'MasterAgentConfig', 'IntentResult'],
    dependencies: ['stateManager', 'logger', 'communicationProtocols', 'schemas', 'enhancedValidator', 'agentCommunication']
  },
  {
    name: 'subAgentModule',
    category: ModuleCategory.AGENTS,
    filePath: 'utils/subAgentModule.ts',
    exports: ['SubAgentModule', 'SubAgentConfig', 'TaskResult'],
    dependencies: ['logger', 'enhancedValidator', 'communicationProtocols', 'schemas']
  },
  {
    name: 'errorHandling',
    category: ModuleCategory.UTILITIES,
    filePath: 'utils/errorHandling.ts',
    exports: ['ErrorCode', 'ErrorCategory', 'createErrorResponse', 'isRetryableError', 'executeWithFallback'],
    dependencies: []
  },
  {
    name: 'performanceMonitor',
    category: ModuleCategory.MONITORING,
    filePath: 'utils/performanceMonitor.ts',
    exports: ['PerformanceMonitor', 'PerformanceMetrics'],
    dependencies: ['logger']
  },
  {
    name: 'healthChecker',
    category: ModuleCategory.MONITORING,
    filePath: 'utils/healthChecker.ts',
    exports: ['HealthChecker', 'HealthStatus', 'HealthReport'],
    dependencies: ['logger']
  }
];

