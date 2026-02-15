import { POST } from '@/app/api/export/social-media/route';

describe('Social Media Export API', () => {
  describe('POST /api/export/social-media', () => {
    it('should generate LinkedIn posts', async () => {
      const request = new Request('http://localhost:3000/api/export/social-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: 'LinkedIn',
          count: 2
        })
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('posts');
      expect(data).toHaveProperty('count');
      expect(data).toHaveProperty('platform');
      expect(Array.isArray(data.posts)).toBe(true);
      expect(data.platform).toBe('LinkedIn');
    });

    it('should generate Twitter posts', async () => {
      const request = new Request('http://localhost:3000/api/export/social-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: 'Twitter',
          count: 2
        })
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.platform).toBe('Twitter');
    });

    it('should generate X posts', async () => {
      const request = new Request('http://localhost:3000/api/export/social-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: 'X',
          count: 2
        })
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.platform).toBe('X');
    });

    it('should accept paper IDs', async () => {
      const request = new Request('http://localhost:3000/api/export/social-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paperIds: ['id1', 'id2'],
          platform: 'LinkedIn',
          count: 2
        })
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('success');
    });

    it('should accept empty paper IDs array', async () => {
      const request = new Request('http://localhost:3000/api/export/social-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paperIds: [],
          platform: 'LinkedIn',
          count: 2
        })
      });
      const response = await POST(request);

      expect(response.status).toBe(200);
    });

    it('should respect count parameter', async () => {
      const request = new Request('http://localhost:3000/api/export/social-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: 'LinkedIn',
          count: 5
        })
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.posts.length).toBeLessThanOrEqual(5);
    });

    it('should use default platform', async () => {
      const request = new Request('http://localhost:3000/api/export/social-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.platform).toBe('LinkedIn');
    });

    it('should use default count', async () => {
      const request = new Request('http://localhost:3000/api/export/social-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: 'LinkedIn'
        })
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.posts.length).toBeLessThanOrEqual(1);
    });

    it('should reject invalid platform', async () => {
      const request = new Request('http://localhost:3000/api/export/social-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: 'Facebook',
          count: 2
        })
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toHaveProperty('error');
    });

    it('should reject count > 10', async () => {
      const request = new Request('http://localhost:3000/api/export/social-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: 'LinkedIn',
          count: 11
        })
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toHaveProperty('error');
    });

    it('should reject count < 1', async () => {
      const request = new Request('http://localhost:3000/api/export/social-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: 'LinkedIn',
          count: 0
        })
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toHaveProperty('error');
    });

    it('should reject negative count', async () => {
      const request = new Request('http://localhost:3000/api/export/social-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: 'LinkedIn',
          count: -5
        })
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toHaveProperty('error');
    });
  });

  describe('post structure', () => {
    it('should return posts with correct structure', async () => {
      const request = new Request('http://localhost:3000/api/export/social-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: 'LinkedIn',
          count: 1
        })
      });
      const response = await POST(request);
      const data = await response.json();

      if (data.posts.length > 0) {
        const post = data.posts[0];
        expect(post).toHaveProperty('platform');
        expect(post).toHaveProperty('content');
        expect(post).toHaveProperty('hashtags');
        expect(post).toHaveProperty('tone');
        expect(['professional', 'casual', 'thought-leadership']).toContain(post.tone);
      }
    });

    it('should have valid hashtags', async () => {
      const request = new Request('http://localhost:3000/api/export/social-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: 'LinkedIn',
          count: 1
        })
      });
      const response = await POST(request);
      const data = await response.json();

      if (data.posts.length > 0) {
        const post = data.posts[0];
        expect(Array.isArray(post.hashtags)).toBe(true);
        post.hashtags.forEach((tag: string) => {
          expect(tag).toMatch(/^#/);
        });
      }
    });

    it('should have non-empty content', async () => {
      const request = new Request('http://localhost:3000/api/export/social-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: 'LinkedIn',
          count: 1
        })
      });
      const response = await POST(request);
      const data = await response.json();

      if (data.posts.length > 0) {
        expect(data.posts[0].content.length).toBeGreaterThan(0);
      }
    });
  });

  describe('error handling', () => {
    it('should handle missing Content-Type', async () => {
      const request = new Request('http://localhost:3000/api/export/social-media', {
        method: 'POST',
        body: JSON.stringify({ platform: 'LinkedIn', count: 1 })
      });
      const response = await POST(request);

      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('should handle invalid JSON body', async () => {
      const request = new Request('http://localhost:3000/api/export/social-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json'
      });
      const response = await POST(request);

      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });
});
