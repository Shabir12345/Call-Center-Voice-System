# Vercel Deployment Guide

Complete guide for deploying your Call Center Voice System to Vercel via GitHub.

## 📋 Prerequisites

Before starting, make sure you have:
- ✅ A GitHub account
- ✅ A Vercel account (sign up at [vercel.com](https://vercel.com) - it's free!)
- ✅ Your code ready to deploy
- ✅ A Google Gemini API key

## 🚀 Step-by-Step Deployment

### Step 1: Prepare Your Code for GitHub

1. **Make sure your `.gitignore` is up to date** (already configured!)
   - It excludes `node_modules`, `.env`, and other sensitive files

2. **Test your build locally first:**
   ```bash
   npm run build
   ```
   - If this works without errors, you're ready to deploy!

### Step 2: Push Code to GitHub

#### Option A: If you don't have a GitHub repository yet

1. **Create a new repository on GitHub:**
   - Go to [github.com](https://github.com)
   - Click the "+" icon → "New repository"
   - Name your repository (e.g., "call-center-voice-system")
   - Choose public or private
   - **Don't** initialize with README, .gitignore, or license (we already have these)
   - Click "Create repository"

2. **Initialize git and push (if not already done):**
   ```bash
   # Initialize git (if not already initialized)
   git init
   
   # Add all files
   git add .
   
   # Create your first commit
   git commit -m "Initial commit: Ready for deployment"
   
   # Add your GitHub repository as remote (replace YOUR_USERNAME and REPO_NAME)
   git remote add origin https://github.com/YOUR_USERNAME/REPO_NAME.git
   
   # Push to GitHub
   git branch -M main
   git push -u origin main
   ```

#### Option B: If you already have a GitHub repository

1. **Just push your latest changes:**
   ```bash
   git add .
   git commit -m "Prepare for Vercel deployment"
   git push
   ```

### Step 3: Deploy to Vercel

#### 3.1 Connect GitHub to Vercel

1. **Go to Vercel:**
   - Visit [vercel.com](https://vercel.com)
   - Sign up or log in (you can use your GitHub account to sign up)

2. **Import your GitHub repository:**
   - Click "Add New..." → "Project"
   - Click "Import Git Repository"
   - Select your GitHub repository
   - Click "Import"

#### 3.2 Configure Project Settings

Vercel should automatically detect your project settings:

- **Framework Preset:** Vite (should auto-detect)
- **Root Directory:** `./` (root)
- **Build Command:** `npm run build` (already configured in `vercel.json`)
- **Output Directory:** `dist` (already configured in `vercel.json`)
- **Install Command:** `npm install` (already configured)

**You don't need to change anything** - our `vercel.json` file has everything configured!

#### 3.3 Set Environment Variables

This is **CRITICAL** for your app to work:

1. **In the Vercel project configuration page**, scroll down to "Environment Variables"

2. **Add the following REQUIRED environment variables:**
   
   **For LLM Functionality:**
   - **Name:** `GEMINI_API_KEY`
   - **Value:** Your actual Google Gemini API key
   - **Environment:** Select all three (Production, Preview, Development)
   
   **For Database Connection (if using Supabase):**
   - **Name:** `VITE_SUPABASE_URL`
   - **Value:** Your Supabase project URL (e.g., `https://xxxxx.supabase.co`)
   - **Environment:** Select all three (Production, Preview, Development)
   
   - **Name:** `VITE_SUPABASE_ANON_KEY`
   - **Value:** Your Supabase anonymous key (safe for client-side)
   - **Environment:** Select all three (Production, Preview, Development)
   
   ⚠️ **Important:** 
   - Do NOT add `SUPABASE_SERVICE_ROLE_KEY` to Vercel if deploying frontend only
   - Service role key should only be used in server-side/backend code

3. **Optional environment variables** (if you want to customize):
   - `LOG_LEVEL` - Set to `info`, `debug`, `warn`, or `error` (default: `info`)
   - `MAX_LOGS` - Maximum number of logs (default: `10000`)
   - `MAX_SESSIONS` - Maximum sessions (default: `10000`)
   - `SESSION_TIMEOUT_MS` - Session timeout in milliseconds (default: `1800000` = 30 minutes)

4. **Click "Deploy"** at the bottom of the page

#### 3.4 Wait for Deployment

- Vercel will:
  1. Install dependencies (`npm install`)
  2. Build your project (`npm run build`)
  3. Deploy it to a global CDN

- This usually takes 2-3 minutes
- You'll see progress in real-time
- If there are any errors, they'll be shown clearly

### Step 4: Access Your Live Application

Once deployment is complete:

1. **Vercel will show you your live URL:**
   - It looks like: `https://your-project-name.vercel.app`
   - You can click on it to open your app!

2. **Your app is now live! 🎉**
   - Anyone with the URL can access it
   - It's automatically served over HTTPS (secure)

## 🔄 Future Updates

Every time you push code to GitHub:

1. **Make your changes locally**

2. **Commit and push:**
   ```bash
   git add .
   git commit -m "Description of your changes"
   git push
   ```

3. **Vercel automatically:**
   - Detects the push
   - Builds your project
   - Deploys the new version
   - Usually takes 2-3 minutes

4. **You'll get a notification** when deployment is complete!

## 🔐 Security Best Practices

### ⚠️ Important: API Key Security

Currently, your API key is exposed in the client-side bundle. This is a known security issue.

**For now (Quick Solution):**
- The API key is set in Vercel's environment variables
- It will be embedded in the build at build-time
- **Don't share your API key publicly**

**Better Solution (Recommended for Production):**
- Move API calls to a backend server
- Keep API keys only on the server
- See `docs/SECURITY_API_KEY_FIX.md` for details

## 🌐 Custom Domain (Optional)

Want to use your own domain?

1. In your Vercel project, go to "Settings" → "Domains"
2. Enter your domain name
3. Follow the DNS configuration instructions
4. Vercel will automatically handle HTTPS certificates

## 📊 Monitoring & Analytics

Vercel provides:
- **Deployment logs** - See build errors and warnings
- **Analytics** - View visitor statistics (may require upgrade)
- **Real-time logs** - Monitor your application in real-time

## 🐛 Troubleshooting

### Build Fails

**Problem:** Build fails with errors

**Solution:**
1. Check the build logs in Vercel
2. Try building locally: `npm run build`
3. Make sure all dependencies are in `package.json`
4. Check that environment variables are set correctly

### App Doesn't Work After Deployment

**Problem:** App loads but doesn't function

**Solution:**
1. **Check environment variables:**
   - Go to Vercel project → Settings → Environment Variables
   - Make sure `GEMINI_API_KEY` is set correctly
   - Make sure it's enabled for "Production" environment

2. **Check browser console:**
   - Open your deployed app
   - Press F12 to open developer tools
   - Look at the Console tab for errors

3. **Verify API key:**
   - Make sure your Gemini API key is valid
   - Check if there are any usage limits

### Environment Variables Not Working

**Problem:** Environment variables seem to be missing

**Solution:**
1. After adding/updating environment variables, **you must redeploy**
2. Go to Vercel → Deployments → Click the three dots on latest deployment → "Redeploy"
3. Or just push a new commit to trigger a new deployment

### Routing Issues (404 errors)

**Problem:** Direct URLs or page refreshes show 404

**Solution:**
- Already handled! Our `vercel.json` includes rewrite rules that send all routes to `index.html`
- This enables client-side routing to work correctly

## ✅ Deployment Checklist

Before deploying, make sure:

- [ ] Code builds successfully locally (`npm run build`)
- [ ] All tests pass (if you have tests: `npm test`)
- [ ] `.gitignore` excludes sensitive files (`.env`, `node_modules`)
- [ ] `vercel.json` is present in the project root
- [ ] Environment variables are ready to add in Vercel
- [ ] You've committed all your changes

## 📝 Quick Reference Commands

```bash
# Build locally to test
npm run build

# Preview production build locally
npm run preview

# Check what will be committed to git
git status

# Push to GitHub (triggers auto-deployment on Vercel)
git add .
git commit -m "Your commit message"
git push
```

## 🎉 You're All Set!

Your application is now:
- ✅ On GitHub (version controlled)
- ✅ Deployed on Vercel (live on the internet)
- ✅ Accessible to anyone with the URL
- ✅ Automatically updated when you push to GitHub
- ✅ Served over HTTPS (secure)

Enjoy sharing your Call Center Voice System with the world! 🚀

## 📚 Additional Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Vite Deployment Guide](https://vitejs.dev/guide/static-deploy.html#vercel)
- [GitHub Documentation](https://docs.github.com)

## 💡 Tips

1. **Use Preview Deployments:**
   - Every pull request gets its own preview URL
   - Test changes before merging to main

2. **Monitor Your API Usage:**
   - Keep track of your Gemini API usage
   - Set up alerts if needed

3. **Backup Your Environment Variables:**
   - Save them somewhere safe
   - Don't commit them to GitHub!

