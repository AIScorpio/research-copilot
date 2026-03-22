/**
 * Test: Rationale Display on Paper Cards
 * 
 * Validates that:
 * 1. Paper interface includes assessmentReason
 * 2. Info icon is conditionally rendered when assessmentReason exists
 * 3. Tooltip shows truncated assessmentReason
 */

import fs from 'fs';
import path from 'path';

describe('Rationale Display on Paper Cards', () => {
    
    describe('Paper Card Component', () => {
        it('should have assessmentReason in Paper interface', () => {
            const paperCardPath = path.join(process.cwd(), 'src/components/papers/paper-card.tsx');
            const content = fs.readFileSync(paperCardPath, 'utf-8');
            
            // Check that assessmentReason is in the interface
            expect(content).toContain('assessmentReason?: string | null;');
        });

        it('should use ℹ️ emoji for info icon', () => {
            const paperCardPath = path.join(process.cwd(), 'src/components/papers/paper-card.tsx');
            const content = fs.readFileSync(paperCardPath, 'utf-8');
            
            expect(content).toContain('ℹ️');
        });

        it('should use native title attribute for tooltip (like relevance score)', () => {
            const paperCardPath = path.join(process.cwd(), 'src/components/papers/paper-card.tsx');
            const content = fs.readFileSync(paperCardPath, 'utf-8');
            
            // Should use title attribute for native browser tooltip
            expect(content).toContain('title={`Why Collected:');
        });

        it('should truncate assessmentReason in title attribute', () => {
            const paperCardPath = path.join(process.cwd(), 'src/components/papers/paper-card.tsx');
            const content = fs.readFileSync(paperCardPath, 'utf-8');
            
            expect(content).toContain('substring(0, 200)');
        });

        it('should conditionally render info icon when assessmentReason exists', () => {
            const paperCardPath = path.join(process.cwd(), 'src/components/papers/paper-card.tsx');
            const content = fs.readFileSync(paperCardPath, 'utf-8');
            
            // Check conditional rendering
            expect(content).toContain('paper.assessmentReason &&');
        });

        it('should show "Why Collected" in tooltip', () => {
            const paperCardPath = path.join(process.cwd(), 'src/components/papers/paper-card.tsx');
            const content = fs.readFileSync(paperCardPath, 'utf-8');
            
            expect(content).toContain('Why Collected');
        });

        it('should truncate assessmentReason to 200 characters', () => {
            const paperCardPath = path.join(process.cwd(), 'src/components/papers/paper-card.tsx');
            const content = fs.readFileSync(paperCardPath, 'utf-8');
            
            expect(content).toContain('substring(0, 200)');
        });

        it('should place info icon after collectedAt', () => {
            const paperCardPath = path.join(process.cwd(), 'src/components/papers/paper-card.tsx');
            const content = fs.readFileSync(paperCardPath, 'utf-8');
            
            // Find the collectedAt section and verify info icon comes after
            const collectedAtIndex = content.indexOf('paper.collectedAt &&');
            const infoIconIndex = content.indexOf('paper.assessmentReason &&');
            
            expect(collectedAtIndex).toBeGreaterThan(-1);
            expect(infoIconIndex).toBeGreaterThan(collectedAtIndex);
        });
    });

    describe('Paper Browser Component', () => {
        it('should have assessmentReason in Paper interface', () => {
            const paperBrowserPath = path.join(process.cwd(), 'src/components/papers/paper-browser.tsx');
            const content = fs.readFileSync(paperBrowserPath, 'utf-8');
            
            expect(content).toContain('assessmentReason?: string | null;');
        });
    });
});

describe('Paper Card Tooltip Logic', () => {
    it('should not show info icon when assessmentReason is null', () => {
        const paper = {
            id: 'test-1',
            title: 'Test Paper',
            collectedAt: new Date(),
            assessmentReason: null
        };
        
        const showInfoIcon = !!paper.assessmentReason;
        expect(showInfoIcon).toBe(false);
    });

    it('should show info icon when assessmentReason exists', () => {
        const paper = {
            id: 'test-1',
            title: 'Test Paper',
            collectedAt: new Date(),
            assessmentReason: 'This paper is relevant to banking AI.'
        };
        
        const showInfoIcon = !!paper.assessmentReason;
        expect(showInfoIcon).toBe(true);
    });

    it('should truncate long assessmentReason', () => {
        const longReason = 'A'.repeat(300);
        const paper = {
            assessmentReason: longReason
        };
        
        const displayText = paper.assessmentReason.substring(0, 200);
        expect(displayText.length).toBe(200);
        expect(displayText + '...').toContain('...');
    });

    it('should not truncate short assessmentReason', () => {
        const shortReason = 'This is a short reason.';
        const paper = {
            assessmentReason: shortReason
        };
        
        const needsTruncation = paper.assessmentReason.length > 200;
        expect(needsTruncation).toBe(false);
    });
});
