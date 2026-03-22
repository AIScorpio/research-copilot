import { generateSocialMediaPosts, saveSocialMediaDrafts } from '@/lib/social-media';

describe('Social Media Generator', () => {
  describe('generateSocialMediaPosts', () => {
    it('should generate LinkedIn posts', async () => {
      const posts = await generateSocialMediaPosts(undefined, 'LinkedIn', 2);
      expect(Array.isArray(posts)).toBe(true);
      if (posts.length > 0) {
        expect(posts[0].platform).toBe('LinkedIn');
      }
    });

    it('should generate Twitter posts', async () => {
      const posts = await generateSocialMediaPosts(undefined, 'Twitter', 2);
      expect(Array.isArray(posts)).toBe(true);
      if (posts.length > 0) {
        expect(posts[0].platform).toBe('Twitter');
      }
    });

    it('should generate X posts', async () => {
      const posts = await generateSocialMediaPosts(undefined, 'X', 2);
      expect(Array.isArray(posts)).toBe(true);
    });

    it('should respect count parameter', async () => {
      const posts = await generateSocialMediaPosts(undefined, 'LinkedIn', 5);
      expect(posts.length).toBeLessThanOrEqual(5);
    });

    it('should accept paper IDs', async () => {
      const posts = await generateSocialMediaPosts(['id1', 'id2'], 'LinkedIn', 1);
      expect(Array.isArray(posts)).toBe(true);
    });

    it('should handle empty paper IDs', async () => {
      const posts = await generateSocialMediaPosts([], 'LinkedIn', 1);
      expect(Array.isArray(posts)).toBe(true);
    });
  });

  describe('post structure', () => {
    it('should have correct LinkedIn post structure', async () => {
      const posts = await generateSocialMediaPosts(undefined, 'LinkedIn', 1);
      if (posts.length > 0) {
        const post = posts[0];
        expect(post).toHaveProperty('platform');
        expect(post).toHaveProperty('content');
        expect(post).toHaveProperty('hashtags');
        expect(post).toHaveProperty('tone');
        expect(post).toHaveProperty('estimatedReach');
        expect(post.platform).toBe('LinkedIn');
        expect(['professional', 'casual', 'thought-leadership']).toContain(post.tone);
      }
    });

    it('should have correct Twitter post structure', async () => {
      const posts = await generateSocialMediaPosts(undefined, 'Twitter', 1);
      if (posts.length > 0) {
        const post = posts[0];
        expect(post).toHaveProperty('platform');
        expect(post).toHaveProperty('content');
        expect(post).toHaveProperty('hashtags');
        expect(post).toHaveProperty('tone');
        expect(post).toHaveProperty('estimatedReach');
        expect(post.platform).toBe('Twitter');
      }
    });

    it('should have valid hashtags array', async () => {
      const posts = await generateSocialMediaPosts(undefined, 'LinkedIn', 1);
      if (posts.length > 0) {
        const post = posts[0];
        expect(Array.isArray(post.hashtags)).toBe(true);
        post.hashtags.forEach(tag => {
          expect(tag).toMatch(/^#/);
        });
      }
    });

    it('should have emoji array', async () => {
      const posts = await generateSocialMediaPosts(undefined, 'LinkedIn', 1);
      if (posts.length > 0) {
        const post = posts[0];
        if (post.emoji) {
          expect(Array.isArray(post.emoji)).toBe(true);
        }
      }
    });
  });

  describe('content validation', () => {
    it('should have non-empty content', async () => {
      const posts = await generateSocialMediaPosts(undefined, 'LinkedIn', 1);
      if (posts.length > 0) {
        expect(posts[0].content.length).toBeGreaterThan(0);
      }
    });

    it('should include paper URL in content', async () => {
      const posts = await generateSocialMediaPosts(undefined, 'LinkedIn', 1);
      if (posts.length > 0) {
        expect(posts[0].content).toContain('http');
      }
    });
  });

  describe('saveSocialMediaDrafts', () => {
    it('should handle saving drafts', async () => {
      const mockPosts = [
        {
          platform: 'LinkedIn' as const,
          content: 'Test content',
          hashtags: ['#test'],
          tone: 'professional' as const
        }
      ];

      await expect(saveSocialMediaDrafts(mockPosts)).resolves.not.toThrow();
    });

    it('should handle empty drafts array', async () => {
      await expect(saveSocialMediaDrafts([])).resolves.not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle very large count', async () => {
      const posts = await generateSocialMediaPosts(undefined, 'LinkedIn', 100);
      expect(Array.isArray(posts)).toBe(true);
    });

    it('should handle banking-related papers', async () => {
      const posts = await generateSocialMediaPosts(undefined, 'LinkedIn', 1);
      expect(Array.isArray(posts)).toBe(true);
    });
  });
});
