import { GET, POST } from '@/app/api/newsletters/route';

describe('Newsletter API', () => {
  describe('GET /api/newsletters', () => {
    it('should return newsletter logs', async () => {
      const request = new Request('http://localhost:3000/api/newsletters?limit=10');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('newsletters');
      expect(Array.isArray(data.newsletters)).toBe(true);
    });

    it('should respect limit parameter', async () => {
      const request = new Request('http://localhost:3000/api/newsletters?limit=5');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.newsletters.length).toBeLessThanOrEqual(5);
    });

    it('should handle edge case limit=1', async () => {
      const request = new Request('http://localhost:3000/api/newsletters?limit=1');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.newsletters.length).toBeLessThanOrEqual(1);
    });
  });

  describe('POST /api/newsletters', () => {
    it('should generate newsletter', async () => {
      const request = new Request('http://localhost:3000/api/newsletters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Test Newsletter',
          content: 'Test content'
        })
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('newsletter');
    });

    it('should validate request body', async () => {
      const request = new Request('http://localhost:3000/api/newsletters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const response = await POST(request);

      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('should handle invalid JSON', async () => {
      const request = new Request('http://localhost:3000/api/newsletters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json'
      });
      const response = await POST(request);

      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('newsletter structure', () => {
    it('should have correct newsletter structure', async () => {
      const request = new Request('http://localhost:3000/api/newsletters?limit=1');
      const response = await GET(request);
      const data = await response.json();

      if (data.newsletters.length > 0) {
        const newsletter = data.newsletters[0];
        expect(newsletter).toHaveProperty('id');
        expect(newsletter).toHaveProperty('title');
        expect(newsletter).toHaveProperty('content');
        expect(newsletter).toHaveProperty('paperCount');
        expect(newsletter).toHaveProperty('dateCode');
        expect(newsletter).toHaveProperty('createdAt');
      }
    });
  });
});
