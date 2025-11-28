/**
 * Master-Sub-Agent Architecture - Utility Exports
 * 
 * Central export point for all architecture utilities
 */

// Communication
export { CommunicationManager } from './agentCommunication';
export { 
  MessageRouter, 
  createMessage, 
  createResponse, 
  createClarification,
  validateProtocol,
  MESSAGE_TYPES 
} from './communicationProtocols';

// State Management
export { 
  StateManager, 
  Session, 
  HistoryEntry,
  StorageInterface,
  LongTermStorage
} from './stateManager';

// Logging
export { 
  CentralLogger, 
  logger,
  LogEntry,
  LogLevel,
  LogQueryFilters,
  LogStorage
} from './logger';

// Validation
export { 
  EnhancedValidator,
  validator,
  ValidationResult,
  ValidationViolation,
  FieldSchema,
  SchemaDefinition
} from './enhancedValidator';

// Schemas
export {
  masterToSubAgentInputSchema,
  subAgentToMasterOutputSchema,
  taskSchemas,
  getTaskSchema,
  getOutputSchema
} from './schemas';

// Master Agent
export {
  MasterAgent,
  MasterAgentConfig,
  IntentResult
} from './masterAgent';

// Sub-Agent Base
export {
  SubAgentModule,
  SubAgentConfig,
  TaskResult
} from './subAgentModule';

// Sub-Agent Implementations
export { ReservationAgentModule } from './subAgents/reservationAgent';
export { BillingAgentModule } from './subAgents/billingAgent';
export { SupportAgentModule } from './subAgents/supportAgent';
export { DataRetrievalAgent } from './subAgents/dataRetrievalAgent';
export { ActionAgent } from './subAgents/actionAgent';
export { ValidationAgent } from './subAgents/validationAgent';
export { CalculationAgent } from './subAgents/calculationAgent';
export { AppointmentAgent } from './subAgents/appointmentAgent';

// Error Handling
export {
  ErrorCode,
  ErrorCategory,
  ERROR_CATEGORIES,
  ErrorResponse,
  createErrorResponse,
  getUserFriendlyErrorMessage,
  isRetryableError,
  RetryConfig,
  DEFAULT_RETRY_CONFIG,
  calculateRetryDelay,
  shouldRetry,
  TimeoutConfig,
  DEFAULT_TIMEOUT_CONFIG,
  getTimeoutForTask,
  FallbackStrategy,
  FallbackConfig,
  executeWithFallback
} from './errorHandling';

// User Profile
export {
  UserProfile,
  UserProfileManager,
  UserPreferences
} from './userProfile';

// App Variant
export {
  AppVariantManager,
  TemplateLoader,
  AppVariantTemplate,
  AppConfig,
  TemplateSubAgentConfig,
  TemplateMasterAgentConfig
} from './appVariant';

// Agent Registry
export {
  AgentRegistry,
  AgentRegistryEntry
} from './agentRegistry';

// Response Validator (existing)
export {
  validateSubAgentResponse,
  normalizeSubAgentResponse,
  transformResponseForMaster,
  withTimeout,
  withRetry,
  isRetryableError as isRetryableErrorValidator,
  RetryConfig as RetryConfigValidator
} from './responseValidator';

// Session Management
export {
  SessionManager,
  SessionActivity
} from './sessionManager';

// Performance & Monitoring
export {
  PerformanceMonitor,
  PerformanceMetrics
} from './performanceMonitor';

export {
  HealthChecker,
  HealthStatus,
  ComponentHealth,
  HealthReport
} from './healthChecker';

// Intent Recognition & Response Formatting
export {
  IntentRecognizer,
  IntentRecognitionResult
} from './intentRecognizer';

export {
  ResponseFormatter,
  FormattingOptions
} from './responseFormatter';

// Integration Adapters
export {
  TestPanelAdapter
} from './testPanelAdapter';

export {
  LegacyAdapter
} from './legacyAdapter';

export {
  MigrationUtils,
  MigrationResult
} from './migrationUtils';

// Alerting
export {
  AlertManager,
  AlertConfig,
  Alert,
  AlertSeverity,
  AlertChannel,
  AlertHandler
} from './alerting';

// Caching
export {
  CacheManager,
  CacheConfig,
  CacheStats,
  CacheManagerFactory
} from './cacheManager';

// Configuration Validation
export {
  ConfigValidator,
  ValidationResult as ConfigValidationResult
} from './configValidator';

// Test Helpers (for testing only)
export * from './testHelpers';

// Tracing & Observability
export {
  Tracer,
  TraceSpan,
  TraceContext,
  CorrelationIdGenerator
} from './tracing';

export {
  AnalyticsManager,
  AnalyticsEvent,
  UsageMetrics
} from './analytics';

// Optimization
export {
  PerformanceOptimizer,
  PerformanceProfile,
  OptimizationRecommendation
} from './optimization';

// Log Aggregation
export {
  LogAggregator,
  LogSource
} from './logAggregator';

// Dashboard
export {
  DashboardProvider,
  DashboardData
} from './dashboard';

// Security
export {
  SecurityManager,
  SecurityAuditResult
} from './security';

// Encryption
export {
  encryptData,
  decryptData,
  generateKey,
  clearEncryptionKey,
  isEncryptionSupported
} from './encryption';

// Rate Limiting
export {
  RateLimiter,
  RateLimitConfig,
  RateLimitResult
} from './rateLimiter';

// Input Sanitization
export {
  sanitizeHtml,
  sanitizeString,
  sanitizeObject,
  sanitizeForStorage,
  sanitizeEmail,
  sanitizeUrl,
  sanitizeForSQL,
  sanitizeForJSON,
  containsDangerousContent,
  sanitizeInput
} from './inputSanitizer';

// Error Sanitization
export {
  sanitizeErrorMessage,
  createSanitizedErrorResponse,
  logErrorWithDetails,
  containsSensitiveInfo,
  SanitizedError
} from './errorSanitizer';

// Audit Logging
export {
  AuditLogger,
  globalAuditLogger,
  auditLog,
  AuditEventType,
  AuditLogEntry,
  AuditLogQuery
} from './auditLogger';

// Security Headers
export {
  isSecureContext,
  enforceHTTPS,
  getSecurityHeaders,
  validateSecurityConfig,
  initializeSecurity
} from './securityHeaders';

// Resource Monitoring
export {
  ResourceMonitor,
  globalResourceMonitor,
  ResourceMetrics,
  ResourceLimits,
  ResourceAlert
} from './resourceMonitor';

// Backup & Recovery
export {
  BackupManager,
  BackupData
} from './backupRecovery';

// Call Recording
export {
  CallRecorder,
  RecordingOptions
} from './callRecorder';

// Sentiment Analysis
export {
  SentimentAnalyzer,
  SentimentAnalysisResult,
  SentimentHistory
} from './sentimentAnalyzer';

// Transcription Export
export {
  TranscriptionExporter,
  TranscriptEntry,
  Transcript
} from './transcriptionExporter';

export {
  TranscriptionStorage
} from './transcriptionStorage';

// Language Support
export {
  LanguageDetector
} from './languageDetector';

export {
  Translator
} from './translator';

export {
  LANGUAGE_CONFIGS,
  getLanguageConfig,
  getAllLanguages
} from './languageConfig';

// Call Transfer
export {
  CallTransferManager,
  TransferType,
  TransferRequest,
  TransferResult
} from './callTransfer';

// Knowledge Base
export {
  KnowledgeBaseManager,
  SearchResult,
  SearchType
} from './knowledgeBase';

// Feedback Collection
export {
  FeedbackCollector,
  Feedback,
  FeedbackRating,
  NPSRating,
  FeedbackAnalytics
} from './feedbackCollector';

export {
  FeedbackAnalyticsEngine
} from './feedbackAnalytics';

// Call Quality Scoring
export {
  CallQualityScorer,
  QualityFactors,
  QualityScore
} from './callQualityScorer';

// CRM Integration
export {
  CRMIntegration,
  CRMContact
} from './crmIntegration';

// Architecture Validation
export {
  ArchitectureValidator,
  validateArchitecture,
  ModuleCategory,
  ModuleDefinition,
  ArchitectureValidationResult,
  ARCHITECTURE_MODULES
} from './architectureValidator';

// Circuit Breaker
export {
  CircuitBreaker,
  CircuitBreakerManager,
  circuitBreakerManager,
  CircuitState,
  CircuitBreakerConfig,
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
  CircuitBreakerStats
} from './circuitBreaker';

// Adaptive Retry
export {
  AdaptiveRetryStrategy,
  AdaptiveRetryConfig,
  DEFAULT_ADAPTIVE_RETRY_CONFIG,
  ErrorPattern
} from './adaptiveRetry';

// Reliability Metrics
export {
  ReliabilityMetricsTracker,
  ReliabilityMetrics,
  Incident,
  TimeWindow
} from './reliabilityMetrics';

// Anomaly Detection
export {
  AnomalyDetector,
  Anomaly,
  AnomalyType,
  AnomalySeverity,
  AnomalyDetectionConfig,
  DEFAULT_ANOMALY_CONFIG
} from './anomalyDetection';

// Calendar Integration
export * from './calendar';
export { calendarTools } from './tools/calendarTools';

