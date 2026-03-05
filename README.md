# TamilPSD Admin Panel v6 — Standalone

## 🚀 Setup Guide

### 1. Create New GitHub Repo
Create a NEW repo for this admin panel (e.g., `tamilpsd-admin`)
Upload these files to it:
```
index.html
netlify.toml
netlify/functions/adminAuth.js
netlify/functions/adminProcessor.js
netlify/functions/package.json
```

### 2. Connect to Netlify
- New site from GitHub → select the admin repo
- Build command: `echo done`
- Publish directory: `.`

### 3. Set Environment Variables in Netlify
Go to: Site Settings → Environment Variables → Add these:

| Variable | Value | Description |
|----------|-------|-------------|
| `ADMIN_PASSWORD` | your-secret-password | Admin login password |
| `GITHUB_TOKEN` | ghp_xxx... | GitHub Personal Access Token (repo scope) |
| `GITHUB_OWNER` | moorthiguru33 | Your GitHub username |
| `GITHUB_REPO` | kicksliygurulhg | Your main website repo name |
| `GITHUB_BRANCH` | main | Branch name |
| `CLOUDINARY_CLOUD_NAME` | dnnernn5b | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | your-key | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | your-secret | Cloudinary API secret |
| `GROQ_KEY_1` | gsk_xxx... | Groq API Key 1 |
| `GROQ_KEY_2` | gsk_xxx... | Groq API Key 2 (optional) |
| `ADMIN_ORIGIN` | https://your-admin.netlify.app | Your admin panel URL |

### 4. Update CORS on Main Site's adminProcessor
In your MAIN website's `netlify/functions/adminProcessor.js`, add your admin panel URL to the allowed origins.

### 5. GitHub Token Setup
Go to: github.com → Settings → Developer Settings → Personal Access Tokens → Fine-grained
- Select repo: kicksliygurulhg
- Permissions: Contents (read/write)

---

## 📋 Features
- 📊 **Excel Processor** — Upload images → AI generates SEO → Updates designs.xlsx
- ⚙️ **Site Settings** — Hero BG, pricing, toggles, social links, hero text
- 👑 **VIP Emails** — Add/remove/bulk VIP members, push to GitHub
- 📢 **Ads Manager** — Popup, top, sidebar, footer ad images
- ✂️ **BG Remover** — Batch background removal (local, no server)
- 🚀 **GitHub Push** — All changes pushed in one click
- 📈 **Dashboard** — Stats, category breakdown, system status

## ⚠️ Important Notes
- Admin panel is on a SEPARATE Netlify site from your main website
- All GitHub pushes go to your MAIN website repo
- VIP emails pushed as `vip-emails.txt` (plain) — main site's build process hashes them
- Background remover works locally in browser, no API needed
