# GitHub Token Configuration Guide

## Overview
This project requires access to the private npm package `@axyor/family-serve-database`. You must configure a GitHub Personal Access Token to install and use this dependency.

## 🚀 Quick Setup

Run the interactive configuration script:
```bash
npm run setup
# or
./configure-github-token.sh
```

## 📖 Manual Configuration

### Step 1: Create GitHub Token
1. Go to [GitHub Settings > Personal Access Tokens](https://github.com/settings/tokens)
2. Click "Generate new token (classic)"
3. Name: `Family Serve Delicious`
4. Expiration: Choose appropriate duration
5. Scopes: ✅ `read:packages`
6. Click "Generate token"
7. **Copy the token** (starts with `ghp_`)

### Step 2: Configure Token (Choose One Method)

#### Method 1: .env File (Recommended for Docker)
```bash
# Edit .env file
GITHUB_TOKEN=ghp_your_token_here
```

#### Method 2: .npmrc File (Recommended for Local Development)  
```bash
# Create .npmrc file in project root
@axyor:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=ghp_your_token_here
```

#### Method 3: Environment Variable
```bash
export GITHUB_TOKEN=ghp_your_token_here
# Add to ~/.bashrc or ~/.zshrc for persistence
```

## 🔧 Usage with Docker

### Docker Compose
Docker Compose automatically uses your `.env` file:
```bash
./manage.sh app start    # Production
./manage.sh app dev      # Development
```

### Manual Docker Build
```bash
docker build --build-arg GITHUB_TOKEN=ghp_your_token_here -t family-serve .
```

## ✅ Verification

Test your configuration:
```bash
npm install  # Should work without authentication errors
```

Or use the configuration script:
```bash
./configure-github-token.sh  # Choose option 5: Test current configuration
```

## 🔒 Security Notes

- **Never commit tokens to git** - they're protected by `.gitignore`
- Token gives read access to @axyor organization packages only
- Regenerate tokens periodically for security
- Use different tokens for different projects/environments

## 🛠 Troubleshooting

**Error: "authentication token not provided"**
- Check your token configuration using `./configure-github-token.sh` (option 6)
- Verify token has `read:packages` scope
- Ensure token isn't expired

**Docker build fails with authentication error**
- Make sure `GITHUB_TOKEN` is set in `.env` file
- Check docker-compose is reading `.env` file correctly

**npm install fails locally**
- Check `.npmrc` file exists and has correct token
- Try setting environment variable: `export GITHUB_TOKEN=your_token`

## 🆘 Need Help?

Run the interactive configuration tool:
```bash
npm run setup
```

This will guide you through the entire process step by step.