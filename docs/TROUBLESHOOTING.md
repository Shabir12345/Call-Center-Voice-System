# Troubleshooting Guide

## Common Issues and Solutions

### Issue: Agent Not Responding

**Symptoms**:
- No response from agent
- Timeout errors
- Agent appears offline

**Solutions**:
1. Check agent registration:
   ```typescript
   const stats = orchestrator.getStatistics();
   console.log(stats.agents);
   ```

2. Check communication manager:
   ```typescript
   const commManager = orchestrator.getCommunicationManager();
   const stats = commManager.getStatistics();
   ```

3. Check logs:
   ```typescript
   const logs = await logger.queryLogs({ level: 'error' });
   ```

### Issue: Session Expired

**Symptoms**:
- "Session expired" messages
- Lost conversation context

**Solutions**:
1. Increase session timeout:
   ```typescript
   const stateManager = new StateManager('session', {
     sessionTimeoutMs: 60 * 60 * 1000 // 1 hour
   });
   ```

2. Implement session resumption:
   ```typescript
   const session = await sessionManager.resumeSession(sessionId);
   ```

### Issue: High Error Rate

**Symptoms**:
- Many failed requests
- Error rate alerts

**Solutions**:
1. Check performance metrics:
   ```typescript
   const metrics = performanceMonitor.getMetrics();
   console.log(metrics.errorRate);
   ```

2. Check health status:
   ```typescript
   const health = await healthChecker.checkHealth();
   console.log(health);
   ```

3. Review error logs:
   ```typescript
   const errorLogs = await logger.queryLogs({ level: 'error' });
   ```

### Issue: Slow Response Times

**Symptoms**:
- Long wait times
- Timeout errors

**Solutions**:
1. Check performance metrics:
   ```typescript
   const metrics = performanceMonitor.getMetrics();
   console.log(metrics.responseTime);
   ```

2. Enable caching:
   ```typescript
   const cache = CacheManagerFactory.getCache('responses');
   ```

3. Optimize sub-agent timeouts:
   ```typescript
   const config = {
     communication: {
       timeout: 15000 // Reduce timeout
     }
   };
   ```

### Issue: Intent Not Recognized

**Symptoms**:
- "I didn't understand" responses
- Low confidence scores

**Solutions**:
1. Check intent recognizer:
   ```typescript
   const intentResult = await intentRecognizer.parse(input, context);
   console.log(intentResult);
   ```

2. Add custom patterns:
   ```typescript
   intentRecognizer.addIntentPattern('my_intent', [
     /pattern1/i,
     /pattern2/i
   ]);
   ```

3. Improve system prompt in master agent config

### Issue: Configuration Errors

**Symptoms**:
- Validation errors
- System won't start

**Solutions**:
1. Validate configuration:
   ```typescript
   const validator = new ConfigValidator();
   const result = validator.validateSystemConfig(config);
   if (!result.valid) {
     console.error(result.errors);
   }
   ```

2. Check template validity:
   ```typescript
   const result = validator.validateTemplate(template);
   ```

## Debugging Tips

### Enable Debug Logging

```typescript
const logger = new CentralLogger('in-memory', {
  logLevel: 'debug'
});
```

### Check Active Sessions

```typescript
const sessions = await stateManager.getActiveSessions();
console.log(sessions);
```

### Monitor Performance

```typescript
const monitor = new PerformanceMonitor(logger);
const metrics = monitor.getMetrics();
console.log(metrics);
```

### Check Health

```typescript
const health = await healthChecker.checkHealth();
console.log(health);
```

## Getting Help

1. Check logs for error details
2. Review performance metrics
3. Check health status
4. Validate configurations
5. Review documentation

