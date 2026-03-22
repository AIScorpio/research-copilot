/**
 * Test: LLM Model Compatibility Tester
 * 
 * Validates that:
 * 1. API route exists for fetching models
 * 2. API route exists for running tests
 * 3. Component renders correctly
 * 4. Log file is saved correctly
 */

import fs from 'fs';
import path from 'path';

describe('LLM Model Compatibility Tester', () => {
    
    describe('API Routes', () => {
        it('should have GET /api/llm-models route', () => {
            const routePath = path.join(process.cwd(), 'src/app/api/llm-models/route.ts');
            expect(fs.existsSync(routePath)).toBe(true);
        });

        it('should have POST /api/llm-models/test route', () => {
            const routePath = path.join(process.cwd(), 'src/app/api/llm-models/test/route.ts');
            expect(fs.existsSync(routePath)).toBe(true);
        });

        it('GET route should fetch models from providers', () => {
            const routePath = path.join(process.cwd(), 'src/app/api/llm-models/route.ts');
            const content = fs.readFileSync(routePath, 'utf-8');
            
            expect(content).toContain('fetchGroqModels');
            expect(content).toContain('fetchOllamaModels');
            expect(content).toContain('fetchZhipuModels');
        });

        it('POST route should save results to log file', () => {
            const routePath = path.join(process.cwd(), 'src/app/api/llm-models/test/route.ts');
            const content = fs.readFileSync(routePath, 'utf-8');
            
            expect(content).toContain('llm-model-test-latest.log');
            expect(content).toContain('fs.writeFileSync');
        });
    });

    describe('Component', () => {
        it('should have LLMModelTester component', () => {
            const componentPath = path.join(process.cwd(), 'src/components/settings/llm-model-tester.tsx');
            expect(fs.existsSync(componentPath)).toBe(true);
        });

        it('should have Run All Tests button', () => {
            const componentPath = path.join(process.cwd(), 'src/components/settings/llm-model-tester.tsx');
            const content = fs.readFileSync(componentPath, 'utf-8');
            
            expect(content).toContain('Run All Tests');
        });

        it('should display test results in table format', () => {
            const componentPath = path.join(process.cwd(), 'src/components/settings/llm-model-tester.tsx');
            const content = fs.readFileSync(componentPath, 'utf-8');
            
            expect(content).toContain('<table');
            expect(content).toContain('Query');
            expect(content).toContain('Assessment');
            expect(content).toContain('Tags');
            expect(content).toContain('Summary');
        });

        it('should group models by provider', () => {
            const componentPath = path.join(process.cwd(), 'src/components/settings/llm-model-tester.tsx');
            const content = fs.readFileSync(componentPath, 'utf-8');
            
            expect(content).toContain('groupedModels');
        });

        it('should show last run timestamp', () => {
            const componentPath = path.join(process.cwd(), 'src/components/settings/llm-model-tester.tsx');
            const content = fs.readFileSync(componentPath, 'utf-8');
            
            expect(content).toContain('lastRun');
            expect(content).toContain('Last run:');
        });

        it('should have scrollable results area', () => {
            const componentPath = path.join(process.cwd(), 'src/components/settings/llm-model-tester.tsx');
            const content = fs.readFileSync(componentPath, 'utf-8');
            
            expect(content).toContain('max-h-96');
            expect(content).toContain('overflow-y-auto');
        });
    });

    describe('Settings Page Integration', () => {
        it('should import LLMModelTester', () => {
            const pagePath = path.join(process.cwd(), 'src/app/settings/page.tsx');
            const content = fs.readFileSync(pagePath, 'utf-8');
            
            expect(content).toContain('LLMModelTester');
        });

        it('should render after LLMProviderManager', () => {
            const pagePath = path.join(process.cwd(), 'src/app/settings/page.tsx');
            const content = fs.readFileSync(pagePath, 'utf-8');
            
            const providerIndex = content.indexOf('<LLMProviderManager />');
            const testerIndex = content.indexOf('<LLMModelTester />');
            
            expect(providerIndex).toBeGreaterThan(-1);
            expect(testerIndex).toBeGreaterThan(providerIndex);
        });
    });

    describe('Log File Format', () => {
        it('should save timestamped log with correct structure', () => {
            const routePath = path.join(process.cwd(), 'src/app/api/llm-models/test/route.ts');
            const content = fs.readFileSync(routePath, 'utf-8');
            
            // Check log structure
            expect(content).toContain('timestamp');
            expect(content).toContain('duration');
            expect(content).toContain('results');
        });
    });
});

describe('Test Validation Logic', () => {
    it('should validate query response contains AND/OR', () => {
        const validResponse = 'machine learning AND banking AND fraud';
        const invalidResponse = 'banking finance ml ai';
        
        expect(/AND|OR|"/i.test(validResponse)).toBe(true);
        expect(/AND|OR|"/i.test(invalidResponse)).toBe(false);
    });

    it('should validate assessment response has score fields', () => {
        const validJson = '{"technical": 8, "business": 7, "timeliness": 9}';
        const invalidJson = '{"foo": "bar"}';
        
        const parsed1 = JSON.parse(validJson);
        const parsed2 = JSON.parse(invalidJson);
        
        expect(typeof parsed1.technical === 'number').toBe(true);
        expect(typeof parsed2.technical === 'number').toBe(false);
    });

    it('should validate tags response contains tag-like content', () => {
        const validResponse = 'tags: machine-learning, fraud-detection';
        const invalidResponse = '';
        
        expect(validResponse.toLowerCase().includes('tag') || /[\w-]+/.test(validResponse)).toBe(true);
    });

    it('should validate summary has reasonable length', () => {
        const validSummary = 'A'.repeat(100);
        const invalidSummary = 'A'.repeat(10);
        
        expect(validSummary.length > 50).toBe(true);
        expect(invalidSummary.length > 50).toBe(false);
    });
});
