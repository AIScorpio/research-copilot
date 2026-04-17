import { z } from 'zod';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const schemas = {
  auth: {
    register: z.object({
      email: z.string().email('Invalid email address'),
      password: z.string().min(8, 'Password must be at least 8 characters').max(128),
    }).strict(),

    login: z.object({
      email: z.string().email('Invalid email address'),
      password: z.string().min(1, 'Password is required'),
    }).strict(),

    socialInit: z.object({
      platform: z.enum(['reddit', 'linkedin', 'twitter', 'mastodon']),
      sourceId: z.string().optional().default('default'),
      authConfig: z.object({
        clientId: z.string().optional(),
        clientSecret: z.string().optional(),
        redirectUri: z.string().url('Invalid redirect URI').optional(),
        scopes: z.array(z.string()).optional(),
      }).optional(),
    }).strict(),

    socialComplete: z.object({
      platform: z.enum(['reddit', 'linkedin', 'twitter', 'mastodon']),
      code: z.string().min(1, 'Authorization code is required'),
      state: z.string().min(1, 'State is required'),
    }).strict(),

    socialStatus: z.object({
      platform: z.enum(['reddit', 'linkedin', 'twitter', 'mastodon']),
      sourceId: z.string().optional().default('default'),
    }).strict(),
  },

  papers: {
    query: z.object({
      search: z.string().max(200).optional(),
      sector: z.string().max(100).optional(),
      topic: z.string().max(100).optional(),
      page: z.coerce.number().int().positive().default(1),
      pageSize: z.coerce.number().int().positive().max(100).default(50),
    }).strict(),

    id: z.object({
      id: z.string().regex(UUID_REGEX, 'Invalid paper ID format'),
    }).strict(),

    update: z.object({
      publicationDate: z.string().or(z.date()).optional(),
    }).strict(),

    addTag: z.object({
      tagName: z.string().min(1, 'Tag name is required').max(100, 'Tag name too long'),
    }).strict(),

    removeTag: z.object({
      tagId: z.string().regex(UUID_REGEX, 'Invalid tag ID format'),
    }).strict(),
  },

  alerts: {
    query: z.object({
      status: z.enum(['new', 'read', 'dismissed']).optional(),
      priority: z.enum(['HIGH', 'MEDIUM', 'LOW']).optional(),
      source: z.string().max(100).optional(),
      limit: z.coerce.number().int().positive().max(100).default(50),
      offset: z.coerce.number().int().nonnegative().default(0),
    }).strict(),

    update: z.object({
      id: z.string().regex(UUID_REGEX, 'Invalid alert ID format'),
      status: z.enum(['new', 'read', 'dismissed']).optional(),
      priority: z.enum(['HIGH', 'MEDIUM', 'LOW']).optional(),
    }).strict(),

    create: z.object({
      sourceId: z.string().min(1, 'Source ID is required'),
      sourceName: z.string().min(1, 'Source name is required').max(100),
      title: z.string().min(1, 'Title is required').max(500),
      content: z.string().min(1, 'Content is required').max(10000),
      url: z.string().url('Invalid URL format'),
      keywords: z.array(z.string()).min(1, 'At least one keyword is required').max(50),
      relevance: z.number().min(0, 'Relevance must be between 0 and 100').max(100),
      priority: z.enum(['HIGH', 'MEDIUM', 'LOW']),
      status: z.enum(['new', 'read', 'dismissed']).optional().default('new'),
    }).strict(),
  },

  sources: {
    create: z.object({
      name: z.string().min(1, 'Source name is required').max(100),
      url: z.string().url('Invalid URL format').max(500),
    }).strict(),

    delete: z.object({
      id: z.string().regex(UUID_REGEX, 'Invalid source ID format'),
    }).strict(),
  },

  collection: {
    create: z.object({
      query: z.string().min(1, 'Query is required').max(500).optional(),
      horizon: z.enum(['today', 'week', 'month', 'year', 'custom']).optional(),
      dateFrom: z.string().regex(/^\d{4}$/, 'Invalid year format').optional(),
      dateTo: z.string().regex(/^\d{4}$/, 'Invalid year format').optional(),
      useAgent: z.boolean().optional(),
    }).strict(),
  },

  autoCollect: z.object({
    override: z.object({
      query: z.string().min(1).max(500).optional(),
      horizon: z.enum(['today', 'week', 'month', 'year']).optional(),
    }).optional(),
  }).strict(),

  newsletters: {
    query: z.object({
      limit: z.coerce.number().int().positive().max(100).default(50),
    }).strict(),

    create: z.object({
      title: z.string().min(1, 'Title is required').max(200),
      content: z.string().min(1, 'Content is required').max(100000),
      dateCode: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format').optional(),
      paperCount: z.number().int().nonnegative().optional(),
    }).strict(),
  },

  export: {
    digest: z.object({
      frequency: z.enum(['daily', 'weekly', 'monthly']),
      recipientEmail: z.string().email('Invalid email address'),
      includePowerPoint: z.boolean().default(false),
      includeSocialPosts: z.boolean().default(false),
      includeStats: z.boolean().default(true),
      maxPapers: z.number().int().min(1).max(50).default(20),
      topics: z.array(z.string().max(100)).optional(),
      days: z.number().int().min(1).max(365).default(7),
    }).strict(),

    scheduleDigest: z.object({
      frequency: z.enum(['daily', 'weekly', 'monthly']),
      recipientEmail: z.string().email('Invalid email address'),
    }).strict(),

    socialMedia: z.object({
      paperIds: z.array(z.string().regex(UUID_REGEX)).optional(),
      platform: z.enum(['LinkedIn', 'Twitter', 'X']).default('LinkedIn'),
      count: z.number().int().min(1).max(10).default(1),
    }).strict(),

    powerPoint: z.object({
      days: z.number().int().min(1).max(365).default(30),
      limit: z.number().int().min(1).max(50).default(10),
      search: z.string().max(200).optional(),
      includeAbstract: z.boolean().default(true),
      includeSummary: z.boolean().default(true),
      includeTags: z.boolean().default(true),
    }).strict(),
  },

  chat: z.object({
    messages: z.array(z.object({
      role: z.enum(['user', 'assistant', 'system']),
      content: z.string().min(1, 'Message content is required').max(5000),
    })).min(1, 'At least one message is required').max(50, 'Too many messages'),
  }).strict(),

  chatSessions: {
    list: z.object({
      limit: z.coerce.number().int().positive().max(100).default(50),
      offset: z.coerce.number().int().nonnegative().default(0),
    }).strict(),

    update: z.object({
      title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
    }).strict(),
  },

  tags: {
    create: z.object({
      name: z.string().min(1, 'Tag name is required').max(100),
      category: z.string().min(1, 'Category is required').max(100).optional(),
    }).strict(),
  },

  userNotifications: {
    toggle: z.object({
      emailAlerts: z.boolean().optional(),
      newsletterAlerts: z.boolean().optional(),
    }).strict(),

    addSubscriber: z.object({
      action: z.literal('add'),
      email: z.string().email('Invalid email address'),
    }).strict(),

    removeSubscriber: z.object({
      action: z.literal('remove'),
      email: z.string().email('Invalid email address'),
    }).strict(),
  },

  stats: {
    query: z.object({
      days: z.coerce.number().int().min(1).max(365).default(30),
    }).strict(),
  },

  radar: {
    query: z.object({
      days: z.coerce.number().int().min(1).max(365).default(90),
    }).strict(),
  },

  recommendations: {
    query: z.object({
      limit: z.coerce.number().int().min(1).max(50).default(10),
      domain: z.string().max(100).optional(),
    }).strict(),
  },

  competitiveIntel: {
    query: z.object({
      days: z.coerce.number().int().min(1).max(365).default(30),
      limit: z.coerce.number().int().min(1).max(100).default(50),
    }).strict(),

    create: z.object({
      days: z.number().int().min(1).max(365).default(30),
    }).strict(),
  },

  trends: {
    query: z.object({
      tagIds: z.string().optional(),
      period: z.enum(['week', 'month', 'quarter', 'year']).default('month'),
      days: z.coerce.number().int().min(1).max(365).optional(),
      direction: z.enum(['up', 'down', 'flat']).optional(),
      limit: z.coerce.number().int().min(1).max(100).default(50),
    }).strict(),

    trending: z.object({
      period: z.enum(['week', 'month', 'quarter', 'year']).default('month'),
      limit: z.coerce.number().int().min(1).max(100).default(10),
    }).strict(),
  },
};

export type ValidationSchemas = typeof schemas;
