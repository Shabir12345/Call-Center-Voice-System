import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Initialize security checks
import { initializeSecurity, validateSecurityConfig } from './utils/securityHeaders';

// Run security initialization
initializeSecurity();

// Validate security configuration
const securityConfig = validateSecurityConfig();
if (!securityConfig.valid) {
  console.warn('⚠️  Security configuration issues detected:', securityConfig.issues);
  // In production, you might want to prevent app from loading
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ Security configuration invalid - app may not function correctly');
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);