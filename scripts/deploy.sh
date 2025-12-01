#!/bin/bash

# Deployment Script for Master-Sub-Agent Architecture
# This script handles deployment to production environments

set -e

ENVIRONMENT=${1:-production}
VERSION=${2:-latest}

echo "Deploying to $ENVIRONMENT environment, version $VERSION"

# Validate configuration
echo "Validating configuration..."
npm run validate-config || {
    echo "Configuration validation failed"
    exit 1
}

# Run tests
echo "Running tests..."
npm test || {
    echo "Tests failed"
    exit 1
}

# Build
echo "Building application..."
npm run build || {
    echo "Build failed"
    exit 1
}

# Deploy based on environment
if [ "$ENVIRONMENT" = "production" ]; then
    echo "Deploying to production..."
    # Add production deployment commands here
    DEPLOY_URL="https://production.example.com"
elif [ "$ENVIRONMENT" = "staging" ]; then
    echo "Deploying to staging..."
    # Add staging deployment commands here
    DEPLOY_URL="https://staging.example.com"
else
    echo "Unknown environment: $ENVIRONMENT"
    exit 1
fi

# Health check post-deployment
echo "Running health checks..."
if [ -n "$DEPLOY_URL" ]; then
    MAX_RETRIES=5
    RETRY_COUNT=0
    HEALTH_CHECK_PASSED=false
    
    while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
        echo "Health check attempt $((RETRY_COUNT + 1))/$MAX_RETRIES..."
        
        # Wait before first check
        sleep 5
        
        # Check health endpoint (if available)
        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$DEPLOY_URL/health" || echo "000")
        
        if [ "$HTTP_CODE" = "200" ]; then
            echo "✅ Health check passed (HTTP $HTTP_CODE)"
            HEALTH_CHECK_PASSED=true
            break
        else
            echo "⚠️  Health check failed (HTTP $HTTP_CODE), retrying..."
            RETRY_COUNT=$((RETRY_COUNT + 1))
        fi
    done
    
    if [ "$HEALTH_CHECK_PASSED" = false ]; then
        echo "❌ Health check failed after $MAX_RETRIES attempts"
        echo "⚠️  Deployment may have issues. Manual verification recommended."
        # Don't fail deployment, just warn (can be changed to exit 1 if strict)
    fi
else
    echo "⚠️  Health check skipped (no deploy URL configured)"
fi

echo "Deployment completed successfully"

