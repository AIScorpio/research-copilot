#!/bin/bash

# Research Copilot: Auto-Sync Script 🚀
# This script bundles the project (npm build) and pushes changes to GitHub.

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}➡️  Starting Build & Sync Process...${NC}"

# 1. Bundle/Build the project to ensure no errors
echo -e "${BLUE}📦 Step 1: Bundling project...${NC}"
npm run build

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Build successful!${NC}"
else
    echo -e "${RED}❌ Build failed. Please fix errors before pushing.${NC}"
    exit 1
fi

# 2. Stage all changes
echo -e "${BLUE}📂 Step 2: Staging changes...${NC}"
git add .

# 3. Commit with a message
# If no message is provided as an argument, use a default timestamp
MSG=$1
if [ -z "$MSG" ]; then
    MSG="Auto-sync: $(date +'%Y-%m-%d %H:%M:%S')"
fi

echo -e "${BLUE}✍️  Step 3: Committing with message: \"$MSG\"${NC}"
git commit -m "$MSG"

# 4. Push to GitHub
echo -e "${BLUE}🚀 Step 4: Pushing to GitHub (main)...${NC}"
git push origin main

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✨ Project successfully bundled and pushed to GitHub!${NC}"
else
    echo -e "${RED}❌ Push failed. Check your internet connection or GitHub token.${NC}"
    exit 1
fi
