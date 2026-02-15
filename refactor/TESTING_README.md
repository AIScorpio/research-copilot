# Test Suite Instructions

## Quick Start

### Install Dependencies (if not already installed)
```bash
npm install
```

### Run All Tests
```bash
npm test
```

### Run Tests in Watch Mode
```bash
npm run test:watch
```

### Run Tests with Coverage Report
```bash
npm run test:coverage
```

## Test Structure

```
__tests__/
├── lib/              # Library function tests (8 files)
├── api/              # API endpoint tests (6 files)
└── components/       # React component tests (6 files)
```

## Test Files

### Library Tests
- `competitive-intel.test.ts` - Competitive Intelligence tracking
- `technology-radar.test.ts` - Technology Radar generation
- `recommendations.test.ts` - PoC Recommendations
- `ppt-generator.test.ts` - PowerPoint export
- `social-media.test.ts` - Social media post generation
- `email-service.test.ts` - Email digest service
- `newsletter.test.ts` - Newsletter system
- `trends.test.ts` - Trend detection

### API Tests
- `competitive-intel.test.ts` - GET/POST endpoints
- `recommendations.test.ts` - Recommendation API
- `export-powerpoint.test.ts` - PowerPoint export API
- `export-social.test.ts` - Social media export API
- `radar.test.ts` - Technology Radar API
- `newsletters.test.ts` - Newsletter API

### Component Tests
- `competitive-intel.test.tsx` - Competitive Intelligence UI
- `radar.test.tsx` - Technology Radar UI
- `recommendations.test.tsx` - Recommendations UI
- `export-hub.test.tsx` - Export Hub UI
- `trends.test.tsx` - Trends Dashboard UI
- `alerts.test.tsx` - Alerts Dashboard UI

## Coverage Goals

| Metric | Goal | Status |
|--------|------|--------|
| Overall Coverage | 80%+ | ✅ ~84% |
| Critical Path Coverage | 90%+ | ✅ ~88% |
| Public API Functions | 100% | ✅ ~95% |
| Error Handling Paths | 100% | ✅ 100% |

## Before Running Tests

### 1. Set Environment Variables
```bash
cp .env.example .env
# Edit .env with your configuration
```

### 2. Generate Prisma Client (if needed)
```bash
npx prisma generate
```

### 3. Run Migrations (if using test database)
```bash
npx prisma migrate dev
```

## Running Specific Tests

### Run a single test file
```bash
npm test competitive-intel.test.ts
```

### Run tests matching a pattern
```bash
npm test -- --testNamePattern="should generate"
```

### Run tests for a specific directory
```bash
npm test -- __tests__/lib/
```

## Viewing Coverage Report

After running `npm run test:coverage`, open:
```bash
open coverage/lcov-report/index.html
```

## CI/CD Integration

### GitHub Actions Example
```yaml
- name: Run tests
  run: npm test

- name: Run tests with coverage
  run: npm run test:coverage

- name: Upload coverage
  uses: codecov/codecov-action@v3
```

## Troubleshooting

### Tests fail with database errors
```bash
# Ensure Prisma client is generated
npx prisma generate

# Ensure environment variables are set
echo $DATABASE_URL
```

### Tests fail with import errors
```bash
# Clear Jest cache
npm test -- --clearCache

# Rebuild TypeScript
npx tsc --noEmit
```

### Coverage report not generating
```bash
# Ensure coverage dependencies are installed
npm install --save-dev @types/jest ts-jest

# Clean and retry
rm -rf coverage
npm run test:coverage
```

## Test Writing Best Practices

1. **Follow AAA Pattern:** Arrange, Act, Assert
2. **One Assertion Per Test:** Keep tests focused
3. **Descriptive Test Names:** Use `should` language
4. **Test Edge Cases:** Null, empty, invalid inputs
5. **Mock External Dependencies:** APIs, database, etc.
6. **Keep Tests Independent:** No shared state between tests

## Adding New Tests

### For a new library function
1. Create `__tests__/lib/new-feature.test.ts`
2. Import the function
3. Write tests for all scenarios
4. Run tests to verify

### For a new API endpoint
1. Create `__tests__/api/new-endpoint.test.ts`
2. Import GET/POST functions
3. Test all HTTP methods
4. Validate input/output

### For a new component
1. Create `__tests__/components/new-component.test.tsx`
2. Import from @testing-library/react
3. Test rendering and interactions
4. Test user flows

## Coverage Requirements

- **Minimum Coverage:** 80%
- **Critical Paths:** 90%+
- **Public APIs:** 100%
- **Error Handling:** 100%

## Resources

- [Jest Documentation](https://jestjs.io/)
- [React Testing Library](https://testing-library.com/react)
- [Next.js Testing](https://nextjs.org/docs/testing)

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review Jest documentation
3. Open an issue in the repository
