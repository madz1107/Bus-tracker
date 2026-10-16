# 🚀 Deployment Guide: Deploy to Vercel & Render via GitHub

This project is fully configured and production-ready for deployment on **Vercel** and **Render**.

---

## 📁 Pre-configured Deployment Files

The following deployment configurations have already been created for you:
1. `server.js` - Production Node.js Express server with all REST endpoints (`/api/routes`, `/api/buses`, `/api/auth`, etc.) and static asset serving.
2. `vercel.json` - Vercel Serverless Function configuration with API routing.
3. `api/index.js` - Serverless entrypoint for Vercel.
4. `render.yaml` - Render Web Service blueprint.
5. `.gitignore` - Excludes `node_modules` and system files from your GitHub repo.
6. `package.json` - Configured with `"start": "node server.js"` and Node.js engines.

---

## Step 1: Push Code to GitHub Repository

### Method A: Using VS Code (Easiest - 1 Minute)
Since you already have VS Code open:
1. Press `Ctrl + Shift + G` (or click the **Source Control** icon on the left sidebar).
2. Click **"Initialize Repository"**.
3. In the message box, type: `Initial commit for deployment`.
4. Click the **Commit** button (or press `Ctrl + Enter`).
5. Click **"Publish Branch"** to GitHub.
6. Select **"Publish to GitHub public repository"** (or private).
7. Done! Your code is now live on GitHub!

---

### Method B: Using Git Command Line
If you have Git installed in your terminal:
```bash
git init
git add .
git commit -m "Initial commit for Vercel & Render deployment"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/smart-bus-tracking.git
git push -u origin main
```

---

## Step 2: Deploy to Vercel (Free Serverless Hosting)

1. Open [https://vercel.com](https://vercel.com) and log in with your **GitHub** account.
2. Click **"Add New..."** ➔ **"Project"**.
3. Under *Import Git Repository*, find your `smart-bus-tracking` repository and click **"Import"**.
4. **Project Settings**:
   - Framework Preset: **Other** (Vercel automatically detects `vercel.json`).
   - Root Directory: `./`
   - Build & Output Settings: Leave as default.
5. Click **"Deploy"**.
6. In about 30 seconds, Vercel will give you a live URL like:
   `https://smart-bus-tracking-xxxx.vercel.app`

---

## Step 3: Deploy to Render (Free Cloud Web Service)

1. Open [https://render.com](https://render.com) and log in with your **GitHub** account.
2. Click **"New +"** (top right) ➔ **"Web Service"**.
3. Select **"Build and deploy from a Git repository"** and choose `smart-bus-tracking`.
4. Configure the settings:
   - **Name**: `smart-bus-tracking`
   - **Region**: Closest to you (e.g. *Singapore* or *Frankfurt*)
   - **Branch**: `main`
   - **Root Directory**: Leave blank
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Instance Type**: `Free`
5. Click **"Create Web Service"**.
6. Render will build and deploy your app with a live URL like:
   `https://smart-bus-tracking.onrender.com`

---

## ✅ Verification
Once deployed on Vercel or Render:
- Open your live URL on any mobile phone or PC.
- Test passenger live bus priority & radar tracking.
- Test Conductor live GPS broadcast from your smartphone.
- Test Admin route management & live fleet status.
