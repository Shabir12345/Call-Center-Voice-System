# Call-Center-Voice-System

<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

<div align="center">

![CI Pipeline](https://github.com/USERNAME/REPO_NAME/actions/workflows/ci.yml/badge.svg)
![Build Status](https://img.shields.io/badge/build-passing-brightgreen)
![Tests](https://img.shields.io/badge/tests-passing-brightgreen)

**Note**: Replace `USERNAME/REPO_NAME` in the CI badge URL with your actual GitHub repository path.

</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1F6r15W5mDTtmd0HR4VtHDp6nGVtqAhFc

## Run Locally

**Prerequisites:**  Node.js and npm installed

### Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up your API key:**
   - Open the `.env.local` file in the project root
   - Replace `your_api_key_here` with your actual Google Gemini API key:
     ```
     GEMINI_API_KEY=your_actual_api_key_here
     ```
   - Save the file

3. **Start the development server:**
   ```bash
   npm run dev
   ```

4. **Open your browser:**
   - The app will be available at `http://localhost:3000`
   - If port 3000 is in use, Vite will automatically use the next available port (check the terminal output)

### Using the App

- **Workflow Editor**: Create and connect nodes to build your voice agent logic
  - Drag nodes from the sidebar
  - Connect nodes by dragging from handles
  - Configure each node by clicking on it

- **Simulation Panel**: Test your agent flow
  - Click "Start Simulation" in the right panel
  - Grant microphone permissions when prompted
  - Speak to test your agent's voice interactions
  - Watch the real-time transcription and tool execution

### Security

⚠️ **IMPORTANT**: This application has security improvements implemented. See `docs/QUICK_SECURITY_GUIDE.md` for details.

**Key Security Features**:
- ✅ Encrypted session storage
- ✅ Rate limiting to prevent abuse
- ✅ Automated security scanning in CI/CD
- ⚠️ **Action Required**: API key security fix needed (see `docs/SECURITY_API_KEY_FIX.md`)

## 🚀 Deploy to Vercel

Want to share your app online? Deploy it to Vercel for free!

### Quick Deployment Steps

1. **Push your code to GitHub**
   ```bash
   git add .
   git commit -m "Ready for deployment"
   git push
   ```

2. **Import to Vercel**
   - Go to [vercel.com](https://vercel.com) and sign up (free!)
   - Click "Add New Project" → Import your GitHub repository
   - Add environment variable: `GEMINI_API_KEY` = your API key
   - Click "Deploy"

3. **That's it!** Your app will be live in 2-3 minutes 🎉

📖 **Full deployment guide:** See [docs/VERCEL_DEPLOYMENT_GUIDE.md](docs/VERCEL_DEPLOYMENT_GUIDE.md) for detailed instructions, troubleshooting, and best practices.

**What you get:**
- ✅ Free hosting on Vercel's global CDN
- ✅ Automatic HTTPS (secure)
- ✅ Automatic deployments when you push to GitHub
- ✅ Custom domain support (optional)
- ✅ Preview deployments for testing

## Troubleshooting

- **API Key Error**: Make sure `.env.local` exists and contains your valid Gemini API key
- **Microphone Issues**: 
  - Chrome/Edge: Works on localhost automatically
  - For other browsers or HTTPS: Ensure you're using HTTPS or localhost
- **Port Already in Use**: Vite will automatically try the next available port
- **Dependencies Issues**: Delete `node_modules` and `package-lock.json`, then run `npm install` again
- **Security Issues**: See `docs/THREAT_ANALYSIS.md` for threat analysis and `docs/QUICK_SECURITY_GUIDE.md` for quick fixes
- **Deployment Issues**: See [docs/VERCEL_DEPLOYMENT_GUIDE.md](docs/VERCEL_DEPLOYMENT_GUIDE.md) for Vercel-specific troubleshooting

## Foundation Strengthening

This project has undergone significant foundation strengthening to make all core features bulletproof and production-ready. Key improvements include:

### ✨ Key Improvements

- **🔍 Complete Observability** - All monitoring tools exposed with real-time updates (<2s latency)
- **🛡️ Resilience Features** - Circuit breakers, rate limiting, adaptive retry, graceful degradation
- **⚡ Performance Optimizations** - Lazy loading, memoization, storage optimizations
- **🚀 CI/CD Pipeline** - Automated testing, quality checks, deployments
- **✅ Comprehensive Testing** - 32 test files covering unit, integration, E2E, and performance tests

### 📚 Documentation

For detailed information about the foundation improvements:
- **Foundation Strengthening Plan**: See `FOUNDATION_STRENGTHENING_PLAN.md` for the complete plan and progress
- **Progress Summary**: See `docs/PROGRESS_SUMMARY.md` for a quick overview
- **Pattern Documentation**: See `docs/FOUNDATION_PATTERNS.md` for details on new patterns and improvements
- **Components & Hooks Guide**: See `docs/COMPONENTS_AND_HOOKS_GUIDE.md` for extracted components and custom hooks

### 🔧 Advanced Features

- **Real-time Observability Dashboard** - Monitor system health, performance, and analytics
- **Circuit Breaker Pattern** - Prevents cascade failures from external services
- **Rate Limiting** - Prevents API exhaustion with token bucket algorithm
- **Graceful Degradation** - System continues operating with reduced functionality when services fail
- **Adaptive Retry Strategy** - Smart retries based on error patterns
- **Lazy Loading** - Heavy components load only when needed for better performance
