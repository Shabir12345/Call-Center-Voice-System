# ✅ Deployment Readiness Checklist

Use this checklist to ensure your application is ready for deployment to Vercel.

## 🔍 Pre-Deployment Checks

### 1. Code Configuration ✅

- [x] **Package.json Updated**
  - ✅ Added `@supabase/supabase-js` dependency
  - ✅ Build scripts configured correctly
  - ✅ All dependencies listed

- [x] **Vite Configuration**
  - ✅ Environment variables properly configured
  - ✅ Supports both local (.env) and Vercel environment variables
  - ✅ API key configuration ready

- [x] **Vercel Configuration**
  - ✅ `vercel.json` file created
  - ✅ Build commands configured
  - ✅ Routing configured for SPA
  - ✅ Security headers included

### 2. Environment Variables Required

**For Local Development:**
Create `.env.local` file with:
```env
GEMINI_API_KEY=your_key
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
```

**For Vercel Deployment:**
Set these in Vercel Dashboard → Settings → Environment Variables:
- [ ] `GEMINI_API_KEY` - Required for LLM functionality
- [ ] `VITE_SUPABASE_URL` - Required for database connection
- [ ] `VITE_SUPABASE_ANON_KEY` - Required for database connection

### 3. Dependencies Check

- [x] **Supabase Client** - Added to package.json
- [x] **Google Gemini** - Already in package.json
- [x] **React & React DOM** - Already in package.json
- [x] **All other dependencies** - Verified

### 4. Build Test

Run locally before deploying:
```bash
npm install
npm run build
```

- [ ] Build completes without errors
- [ ] No missing dependencies
- [ ] No TypeScript errors

### 5. Database Connection

- [ ] Supabase project created
- [ ] Database tables set up (see `docs/SUPABASE_TABLES_SETUP.md`)
- [ ] Environment variables configured
- [ ] Connection test passes (optional: `npm run test:supabase`)

### 6. LLM Connection

- [ ] Google Gemini API key obtained
- [ ] API key added to environment variables
- [ ] Key is valid and has quota

## 🚀 Deployment Steps

### Step 1: Push to GitHub ✅

```bash
git add .
git commit -m "Prepare for deployment: Add Supabase, fix environment variables"
git push
```

### Step 2: Deploy to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Import your GitHub repository
3. Configure environment variables (see above)
4. Deploy

### Step 3: Verify Deployment

- [ ] App loads without errors
- [ ] No console errors in browser DevTools
- [ ] LLM connection works (test voice simulation)
- [ ] Database connection works (if applicable)

## ⚠️ Important Notes

### Security
- ⚠️ **API Key Exposure**: Currently, the Gemini API key is embedded in the client bundle. This is acceptable for initial deployment but should be moved to a backend proxy for production use (see `docs/SECURITY_API_KEY_FIX.md`).

### Environment Variables
- Client-side: Use `VITE_` prefix (exposed to browser)
- Server-side: Use regular names (only in backend)
- **Never commit `.env.local`** - it's in `.gitignore`

### Supabase
- Anon key is safe for client-side use (uses Row Level Security)
- Service role key should NEVER be exposed to client
- Service role key is only needed for backend/server operations

## 🐛 Troubleshooting

### Build Fails
- Check Vercel build logs
- Verify all dependencies are in package.json
- Ensure environment variables are set in Vercel

### App Doesn't Load
- Check browser console for errors
- Verify environment variables are set correctly
- Check network tab for failed API calls

### API Key Errors
- Verify `GEMINI_API_KEY` is set in Vercel
- Check that the key is valid
- Ensure key has usage quota

### Database Errors
- Verify Supabase URL and keys are correct
- Check Supabase dashboard for connection issues
- Verify tables are created (see setup docs)

## 📚 Documentation

- Full deployment guide: `docs/VERCEL_DEPLOYMENT_GUIDE.md`
- Supabase setup: `docs/SUPABASE_SETUP.md`
- Security guide: `docs/SECURITY_API_KEY_FIX.md`

## ✅ Final Checklist Before Push

- [ ] All code changes committed
- [ ] Build test passes locally
- [ ] Environment variables documented
- [ ] README updated with deployment info
- [ ] Ready to push to GitHub!

---

**Status:** 🟢 Ready for deployment (pending environment variable configuration in Vercel)

