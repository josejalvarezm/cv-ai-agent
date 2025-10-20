# CV Assistant Deployment Guide

## 🎯 Quick Reference

| Command | What It Does | When To Use |
|---------|-------------|-------------|
| `npm run deploy` | **Deploy to BOTH dev + production** | ✅ **DEFAULT - Use this 99% of the time** |
| `npm run deploy:full` | Build + deploy both + verify health | ✅ Full automated deployment with checks |
| `npm run deploy:dev` | Deploy only to dev/testing worker | ⚠️ Rare - only for testing before prod |
| `npm run deploy:production` | Deploy only to production worker | ⚠️ Rare - only if dev already deployed |
| `npm run deploy:both` | Build + deploy to both environments | ✅ Same as deploy:full but faster |

---

## 🏗️ Two-Worker Architecture

This project uses **TWO separate Cloudflare Workers**:

### 1️⃣ **Development/Testing Worker** (`cv-assistant-worker`)
- **URL**: `https://cv-assistant-worker.{YOUR_WORKERS_SUBDOMAIN}`
- **Purpose**: Testing, debugging, development
- **Authentication**: ❌ None (open for testing)
- **Deployed via**: `wrangler deploy` or `npm run deploy:dev`
- **wrangler.toml**: Default configuration (no `[env]` prefix)

### 2️⃣ **Production Worker** (`cv-assistant-worker-production`)
- **URL**: `https://cv-assistant-worker-production.{YOUR_WORKERS_SUBDOMAIN}`
- **Purpose**: Public chatbot, production traffic
- **Authentication**: ✅ Turnstile + JWT required
- **Deployed via**: `wrangler deploy --env production` or `npm run deploy:production`
- **wrangler.toml**: `[env.production]` configuration

---

## 🚀 Deployment Workflows

### **Option 1: Automated Deployment (Recommended)**

```powershell
# Deploy to BOTH workers automatically
npm run deploy:full
```

**What happens:**
1. ✅ Builds TypeScript → JavaScript
2. ✅ Deploys to **dev** worker
3. ✅ Deploys to **production** worker
4. ✅ Checks database schema
5. ✅ Verifies deployment health
6. ✅ Shows version IDs for both environments

---

### **Option 2: Quick Deploy (No Verification)**

```powershell
# Build + deploy both (faster, no health checks)
npm run deploy:both
```

---

### **Option 3: Manual Step-by-Step**

```powershell
# Step 1: Build TypeScript
npm run build

# Step 2: Deploy to dev
npm run deploy:dev

# Step 3: Deploy to production
npm run deploy:production

# Step 4: Verify health
npm run health
```

---

## 🔍 Testing Deployments

### **Test Dev Worker**
```powershell
curl "https://cv-assistant-worker.{YOUR_WORKERS_SUBDOMAIN}/health"
curl "https://cv-assistant-worker.{YOUR_WORKERS_SUBDOMAIN}/query?q=What+is+Terraform"
```

### **Test Production Worker**
```powershell
# Health check (no auth required)
curl "https://cv-assistant-worker-production.{YOUR_WORKERS_SUBDOMAIN}/health"

# Query (requires Turnstile + JWT from chatbot)
# Cannot test directly via curl - must use chatbot interface
```

---

## 📋 Pre-Deployment Checklist

Before deploying, ensure:

- [ ] TypeScript builds without errors: `npm run build`
- [ ] Tests pass (if any): `npm test`
- [ ] Database schema is up to date
- [ ] Environment variables configured in wrangler.toml
- [ ] Secrets configured: `TURNSTILE_SECRET_KEY`, `JWT_SECRET`

---

## 🔧 Environment Variables

### **Development Worker** (no `[env]` prefix)
```toml
[vars]
ENVIRONMENT = "development"
CACHE_TTL = "3600"
VECTORIZE_FALLBACK = "true"
AI_REPLY_ENABLED = "true"
```

### **Production Worker** (`[env.production]`)
```toml
[env.production]
vars = { 
  ENVIRONMENT = "production", 
  CACHE_TTL = "7200", 
  VECTORIZE_FALLBACK = "true", 
  AI_REPLY_ENABLED = "true" 
}
```

### **Secrets** (configured via `wrangler secret put`)
```powershell
# Set Turnstile secret for production
wrangler secret put TURNSTILE_SECRET_KEY --env production

# Set JWT secret for production
wrangler secret put JWT_SECRET --env production
```

---

## 🐛 Troubleshooting

### **Issue: "I deployed but chatbot still shows old version"**

**Solution:**
```powershell
# Always deploy to BOTH workers
npm run deploy

# Or use the full deployment script
npm run deploy:full
```

The chatbot uses the **production** worker (`cv-assistant-worker-production`), not the dev worker.

---

### **Issue: "Deployment succeeded but version ID not shown"**

**Solution:**
Check Cloudflare dashboard or run:
```powershell
wrangler deployments list
wrangler deployments list --env production
```

---

### **Issue: "Cache still returning old responses"**

**Solution:**
New deployments automatically clear Cloudflare cache. Wait 1-2 minutes for cache propagation, then test with a cache-busting parameter:
```powershell
curl "https://cv-assistant-worker-production.{YOUR_WORKERS_SUBDOMAIN}/query?q=test&v=$(date +%s)"
```

---

## 📊 Deployment History

Track deployments in Cloudflare dashboard:
1. Go to **Cloudflare Dashboard** → **Workers & Pages**
2. Select worker: `cv-assistant-worker` or `cv-assistant-worker-production`
3. Click **Deployments** tab
4. View version history, rollback if needed

---

## 🔐 Security Notes

### **Development Worker** (No Auth)
- Open for testing and debugging
- Should NOT be shared publicly
- Rate limits apply via Cloudflare

### **Production Worker** (Auth Required)
- Protected by Cloudflare Turnstile (CAPTCHA)
- JWT token required for queries
- Business hours enforcement (9am-9pm UTC)
- AI quota limits (2000 neurons/day)
- Salary/personal question blocking

---

## 📚 Related Documentation

- [wrangler.toml Configuration](./wrangler.toml)
- [AI Quota Management](./QUOTA_MANAGEMENT_COMPLETE.md)
- [Turnstile Integration](./TURNSTILE_INTEGRATION.md)
- [Skill Conflation Fix](./SKILL_CONFLATION_FIX_OCT20.md)

---

## 💡 Pro Tips

1. **Always use `npm run deploy`** - it deploys to both environments automatically
2. **Never deploy only to dev** - production will be out of sync
3. **Use `deploy:full`** for automated deployment with verification
4. **Check version IDs** - ensure both workers show new version
5. **Test production via chatbot** - direct curl won't work due to auth

---

## 🎉 Success Indicators

After deployment, verify:
- ✅ Dev worker health: `https://cv-assistant-worker.{YOUR_WORKERS_SUBDOMAIN}/health`
- ✅ Production worker health: `https://cv-assistant-worker-production.{YOUR_WORKERS_SUBDOMAIN}/health`
- ✅ Both workers show same version ID
- ✅ Chatbot returns updated responses
- ✅ No errors in Cloudflare logs

---

**Last Updated**: October 20, 2025
**Version**: 1.1.0 (Two-worker architecture with automated dual deployment)
