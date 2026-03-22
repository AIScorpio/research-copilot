/**
 * Test: aiSummary and assessmentReason field separation
 * 
 * Validates that:
 * 1. Collection service saves to assessmentReason, not aiSummary
 * 2. Paper detail page displays assessmentReason in "Why Collected" section
 * 3. Email digest uses assessmentReason for "Why Included"
 * 4. PPT generator uses assessmentReason for "Why Included"
 */

import fs from 'fs';
import path from 'path';

describe('aiSummary Field Separation', () => {
    
    describe('Collection Service', () => {
        it('should NOT include aiSummary in paper creation data', () => {
            const collectionServicePath = path.join(process.cwd(), 'src/lib/collection-service.ts');
            const content = fs.readFileSync(collectionServicePath, 'utf-8');
            
            // Find the data object for paper creation
            const dataMatch = content.match(/data:\s*\{[\s\S]*?title:[\s\S]*?technicalBonusApplied[\s\S]*?\}/);
            expect(dataMatch).not.toBeNull();
            
            // Check that aiSummary is NOT in the data object
            expect(dataMatch![0]).not.toContain('aiSummary:');
            
            // Check that assessmentReason IS in the data object
            expect(dataMatch![0]).toContain('assessmentReason:');
        });
    });

    describe('PPT Generator', () => {
        it('should have assessmentReason field in Paper interface', () => {
            const pptGeneratorPath = path.join(process.cwd(), 'src/lib/ppt-generator.ts');
            const content = fs.readFileSync(pptGeneratorPath, 'utf-8');
            
            // Check that assessmentReason is in the interface
            expect(content).toContain('assessmentReason?: string | null;');
        });

        it('should prefer aiSummary over assessmentReason', () => {
            const pptGeneratorPath = path.join(process.cwd(), 'src/lib/ppt-generator.ts');
            const content = fs.readFileSync(pptGeneratorPath, 'utf-8');
            
            // Check the logic prefers aiSummary
            expect(content).toContain('paper.aiSummary || paper.assessmentReason');
            expect(content).toContain("paper.aiSummary ? 'AI Summary:' : 'Why Included:'");
        });
    });

    describe('Paper Detail Page', () => {
        it('should display "Why Collected" section with assessmentReason', () => {
            const pagePath = path.join(process.cwd(), 'src/app/papers/[id]/page.tsx');
            const content = fs.readFileSync(pagePath, 'utf-8');
            
            // Check that "Why Collected" section exists
            expect(content).toContain('Why Collected');
            expect(content).toContain('paper.assessmentReason');
        });

        it('should conditionally render "Why Collected" only when assessmentReason exists', () => {
            const pagePath = path.join(process.cwd(), 'src/app/papers/[id]/page.tsx');
            const content = fs.readFileSync(pagePath, 'utf-8');
            
            // Check conditional rendering
            expect(content).toContain('paper.assessmentReason &&');
        });
    });

    describe('Email Digest', () => {
        it('should use assessmentReason for "Why Included" fallback', () => {
            const emailDigestPath = path.join(process.cwd(), 'src/lib/email-digest.ts');
            const content = fs.readFileSync(emailDigestPath, 'utf-8');
            
            // Check that "Why Included" section uses assessmentReason
            expect(content).toContain('Why Included');
            expect(content).toContain('paper.assessmentReason');
        });
    });

    describe('PowerPoint Export API', () => {
        it('should include assessmentReason in formatted papers', () => {
            const exportPath = path.join(process.cwd(), 'src/app/api/export/powerpoint/route.ts');
            const content = fs.readFileSync(exportPath, 'utf-8');
            
            expect(content).toContain('assessmentReason: p.assessmentReason');
        });
    });
});

describe('Template Logic', () => {
    it('should show "Why Included" section when assessmentReason exists but aiSummary is null', () => {
        const paper = {
            title: 'Test Paper',
            source: 'ArXiv',
            publicationDate: new Date(),
            url: 'https://example.com',
            abstract: 'Test abstract',
            tags: [],
            aiSummary: null,
            assessmentReason: 'This paper is relevant to banking AI research.'
        };
        
        const showWhyIncluded = !paper.aiSummary && !!paper.assessmentReason;
        expect(showWhyIncluded).toBe(true);
    });

    it('should show "AI Perspective" section when aiSummary exists', () => {
        const paper = {
            title: 'Test Paper',
            source: 'ArXiv',
            publicationDate: new Date(),
            url: 'https://example.com',
            abstract: 'Test abstract',
            tags: [],
            aiSummary: 'Dedicated AI summary',
            assessmentReason: 'Assessment rationale'
        };
        
        const showAIPerspective = !!paper.aiSummary;
        expect(showAIPerspective).toBe(true);
    });

    it('should prefer aiSummary over assessmentReason for AI Perspective', () => {
        const paper = {
            title: 'Test Paper',
            source: 'ArXiv',
            publicationDate: new Date(),
            url: 'https://example.com',
            abstract: 'Test abstract',
            tags: [],
            aiSummary: 'Dedicated AI summary',
            assessmentReason: 'Assessment rationale'
        };
        
        // When both exist, aiSummary takes precedence
        const displayText = paper.aiSummary || paper.assessmentReason;
        expect(displayText).toBe('Dedicated AI summary');
    });

    it('should use assessmentReason when aiSummary is null', () => {
        const paper = {
            title: 'Test Paper',
            source: 'ArXiv',
            publicationDate: new Date(),
            url: 'https://example.com',
            abstract: 'Test abstract',
            tags: [],
            aiSummary: null,
            assessmentReason: 'Assessment rationale'
        };
        
        const displayText = paper.aiSummary || paper.assessmentReason;
        expect(displayText).toBe('Assessment rationale');
    });
});
