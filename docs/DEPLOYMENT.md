# Deployment Guide

## Pre-Deployment Checklist

- [ ] All tests passing
- [ ] Configuration validated
- [ ] Environment variables set
- [ ] **HTTPS configured and enforced** ⚠️
- [ ] **Security headers configured** ⚠️
- [ ] **API keys moved to backend (not in client)** ⚠️
- [ ] Monitoring configured
- [ ] Backup strategy in place
- [ ] Rollback plan ready

## Deployment Steps

### 1. Validate Configuration

```bash
npm run validate-config
```

### 2. Run Tests

```bash
npm test
```

### 3. Build

```bash
npm run build
```

### 4. Deploy

```bash
./scripts/deploy.sh production
```

## Environment Setup

### Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Run tests
npm test
```

### Staging

```bash
# Build for staging
npm run build:staging

# Deploy to staging
./scripts/deploy.sh staging
```

### Production

```bash
# Build for production
npm run build:production

# Deploy to production
./scripts/deploy.sh production
```

## Environment Variables

Required environment variables:

```bash
# API Keys
GEMINI_API_KEY=your_key

# Logging
LOG_LEVEL=info
MAX_LOGS=10000

# Performance
MAX_SESSIONS=10000
SESSION_TIMEOUT_MS=1800000

# Monitoring
ENABLE_MONITORING=true
HEALTH_CHECK_INTERVAL_MS=60000
```

## Security Requirements

### HTTPS Enforcement

**CRITICAL**: Production deployments MUST use HTTPS.

1. **Configure SSL/TLS Certificate**:
   - Use a valid SSL certificate (Let's Encrypt, commercial, etc.)
   - Configure your web server (nginx, Apache, etc.) to use HTTPS
   - Set up automatic HTTP to HTTPS redirects

2. **Security Headers**:
   Add these headers to your server configuration:
   ```
   Strict-Transport-Security: max-age=31536000; includeSubDomains
   X-Content-Type-Options: nosniff
   X-Frame-Options: DENY
   X-XSS-Protection: 1; mode=block
   Content-Security-Policy: default-src 'self'
   ```

3. **Verify HTTPS**:
   ```bash
   # Check if site uses HTTPS
   curl -I https://your-domain.com
   
   # Should return 200 OK with security headers
   ```

### API Key Security

**CRITICAL**: API keys must NOT be in client code.

1. **Backend Proxy Required**:
   - See `docs/SECURITY_API_KEY_FIX.md` for implementation
   - API keys should only exist on the server
   - Client makes requests to your backend, backend calls Gemini API

2. **Verify No Keys in Bundle**:
   ```bash
   npm run build
   grep -r "GEMINI_API_KEY" dist/ || echo "✅ No API keys found"
   ```

## Post-Deployment

1. **Verify Health**: Check health endpoint
2. **Verify HTTPS**: Ensure site loads over HTTPS
3. **Check Security Headers**: Verify headers are present
4. **Monitor Metrics**: Watch performance metrics
5. **Check Logs**: Review error logs
6. **Test Functionality**: Run smoke tests
7. **Monitor Alerts**: Watch for alerts

## Rollback Procedure

1. Stop new deployments
2. Revert to previous version
3. Restore previous configuration
4. Verify system health
5. Monitor for issues

## Troubleshooting

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for common issues and solutions.

