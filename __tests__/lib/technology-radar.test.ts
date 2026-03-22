import { generateTechnologyRadar } from '@/lib/technology-radar';

describe('Technology Radar', () => {
  describe('generateTechnologyRadar', () => {
    it('should return radar data with required structure', async () => {
      const radarData = await generateTechnologyRadar(90);
      expect(radarData).toHaveProperty('technologies');
      expect(radarData).toHaveProperty('lastUpdated');
      expect(radarData).toHaveProperty('totalTechnologies');
      expect(radarData).toHaveProperty('byQuadrant');
    });

    it('should return array of technologies', async () => {
      const radarData = await generateTechnologyRadar(90);
      expect(Array.isArray(radarData.technologies)).toBe(true);
    });

    it('should have correct quadrant structure', async () => {
      const radarData = await generateTechnologyRadar(90);
      expect(radarData.byQuadrant).toHaveProperty('adopt');
      expect(radarData.byQuadrant).toHaveProperty('trial');
      expect(radarData.byQuadrant).toHaveProperty('assess');
      expect(radarData.byQuadrant).toHaveProperty('hold');
    });

    it('should accept custom days parameter', async () => {
      const radarData = await generateTechnologyRadar(30);
      expect(radarData).toBeDefined();
      expect(typeof radarData.totalTechnologies).toBe('number');
    });

    it('should have valid lastUpdated date', async () => {
      const radarData = await generateTechnologyRadar(90);
      expect(radarData.lastUpdated).toBeInstanceOf(Date);
    });
  });

  describe('technology structure', () => {
    it('should have correct technology fields', async () => {
      const radarData = await generateTechnologyRadar(90);
      if (radarData.technologies.length > 0) {
        const tech = radarData.technologies[0];
        expect(tech).toHaveProperty('id');
        expect(tech).toHaveProperty('name');
        expect(tech).toHaveProperty('quadrant');
        expect(tech).toHaveProperty('maturity');
        expect(tech).toHaveProperty('relevanceToRisk');
        expect(tech).toHaveProperty('evidenceCount');
        expect(tech).toHaveProperty('recentActivity');
        expect(tech).toHaveProperty('description');
        expect(tech).toHaveProperty('relatedTopics');
      }
    });

    it('should have valid quadrant values', async () => {
      const radarData = await generateTechnologyRadar(90);
      radarData.technologies.forEach(tech => {
        expect(['adopt', 'trial', 'assess', 'hold']).toContain(tech.quadrant);
      });
    });

    it('should have valid maturity scores', async () => {
      const radarData = await generateTechnologyRadar(90);
      radarData.technologies.forEach(tech => {
        expect(tech.maturity).toBeGreaterThanOrEqual(0);
        expect(tech.maturity).toBeLessThanOrEqual(100);
      });
    });

    it('should have valid relevance scores', async () => {
      const radarData = await generateTechnologyRadar(90);
      radarData.technologies.forEach(tech => {
        expect(tech.relevanceToRisk).toBeGreaterThanOrEqual(0);
        expect(tech.relevanceToRisk).toBeLessThanOrEqual(100);
      });
    });

    it('should have valid related topics array', async () => {
      const radarData = await generateTechnologyRadar(90);
      radarData.technologies.forEach(tech => {
        expect(Array.isArray(tech.relatedTopics)).toBe(true);
      });
    });
  });
});
