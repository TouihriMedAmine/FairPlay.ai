# 🚀 Deployment Guide

This guide explains how to deploy your FairPlay AI application using GitHub Actions.

## 📋 Prerequisites

Before setting up deployment, you need:

1. **GitHub repository** (private or public)
2. **Deployment platform account** (Railway, Heroku, etc.)
3. **GitHub Actions enabled** on your repository

## 🔧 Setup Options

### Option 1: Deploy to Railway (Recommended)

**Step 1: Create Railway Account**
1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub
3. Create a new project

**Step 2: Get Railway Token**
1. Go to Railway Dashboard → Account → Tokens
2. Create a new token
3. Copy the token

**Step 3: Set GitHub Secrets**
1. Go to your GitHub repo → Settings → Secrets and variables → Actions
2. Add these secrets:
   - `RAILWAY_TOKEN`: Your Railway token
   - `RAILWAY_SERVICE`: Your Railway service name

**Step 4: Enable GitHub Actions**
1. The `.github/workflows/deploy.yml` file will automatically run
2. Push to main/master branch to trigger deployment

### Option 2: Deploy to Heroku

**Step 1: Create Heroku Account**
1. Go to [heroku.com](https://heroku.com)
2. Sign up and create a new app

**Step 2: Get Heroku Credentials**
1. Go to Account Settings → API Key
2. Copy your API key

**Step 3: Set GitHub Secrets**
1. Go to your GitHub repo → Settings → Secrets and variables → Actions
2. Add these secrets:
   - `HEROKU_API_KEY`: Your Heroku API key
   - `HEROKU_APP_NAME`: Your Heroku app name
   - `HEROKU_EMAIL`: Your Heroku email

**Step 4: Enable GitHub Actions**
1. The `.github/workflows/heroku-deploy.yml` file will automatically run
2. Push to main/master branch to trigger deployment

### Option 3: Deploy to GitHub Pages (Static Only)

**Step 1: Enable GitHub Pages**
1. Go to your GitHub repo → Settings → Pages
2. Set source to "GitHub Actions"

**Step 2: Enable GitHub Actions**
1. The `.github/workflows/static-deploy.yml` file will automatically run
2. Push to main/master branch to trigger deployment

**Note**: This option only deploys the React frontend without the Django backend.

## 🔄 How It Works

### GitHub Actions Workflow

When you push code to the main/master branch:

1. **Trigger**: GitHub Actions detects the push
2. **Environment**: Sets up Python and Node.js
3. **Build**: 
   - Installs Python dependencies
   - Installs Node.js dependencies
   - Builds React application
   - Copies React build to Django static files
4. **Deploy**: Deploys to your chosen platform
5. **Result**: Your app is live at the platform's URL

### Automatic Deployment

- ✅ **Automatic**: Deploys on every push to main/master
- ✅ **Secure**: Uses GitHub secrets for sensitive data
- ✅ **Fast**: Builds and deploys in minutes
- ✅ **Reliable**: Runs on GitHub's infrastructure

## 🌐 Accessing Your Deployed App

### Railway
- URL: `https://your-app-name.railway.app`
- Dashboard: [railway.app/dashboard](https://railway.app/dashboard)

### Heroku
- URL: `https://your-app-name.herokuapp.com`
- Dashboard: [dashboard.heroku.com](https://dashboard.heroku.com)

### GitHub Pages
- URL: `https://yourusername.github.io/your-repo-name`
- Settings: Repository → Settings → Pages

## 🔍 Troubleshooting

### Common Issues

1. **Build Fails**
   - Check GitHub Actions logs
   - Verify all dependencies are in requirements.txt
   - Ensure Node.js version is compatible

2. **Deployment Fails**
   - Verify platform credentials in GitHub secrets
   - Check platform-specific requirements
   - Review platform logs

3. **App Doesn't Work**
   - Check environment variables
   - Verify database configuration
   - Review platform logs

### Getting Help

1. Check GitHub Actions logs in your repository
2. Review platform-specific documentation
3. Check the platform's dashboard for errors

## 📝 Environment Variables

You may need to set these in your deployment platform:

```bash
DEBUG=False
SECRET_KEY=your-secret-key
ALLOWED_HOSTS=your-domain.com
DATABASE_URL=your-database-url
```

## 🎯 Next Steps

1. Choose your deployment platform
2. Set up the required secrets
3. Push your code to trigger deployment
4. Access your live application!

Your app will be automatically deployed every time you push changes to the main branch.
