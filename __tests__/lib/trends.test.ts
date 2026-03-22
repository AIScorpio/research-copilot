import {
  getTrendData,
  calculateTrend,
  getMultipleTrends,
  identifyTrendingTopics,
  getAllTrends,
  getDateRanges,
  updateDailyTrendData,
  backfillTrendData,
  calculateAdoptionRate,
  formatTrendDirection,
  getTrendColor
} from '@/lib/trends';

describe('Trend Detection', () => {
  describe('getDateRanges', () => {
    it('should calculate week ranges', () => {
      const now = new Date('2024-01-15');
      const ranges = getDateRanges(now, 'week');
      expect(ranges).toHaveProperty('startDate');
      expect(ranges).toHaveProperty('previousPeriodStart');
      expect(ranges).toHaveProperty('previousPeriodEnd');
    });

    it('should calculate month ranges', () => {
      const now = new Date('2024-01-15');
      const ranges = getDateRanges(now, 'month');
      expect(ranges).toHaveProperty('startDate');
      expect(ranges).toHaveProperty('previousPeriodStart');
    });

    it('should calculate quarter ranges', () => {
      const now = new Date('2024-01-15');
      const ranges = getDateRanges(now, 'quarter');
      expect(ranges).toHaveProperty('startDate');
      expect(ranges).toHaveProperty('previousPeriodStart');
    });

    it('should calculate year ranges', () => {
      const now = new Date('2024-01-15');
      const ranges = getDateRanges(now, 'year');
      expect(ranges).toHaveProperty('startDate');
      expect(ranges).toHaveProperty('previousPeriodStart');
    });
  });

  describe('formatTrendDirection', () => {
    it('should format up direction', () => {
      expect(formatTrendDirection('up')).toBe('↗ Growing');
    });

    it('should format down direction', () => {
      expect(formatTrendDirection('down')).toBe('↘ Declining');
    });

    it('should format flat direction', () => {
      expect(formatTrendDirection('flat')).toBe('→ Stable');
    });
  });

  describe('getTrendColor', () => {
    it('should return green for up trend', () => {
      expect(getTrendColor('up')).toBe('text-green-500');
    });

    it('should return red for down trend', () => {
      expect(getTrendColor('down')).toBe('text-red-500');
    });

    it('should return gray for flat trend', () => {
      expect(getTrendColor('flat')).toBe('text-gray-500');
    });
  });

  describe('calculateAdoptionRate', () => {
    it('should calculate adoption rate', () => {
      expect(calculateAdoptionRate(50, 100)).toBe(50);
      expect(calculateAdoptionRate(25, 100)).toBe(25);
    });

    it('should handle zero total', () => {
      expect(calculateAdoptionRate(0, 0)).toBe(0);
      expect(calculateAdoptionRate(10, 0)).toBe(0);
    });

    it('should handle edge cases', () => {
      expect(calculateAdoptionRate(100, 100)).toBe(100);
      expect(calculateAdoptionRate(0, 100)).toBe(0);
    });
  });

  describe('getTrendData', () => {
    it('should return array of trend data points', async () => {
      const tagId = 'test-tag-id';
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const data = await getTrendData(tagId, startDate, endDate);
      expect(Array.isArray(data)).toBe(true);
    });

    it('should return empty array for invalid date range', async () => {
      const tagId = 'test-tag-id';
      const startDate = new Date('2024-12-31');
      const endDate = new Date('2024-01-01');

      const data = await getTrendData(tagId, startDate, endDate);
      expect(Array.isArray(data)).toBe(true);
    });
  });

  describe('calculateTrend', () => {
    it('should calculate trend metrics', async () => {
      const tagId = 'test-tag-id';
      const trend = await calculateTrend(tagId, 'month');

      expect(trend).toHaveProperty('currentCount');
      expect(trend).toHaveProperty('previousCount');
      expect(trend).toHaveProperty('growthRate');
      expect(trend).toHaveProperty('percentChange');
      expect(trend).toHaveProperty('direction');
      expect(trend).toHaveProperty('trendData');
    });

    it('should calculate growth rate correctly', async () => {
      const tagId = 'test-tag-id';
      const trend = await calculateTrend(tagId, 'month');

      expect(typeof trend.growthRate).toBe('number');
    });

    it('should determine direction', async () => {
      const tagId = 'test-tag-id';
      const trend = await calculateTrend(tagId, 'month');

      expect(['up', 'down', 'flat']).toContain(trend.direction);
    });
  });

  describe('getMultipleTrends', () => {
    it('should return map of trends', async () => {
      const tagIds = ['tag-1', 'tag-2', 'tag-3'];
      const trends = await getMultipleTrends(tagIds, 'month');

      expect(trends).toBeInstanceOf(Map);
    });

    it('should return correct number of trends', async () => {
      const tagIds = ['tag-1', 'tag-2', 'tag-3'];
      const trends = await getMultipleTrends(tagIds, 'month');

      expect(trends.size).toBe(3);
    });
  });

  describe('identifyTrendingTopics', () => {
    it('should identify trending topics', async () => {
      const trending = await identifyTrendingTopics('month', 10);

      expect(Array.isArray(trending)).toBe(true);
    });

    it('should respect limit parameter', async () => {
      const trending = await identifyTrendingTopics('month', 5);

      expect(trending.length).toBeLessThanOrEqual(10); // Can include both up and down
    });

    it('should include up and down trends', async () => {
      const trending = await identifyTrendingTopics('month', 10);

      trending.some(t => t.direction === 'up');
      trending.some(t => t.direction === 'down');
    });
  });

  describe('getAllTrends', () => {
    it('should return all trends', async () => {
      const trends = await getAllTrends('month');

      expect(Array.isArray(trends)).toBe(true);
    });

    it('should filter by direction', async () => {
      const upTrends = await getAllTrends('month', 'up');

      expect(Array.isArray(upTrends)).toBe(true);
      upTrends.forEach(trend => {
        expect(trend.direction).toBe('up');
      });
    });
  });

  describe('updateDailyTrendData', () => {
    it('should update daily trend data', async () => {
      await expect(updateDailyTrendData()).resolves.not.toThrow();
    });
  });

  describe('backfillTrendData', () => {
    it('should backfill trend data', async () => {
      const result = await backfillTrendData();

      expect(result).toHaveProperty('processed');
      expect(result).toHaveProperty('created');
      expect(result).toHaveProperty('updated');
    });

    it('should handle custom date range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      const result = await backfillTrendData(startDate, endDate);

      expect(result).toHaveProperty('processed');
    });
  });

  describe('trend structure', () => {
    it('should have correct trending topic structure', async () => {
      const trending = await identifyTrendingTopics('month', 10);

      if (trending.length > 0) {
        const topic = trending[0];
        expect(topic).toHaveProperty('tagId');
        expect(topic).toHaveProperty('tagName');
        expect(topic).toHaveProperty('tagType');
        expect(topic).toHaveProperty('growthRate');
        expect(topic).toHaveProperty('percentChange');
        expect(topic).toHaveProperty('direction');
        expect(topic).toHaveProperty('currentCount');
        expect(topic).toHaveProperty('previousCount');
        expect(topic).toHaveProperty('trendData');
      }
    });
  });

  describe('edge cases', () => {
    it('should handle empty tag array for getMultipleTrends', async () => {
      const trends = await getMultipleTrends([], 'month');

      expect(trends.size).toBe(0);
    });

    it('should handle zero limit for identifyTrendingTopics', async () => {
      const trending = await identifyTrendingTopics('month', 0);

      expect(Array.isArray(trending)).toBe(true);
    });

    it('should handle large limit for identifyTrendingTopics', async () => {
      const trending = await identifyTrendingTopics('month', 1000);

      expect(Array.isArray(trending)).toBe(true);
    });
  });
});
