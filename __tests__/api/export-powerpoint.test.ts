import { POST } from '@/app/api/export/powerpoint/route';

describe('PowerPoint Export API', () => {
  describe('POST /api/export/powerpoint', () => {
    it('should generate PowerPoint file', async () => {
      const request = new Request('http://localhost:3000/api/export/powerpoint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          days: 30,
          limit: 10,
          includeAbstract: true,
          includeSummary: true,
          includeTags: true
        })
      });
      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toContain('presentationml');
      expect(response.headers.get('Content-Disposition')).toContain('.pptx');
    });

    it('should validate request body', async () => {
      const request = new Request('http://localhost:3000/api/export/powerpoint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          days: 'invalid'
        })
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toHaveProperty('error');
    });

    it('should accept custom days parameter', async () => {
      const request = new Request('http://localhost:3000/api/export/powerpoint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          days: 60,
          limit: 10
        })
      });
      const response = await POST(request);

      expect(response.status).toBe(200);
    });

    it('should accept custom limit parameter', async () => {
      const request = new Request('http://localhost:3000/api/export/powerpoint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          days: 30,
          limit: 5
        })
      });
      const response = await POST(request);

      expect(response.status).toBe(200);
    });

    it('should accept search parameter', async () => {
      const request = new Request('http://localhost:3000/api/export/powerpoint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          days: 30,
          limit: 10,
          search: 'AI'
        })
      });
      const response = await POST(request);

      expect(response.status).toBe(200);
    });

    it('should handle includeAbstract parameter', async () => {
      const request = new Request('http://localhost:3000/api/export/powerpoint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          days: 30,
          limit: 10,
          includeAbstract: false
        })
      });
      const response = await POST(request);

      expect(response.status).toBe(200);
    });

    it('should handle includeSummary parameter', async () => {
      const request = new Request('http://localhost:3000/api/export/powerpoint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          days: 30,
          limit: 10,
          includeSummary: false
        })
      });
      const response = await POST(request);

      expect(response.status).toBe(200);
    });

    it('should handle includeTags parameter', async () => {
      const request = new Request('http://localhost:3000/api/export/powerpoint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          days: 30,
          limit: 10,
          includeTags: false
        })
      });
      const response = await POST(request);

      expect(response.status).toBe(200);
    });

    it('should use default values', async () => {
      const request = new Request('http://localhost:3000/api/export/powerpoint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const response = await POST(request);

      expect(response.status).toBe(200);
    });

    it('should reject invalid days > 365', async () => {
      const request = new Request('http://localhost:3000/api/export/powerpoint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          days: 366,
          limit: 10
        })
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toHaveProperty('error');
    });

    it('should reject invalid days < 1', async () => {
      const request = new Request('http://localhost:3000/api/export/powerpoint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          days: 0,
          limit: 10
        })
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toHaveProperty('error');
    });

    it('should reject invalid limit > 50', async () => {
      const request = new Request('http://localhost:3000/api/export/powerpoint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          days: 30,
          limit: 51
        })
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toHaveProperty('error');
    });

    it('should reject invalid limit < 1', async () => {
      const request = new Request('http://localhost:3000/api/export/powerpoint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          days: 30,
          limit: 0
        })
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toHaveProperty('error');
    });

    it('should reject search > 200 characters', async () => {
      const request = new Request('http://localhost:3000/api/export/powerpoint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          days: 30,
          limit: 10,
          search: 'a'.repeat(201)
        })
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toHaveProperty('error');
    });

    it('should handle missing Content-Type', async () => {
      const request = new Request('http://localhost:3000/api/export/powerpoint', {
        method: 'POST',
        body: JSON.stringify({ days: 30, limit: 10 })
      });
      const response = await POST(request);

      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('should handle invalid JSON body', async () => {
      const request = new Request('http://localhost:3000/api/export/powerpoint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json'
      });
      const response = await POST(request);

      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });
});
