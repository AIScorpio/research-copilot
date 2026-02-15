import { GET, POST } from '@/app/api/radar/route';

describe('Technology Radar API', () => {
  describe('GET /api/radar', () => {
    it('should return technology radar data', async () => {
      const request = new Request('http://localhost:3000/api/radar?days=90');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('radarData');
      expect(data.radarData).toHaveProperty('technologies');
      expect(data.radarData).toHaveProperty('totalTechnologies');
      expect(data.radarData).toHaveProperty('byQuadrant');
      expect(Array.isArray(data.radarData.technologies)).toBe(true);
    });

    it('should accept custom days parameter', async () => {
      const request = new Request('http://localhost:3000/api/radar?days=30');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('radarData');
    });

    it('should handle edge case days=1', async () => {
      const request = new Request('http://localhost:3000/api/radar?days=1');
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('should handle edge case days=365', async () => {
      const request = new Request('http://localhost:3000/api/radar?days=365');
      const response = await GET(request);

      expect(response.status).toBe(200);
    });
  });

  describe('POST /api/radar', () => {
    it('should regenerate radar data', async () => {
      const request = new Request('http://localhost:3000/api/radar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: 90 })
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('radarData');
    });

    it('should validate request body', async () => {
      const request = new Request('http://localhost:3000/api/radar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: 'invalid' })
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toHaveProperty('error');
    });
  });

  describe('radar data structure', () => {
    it('should have correct quadrant breakdown', async () => {
      const request = new Request('http://localhost:3000/api/radar?days=90');
      const response = await GET(request);
      const data = await response.json();

      const byQuadrant = data.radarData.byQuadrant;
      expect(byQuadrant).toHaveProperty('adopt');
      expect(byQuadrant).toHaveProperty('trial');
      expect(byQuadrant).toHaveProperty('assess');
      expect(byQuadrant).toHaveProperty('hold');
      expect(typeof byQuadrant.adopt).toBe('number');
      expect(typeof byQuadrant.trial).toBe('number');
      expect(typeof byQuadrant.assess).toBe('number');
      expect(typeof byQuadrant.hold).toBe('number');
    });

    it('should have valid technology items', async () => {
      const request = new Request('http://localhost:3000/api/radar?days=90');
      const response = await GET(request);
      const data = await response.json();

      if (data.radarData.technologies.length > 0) {
        const tech = data.radarData.technologies[0];
        expect(tech).toHaveProperty('id');
        expect(tech).toHaveProperty('name');
        expect(tech).toHaveProperty('quadrant');
        expect(tech).toHaveProperty('maturity');
        expect(tech).toHaveProperty('relevanceToRisk');
        expect(['adopt', 'trial', 'assess', 'hold']).toContain(tech.quadrant);
        expect(tech.maturity).toBeGreaterThanOrEqual(0);
        expect(tech.maturity).toBeLessThanOrEqual(100);
      }
    });
  });
});
