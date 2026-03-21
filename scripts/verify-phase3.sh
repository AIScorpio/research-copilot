#!/bin/bash

# Phase 3: Production Verification Script
# Comprehensive validation before production deployment

set -e

echo "═══════════════════════════════════════════════════════════════"
echo "🚀 Phase 3: Production Verification"
echo "═══════════════════════════════════════════════════════════════"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

FAILED=0

# Function to check command result
check_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ PASS${NC}: $2"
    else
        echo -e "${RED}❌ FAIL${NC}: $2"
        FAILED=1
    fi
}

echo ""
echo "📋 Step 1: Type Checking"
echo "───────────────────────────────────────────────────────────────"
npm run typecheck 2>&1 | head -20
check_result ${PIPESTATUS[0]} "TypeScript compilation"

echo ""
echo "📋 Step 2: Linting"
echo "───────────────────────────────────────────────────────────────"
npx eslint src/lib/daily-digest/ --ext .ts 2>&1 | grep -E "^✖" || true
ESLINT_OUTPUT=$(npx eslint src/lib/daily-digest/ --ext .ts 2>&1)
# Extract error count from "X errors" pattern
ESLINT_ERRORS=$(echo "$ESLINT_OUTPUT" | grep -oE "[0-9]+ error" | grep -oE "[0-9]+" | head -1 || echo "0")
if [ "$ESLINT_ERRORS" -eq "0" ]; then
    check_result 0 "ESLint (no errors in digest modules)"
else
    check_result 1 "ESLint ($ESLINT_ERRORS errors found)"
fi

echo ""
echo "📋 Step 3: Unit Tests"
echo "───────────────────────────────────────────────────────────────"
npm test -- --testPathPatterns="daily-digest" --passWithNoTests 2>&1 | tail -10
TEST_RESULT=${PIPESTATUS[0]}
check_result $TEST_RESULT "Unit tests (daily-digest)"

echo ""
echo "📋 Step 4: Integration Tests"
echo "───────────────────────────────────────────────────────────────"
npm test -- --testPathPatterns="integration/daily-digest" --passWithNoTests 2>&1 | tail -10
INTEGRATION_RESULT=${PIPESTATUS[0]}
check_result $INTEGRATION_RESULT "Integration tests"

echo ""
echo "📋 Step 5: Build Verification"
echo "───────────────────────────────────────────────────────────────"
npm run build 2>&1 | tail -20
BUILD_RESULT=${PIPESTATUS[0]}
check_result $BUILD_RESULT "Next.js build"

echo ""
echo "📋 Step 6: Configuration Validation"
echo "───────────────────────────────────────────────────────────────"

# Check config files exist
if [ -f "config/digest.json" ]; then
    check_result 0 "config/digest.json exists"
else
    check_result 1 "config/digest.json exists"
fi

if [ -f "config/prompts.json" ]; then
    check_result 0 "config/prompts.json exists"
else
    check_result 1 "config/prompts.json exists"
fi

# Validate JSON syntax
node -e "JSON.parse(require('fs').readFileSync('config/digest.json', 'utf8'))" 2>/dev/null
check_result $? "config/digest.json is valid JSON"

node -e "JSON.parse(require('fs').readFileSync('config/prompts.json', 'utf8'))" 2>/dev/null
check_result $? "config/prompts.json is valid JSON"

echo ""
echo "📋 Step 7: Database Schema Check"
echo "───────────────────────────────────────────────────────────────"
npx prisma validate 2>&1 | tail -5
PRISMA_RESULT=${PIPESTATUS[0]}
check_result $PRISMA_RESULT "Prisma schema validation"

echo ""
echo "═══════════════════════════════════════════════════════════════"
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 ALL CHECKS PASSED - Ready for Production!${NC}"
    echo "═══════════════════════════════════════════════════════════════"
    exit 0
else
    echo -e "${RED}❌ SOME CHECKS FAILED - Fix before production!${NC}"
    echo "═══════════════════════════════════════════════════════════════"
    exit 1
fi
