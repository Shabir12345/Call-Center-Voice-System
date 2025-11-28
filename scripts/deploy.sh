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
elif [ "$ENVIRONMENT" = "staging" ]; then
    echo "Deploying to staging..."
    # Add staging deployment commands here
else
    echo "Unknown environment: $ENVIRONMENT"
    exit 1
fi

echo "Deployment completed successfully"

