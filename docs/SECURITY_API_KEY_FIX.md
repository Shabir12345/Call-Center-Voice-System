# API Key Security Fix - Implementation Guide

## ⚠️ CRITICAL SECURITY ISSUE

**Current Problem**: API keys are exposed in the client-side bundle, making them accessible to anyone who views the page source or browser DevTools.

## Current Exposure

The `vite.config.ts` file currently exposes API keys to the client:

```typescript
define: {
  'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
  'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
}
```

This means the API key is bundled into the JavaScript that runs in the browser, where anyone can extract it.

## Recommended Solution: Backend API Proxy

### Step 1: Create Backend Server

Create a simple Node.js/Express server to proxy API calls:

**File: `server/index.ts`**
```typescript
import express from 'express';
import cors from 'cors';
import { GoogleGenAI } from '@google/genai';

const app = express();
app.use(cors());
app.use(express.json());

const client = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY 
});

app.post('/api/gemini/chat', async (req, res) => {
  try {
    // Validate request
    // Proxy to Gemini API
    // Return response
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(3001, () => {
  console.log('Backend server running on port 3001');
});
```

### Step 2: Update Client Code

**File: `utils/geminiClient.ts`**
- Change API calls to use `/api/gemini/*` endpoints instead of direct Gemini API
- Remove API key from client code

### Step 3: Update Vite Config

**File: `vite.config.ts`**
- Remove API key from `define` section
- Add proxy configuration:

```typescript
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:3001',
      changeOrigin: true
    }
  }
}
```

### Step 4: Environment Variables

**File: `.env` (server-side only)**
```
GEMINI_API_KEY=your_key_here
```

**File: `.env.example`**
```
# Server-side only - DO NOT commit actual keys
GEMINI_API_KEY=your_key_here
```

## Quick Fix (Temporary)

If you cannot implement a backend immediately:

1. **Rotate your API key** immediately
2. **Set usage limits** in Google Cloud Console
3. **Monitor usage** for unauthorized access
4. **Add rate limiting** (already implemented in `utils/rateLimiter.ts`)

## Implementation Priority

- **Immediate**: Rotate API key, set usage limits
- **Short-term**: Implement backend proxy (1-2 days)
- **Long-term**: Add authentication, request signing

## Testing

After implementing the backend:

1. Verify API key is NOT in client bundle:
   ```bash
   npm run build
   grep -r "GEMINI_API_KEY" dist/ || echo "✅ No API keys found"
   ```

2. Test API calls work through proxy
3. Verify rate limiting works
4. Check server logs for unauthorized access attempts

## Additional Security Measures

1. **Request Authentication**: Add API tokens for client requests
2. **Request Signing**: Sign requests to prevent tampering
3. **IP Whitelisting**: Restrict API access to known IPs
4. **Usage Monitoring**: Track and alert on unusual usage patterns

---

**Status**: ⚠️ Action Required  
**Severity**: Critical  
**Last Updated**: 2025-01-27

