import { POST } from '@/app/api/recommendations/poc/route';

describe('PoC Recommendations API', () => {
  describe('POST /api/recommendations/poc', () => {
    it('should return PoC recommendations', async () => {
      const request = new Request('http://localhost:3000/api/recommendations/poc?limit=10');
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('recommendations');
      expect(data).toHaveProperty('count');
      expect(Array.isArray(data.recommendations)).toBe(true);
    });

    it('should validate limit parameter', async () => {
      const request = new Request('http://localhost:3000/api/recommendations/poc?limit=invalid');
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toHaveProperty('error');
    });

    it('should use default limit parameter', async () => {
      const request = new Request('http://localhost:3000/api/recommendations/poc');
      const response = await POST(request);

      expect(response.status).toBe(200);
    });

    it('should respect custom limit', async () => {
      const request = new Request('http://localhost:3000/api/recommendations/poc?limit=5');
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.recommendations.length).toBeLessThanOrEqual(5);
    });

    it('should handle edge case limit=1', async () => {
      const request = new Request('http://localhost:3000/api/recommendations/poc?limit=1');
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.recommendations.length).toBeLessThanOrEqual(1);
    });

    it('should handle edge case limit=50', async () => {
      const request = new Request('http://localhost:3000/api/recommendations/poc?limit=50');
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.recommendations.length).toBeLessThanOrEqual(50);
    });

    it('should reject limit > 50', async () => {
      const request = new Request('http://localhost:3000/api/recommendations/poc?limit=51');
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toHaveProperty('error');
    });

    it('should reject limit < 1', async () => {
      const request = new Request('http://localhost:3000/api/recommendations/poc?limit=0');
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toHaveProperty('error');
    });

    it('should reject negative limit', async () => {
      const request = new Request('http://localhost:3000/api/recommendations/poc?limit=-5');
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toHaveProperty('error');
    });
  });

  describe('recommendation structure', () => {
    it('should return recommendations with correct structure', async () => {
      const request = new Request('http://localhost:3000/api/recommendations/poc?limit=10');
      const response = await POST(request);
      const data = await response.json();

      if (data.recommendations.length > 0) {
        const rec = data.recommendations[0];
        expect(rec).toHaveProperty('id');
        expect(rec).toHaveProperty('title');
        expect(rec).toHaveProperty('description');
        expect(rec).toHaveProperty('confidence');
        expect(typeof rec.confidence).toBe('number');
        expect(rec.confidence).toBeGreaterThanOrEqual(0);
        expect(rec.confidence).toBeLessThanOrEqual(1);
      }
    });

    it('should sort by confidence', async () => {
      const request = new Request('http://localhost:3000/api/recommendations/poc?limit=5');
      const response = await POST(request);
      const data = await response.json();

      if (data.recommendations.length > 1) {
        for (let i = 0; i < data.recommendations.length - 1; i++) {
          expect(data.recommendations[i].confidence).toBeGreaterThanOrEqual(
            data.recommendations[i + 1].confidence
          );
        }
      }
    });
  });

  describe('error handling', () => {
    it('should handle server errors gracefully', async () => {
      const request = new Request('http://localhost:3000/api/recommendations/poc?limit=10');
      const response = await POST(request);
      const data = await response.json();

      expect(data).toHaveProperty('success');
    });
  });
});
