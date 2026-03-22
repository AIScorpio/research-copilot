import { GET, POST } from '@/app/api/competitive-intel/route';

describe('Competitive Intelligence API', () => {
  describe('GET /api/competitive-intel', () => {
    it('should return competitive intelligence updates', async () => {
      const request = new Request('http://localhost:3000/api/competitive-intel?days=30&limit=50');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('updates');
      expect(data).toHaveProperty('count');
      expect(Array.isArray(data.updates)).toBe(true);
    });

    it('should validate days parameter', async () => {
      const request = new Request('http://localhost:3000/api/competitive-intel?days=invalid');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toHaveProperty('error');
    });

    it('should validate limit parameter', async () => {
      const request = new Request('http://localhost:3000/api/competitive-intel?limit=invalid');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toHaveProperty('error');
    });

    it('should respect days parameter', async () => {
      const request = new Request('http://localhost:3000/api/competitive-intel?days=60');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('dateRange');
    });

    it('should use default days parameter', async () => {
      const request = new Request('http://localhost:3000/api/competitive-intel');
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('should use default limit parameter', async () => {
      const request = new Request('http://localhost:3000/api/competitive-intel');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.updates.length).toBeLessThanOrEqual(50);
    });

    it('should handle edge case days=1', async () => {
      const request = new Request('http://localhost:3000/api/competitive-intel?days=1');
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('should handle edge case days=365', async () => {
      const request = new Request('http://localhost:3000/api/competitive-intel?days=365');
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('should reject days > 365', async () => {
      const request = new Request('http://localhost:3000/api/competitive-intel?days=366');
      const response = await GET(request);

      expect(response.status).toBe(400);
    });

    it('should reject days < 1', async () => {
      const request = new Request('http://localhost:3000/api/competitive-intel?days=0');
      const response = await GET(request);

      expect(response.status).toBe(400);
    });

    it('should reject limit > 100', async () => {
      const request = new Request('http://localhost:3000/api/competitive-intel?limit=101');
      const response = await GET(request);

      expect(response.status).toBe(400);
    });

    it('should reject limit < 1', async () => {
      const request = new Request('http://localhost:3000/api/competitive-intel?limit=0');
      const response = await GET(request);

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/competitive-intel', () => {
    it('should generate competitive brief', async () => {
      const request = new Request('http://localhost:3000/api/competitive-intel', {
        method: 'POST',
        body: JSON.stringify({ days: 30 })
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('brief');
      expect(data.brief).toHaveProperty('summary');
      expect(data.brief).toHaveProperty('topCompetitors');
      expect(data.brief).toHaveProperty('keyTrends');
      expect(data.brief).toHaveProperty('alertTopics');
    });

    it('should validate request body', async () => {
      const request = new Request('http://localhost:3000/api/competitive-intel', {
        method: 'POST',
        body: JSON.stringify({ days: 'invalid' })
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toHaveProperty('error');
    });

    it('should handle custom days parameter', async () => {
      const request = new Request('http://localhost:3000/api/competitive-intel', {
        method: 'POST',
        body: JSON.stringify({ days: 60 })
      });
      const response = await POST(request);

      expect(response.status).toBe(200);
    });

    it('should use default days if not provided', async () => {
      const request = new Request('http://localhost:3000/api/competitive-intel', {
        method: 'POST',
        body: JSON.stringify({})
      });
      const response = await POST(request);

      expect(response.status).toBe(200);
    });

    it('should return generatedAt timestamp', async () => {
      const request = new Request('http://localhost:3000/api/competitive-intel', {
        method: 'POST',
        body: JSON.stringify({ days: 30 })
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('generatedAt');
    });

    it('should handle invalid JSON body', async () => {
      const request = new Request('http://localhost:3000/api/competitive-intel', {
        method: 'POST',
        body: 'invalid json'
      });
      const response = await POST(request);

      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('error handling', () => {
    it('should handle missing parameters gracefully', async () => {
      const request = new Request('http://localhost:3000/api/competitive-intel');
      const response = await GET(request);

      expect(response.status).toBe(200);
    });
  });
});
