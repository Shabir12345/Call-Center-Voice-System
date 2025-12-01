# Components and Hooks Guide

**Last Updated**: 2025-01-27

This guide documents the newly extracted components and custom hooks created as part of the Foundation Strengthening Plan Phase 6 (Code Quality & Technical Debt).

---

## 📦 Extracted Components

### CallLogs Component

**Location**: `components/ui/CallLogs.tsx`

**Purpose**: Displays debug logs with expandable details, icons, and color coding.

**Features**:
- Structured log entry display
- Expandable details for each log entry
- Color coding based on log content (errors, warnings, info)
- Icons for different log types
- Optional max logs limit for performance

**Usage**:
```tsx
import { CallLogs, LogEntry } from './ui/CallLogs';

// In your component
<CallLogs logs={logs.filter(log => log.role === 'debug')} maxLogs={100} />
```

**Props**:
- `logs: LogEntry[]` - Array of log entries to display
- `maxLogs?: number` - Optional limit on number of logs to display

**LogEntry Interface**:
```typescript
interface LogEntry {
  id: string;
  role: 'debug' | 'system' | 'user' | 'agent';
  text: string;
  timestamp: Date;
  details?: any;
}
```

**Benefits**:
- ✅ Reusable across different components
- ✅ Better code organization
- ✅ Improved maintainability
- ✅ Consistent log display styling

### VoiceControls Component

**Location**: `components/ui/VoiceControls.tsx`

**Purpose**: Displays voice call controls including start/end call buttons, session duration, and mute functionality.

**Features**:
- Start/end call button controls
- Session duration display (MM:SS format)
- Mute/unmute microphone button (optional)
- API key error handling
- Disabled state support
- Powered by Gemini badge

**Usage**:
```tsx
import { VoiceControls } from './ui/VoiceControls';

// In your component
<VoiceControls
  isCallActive={isCallActive}
  sessionDuration={sessionDuration}
  apiKeyError={apiKeyError}
  onStartCall={startCall}
  onEndCall={endCall}
  onMute={handleMute}
  isMuted={isMuted}
/>
```

**Props**:
- `isCallActive: boolean` - Whether a call is currently active
- `sessionDuration: number` - Current session duration in seconds
- `apiKeyError: boolean` - Whether there's an API key error
- `onStartCall: () => void` - Callback when start button is clicked
- `onEndCall: () => void` - Callback when end button is clicked
- `onMute?: () => void` - Optional callback for mute/unmute
- `isMuted?: boolean` - Optional muted state
- `disabled?: boolean` - Optional disabled state

**Benefits**:
- ✅ Reusable voice control UI
- ✅ Better code organization
- ✅ Improved maintainability
- ✅ Consistent UI styling
- ✅ Accessible controls with ARIA labels

### MetricsDisplay Component

**Location**: `components/ui/MetricsDisplay.tsx`

**Purpose**: Displays session metrics in a compact stats bar format including duration, resolutions, and architecture statistics.

**Features**:
- Session duration display (MM:SS format)
- Resolution status with visual indicators
- Architecture stats (department and tool counts)
- Download log button (optional)
- Compact, information-dense layout

**Usage**:
```tsx
import { MetricsDisplay } from './ui/MetricsDisplay';

// In your component
<MetricsDisplay
  sessionDuration={sessionDuration}
  metrics={{
    totalInteractions: 5,
    successfulResolutions: 2,
    isSessionResolved: true
  }}
  departmentCount={3}
  toolCount={5}
  onDownloadLog={() => {
    // Handle log download
  }}
/>
```

**Props**:
- `sessionDuration: number` - Current session duration in seconds
- `metrics: object` - Metrics object with:
  - `totalInteractions: number` - Total number of interactions
  - `successfulResolutions: number` - Number of successful resolutions
  - `isSessionResolved: boolean` - Whether session is resolved
- `departmentCount: number` - Number of department nodes
- `toolCount: number` - Number of tool/agent nodes
- `onDownloadLog?: () => void` - Optional callback for log download

**Benefits**:
- ✅ Reusable metrics display
- ✅ Better code organization
- ✅ Consistent UI styling
- ✅ Clean separation of concerns
- ✅ Easy to test and maintain

---

## 🪝 Custom Hooks

### useVoiceSession Hook

**Location**: `hooks/useVoiceSession.ts`

**Purpose**: Manages voice session state and lifecycle, including audio context, Gemini client, and session duration.

**Features**:
- Voice call state management (active/inactive)
- Session duration tracking
- Audio context lifecycle management
- Gemini client lifecycle management
- Automatic cleanup on unmount
- Callback support for call events

**Usage**:
```tsx
import { useVoiceSession } from '../hooks/useVoiceSession';

// In your component
const {
  isCallActive,
  sessionDuration,
  activeAgentId,
  geminiRef,
  audioContextRef,
  analyserRef,
  nextStartTimeRef,
  startCall,
  endCall,
  getSessionState,
  setActiveAgentId
} = useVoiceSession({
  apiKey: process.env.API_KEY,
  callbacks: {
    onCallStart: () => console.log('Call started'),
    onCallEnd: () => console.log('Call ended'),
    onError: (error) => console.error('Call error:', error)
  }
});
```

**Return Values**:

**State**:
- `isCallActive: boolean` - Whether a call is currently active
- `sessionDuration: number` - Duration of the current session in seconds
- `activeAgentId: string | null` - ID of the currently active agent

**Refs** (exposed for external use):
- `geminiRef: React.MutableRefObject<GeminiClient | null>` - Reference to Gemini client
- `audioContextRef: React.MutableRefObject<AudioContext | null>` - Reference to audio context
- `analyserRef: React.MutableRefObject<AnalyserNode | null>` - Reference to audio analyser
- `nextStartTimeRef: React.MutableRefObject<number>` - Reference to next audio start time

**Methods**:
- `startCall(masterNodeId: string, establishSessionFn: Function)` - Start a voice call session
- `endCall()` - End the current voice call session
- `getSessionState(): VoiceSessionState` - Get current session state
- `setActiveAgentId(id: string | null)` - Set the active agent ID

**Options**:
```typescript
interface UseVoiceSessionOptions {
  apiKey?: string;
  callbacks?: {
    onCallStart?: () => void;
    onCallEnd?: () => void;
    onError?: (error: Error) => void;
  };
}
```

**Benefits**:
- ✅ Separates voice session logic from UI components
- ✅ Reusable across different components
- ✅ Automatic cleanup prevents memory leaks
- ✅ Better testability
- ✅ Consistent session management patterns

---

## 🎯 Extracting Components and Hooks

### When to Extract

Extract a component or hook when:

1. **Reusability**: The code is used in multiple places
2. **Complexity**: A single component/hook is handling too many responsibilities
3. **Testability**: The code is hard to test in its current form
4. **Readability**: The code is difficult to understand or navigate
5. **Maintainability**: Changes affect multiple concerns

### Extraction Guidelines

**For Components**:
- Keep components focused on a single responsibility
- Use TypeScript interfaces for props
- Include JSDoc comments
- Export types/interfaces for reuse
- Consider performance (memoization, lazy loading)

**For Hooks**:
- Encapsulate related state and logic
- Return clear, well-named values
- Handle cleanup in useEffect
- Support callbacks for extensibility
- Document dependencies and side effects

---

## 📋 Planned Extractions (Phase 6)

### Hooks (In Progress)
- ✅ `useVoiceSession.ts` - Voice session management
- ⬜ `useToolExecution.ts` - Tool execution logic
- ⬜ `useAgentCommunication.ts` - Agent communication
- ⬜ `useObservability.ts` - Observability integration

### Components (In Progress)
- ✅ `CallLogs.tsx` - Log display component
- ✅ `VoiceControls.tsx` - Voice UI controls
- ✅ `MetricsDisplay.tsx` - Metrics stats bar component
- ⬜ `ActiveNodeVisualization.tsx` - Node visualization
- ⬜ `MetricsDisplay.tsx` - Metrics UI

---

## 🔧 Integration with TestPanel

These extracted components and hooks are being integrated into `TestPanel.tsx` to:

1. **Reduce Complexity**: Break down the 2700+ line component
2. **Improve Maintainability**: Easier to find and modify code
3. **Enable Reuse**: Components can be used elsewhere
4. **Better Testing**: Smaller units are easier to test

**Progress**: 20% complete
- ✅ CallLogs component extracted and integrated
- ✅ useVoiceSession hook created
- ⬜ Additional extractions in progress

---

## 📚 Related Documentation

- **Foundation Strengthening Plan**: `FOUNDATION_STRENGTHENING_PLAN.md`
- **Progress Summary**: `docs/PROGRESS_SUMMARY.md`
- **Pattern Documentation**: `docs/FOUNDATION_PATTERNS.md`

---

## 🎉 Benefits Achieved

✅ **Code Organization** - Better structure and separation of concerns  
✅ **Reusability** - Components and hooks can be used across the application  
✅ **Maintainability** - Easier to find, understand, and modify code  
✅ **Testability** - Smaller units are easier to test  
✅ **Performance** - Opportunities for optimization (memoization, lazy loading)  
✅ **Type Safety** - Clear interfaces and types

---

**Status**: In Progress  
**Last Updated**: 2025-01-27

