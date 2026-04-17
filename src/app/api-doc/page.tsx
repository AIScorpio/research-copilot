"use client";

import { useState } from "react";
import { 
  ChevronDown, 
  Terminal, 
  BookOpen, 
  Code,
  Server,
  Lock,
  AlertCircle,
  Copy,
  Check,
  BarChart3,
  Download,
  Settings,
  Tag,
  Cpu,
  FileText,
  Bell,
  Database,
  Newspaper,
  Share2
} from "lucide-react";

interface ApiEndpoint {
  method: string;
  path: string;
  summary: string;
  description?: string;
  parameters?: Array<{
    name: string;
    in: string;
    required?: boolean;
    type: string;
    description?: string;
  }>;
  requestBody?: {
    description?: string;
    example?: any;
  };
  responses?: Array<{
    code: string;
    description: string;
  }>;
}

interface ApiGroup {
  name: string;
  icon: React.ReactNode;
  description: string;
  endpoints: ApiEndpoint[];
}

// ALL 63 API endpoints organized alphabetically by category
const apiGroups: ApiGroup[] = [
  {
    name: "Alerts",
    icon: <Bell className="w-5 h-5" />,
    description: "User alerts and notifications management",
    endpoints: [
      {
        method: "GET",
        path: "/api/alerts",
        summary: "Get user alerts",
        description: "Retrieve user alerts with optional filtering by status, priority, and source",
        parameters: [
          { name: "status", in: "query", type: "string", description: "Filter by status (new, read, dismissed)" },
          { name: "priority", in: "query", type: "string", description: "Filter by priority (LOW, MEDIUM, HIGH, CRITICAL)" },
          { name: "source", in: "query", type: "string", description: "Filter by source name" },
          { name: "limit", in: "query", type: "integer", description: "Number of results (default: 20)" },
          { name: "offset", in: "query", type: "integer", description: "Pagination offset (default: 0)" }
        ],
        responses: [
          { code: "200", description: "List of alerts retrieved successfully" },
          { code: "500", description: "Server error" }
        ]
      },
      {
        method: "POST",
        path: "/api/alerts",
        summary: "Create new alert",
        description: "Create a new regulatory alert or test alert",
        requestBody: {
          example: {
            sourceId: "test-source",
            sourceName: "Test Source",
            title: "AI in Credit Decisions: New Regulatory Guidance",
            content: "Federal Reserve releases new guidance...",
            url: "https://example.com/test-alert",
            keywords: ["artificial intelligence", "credit decisions"],
            relevance: 95,
            priority: "HIGH",
            status: "new",
            test: true
          }
        },
        responses: [
          { code: "201", description: "Alert created successfully" },
          { code: "400", description: "Invalid input or duplicate URL" },
          { code: "401", description: "Unauthorized" },
          { code: "403", description: "Invalid CSRF token" }
        ]
      },
      {
        method: "PUT",
        path: "/api/alerts",
        summary: "Update alert",
        description: "Update alert information and status",
        requestBody: {
          example: {
            id: "alert-uuid",
            status: "read",
            priority: "MEDIUM"
          }
        },
        responses: [
          { code: "200", description: "Alert updated successfully" },
          { code: "401", description: "Unauthorized" },
          { code: "403", description: "Invalid CSRF token" }
        ]
      },
      {
        method: "PUT",
        path: "/api/alerts/{id}",
        summary: "Update specific alert",
        description: "Update a specific alert by ID",
        parameters: [
          { name: "id", in: "path", required: true, type: "string", description: "Alert ID" }
        ],
        requestBody: {
          example: {
            status: "read",
            priority: "HIGH"
          }
        },
        responses: [
          { code: "200", description: "Alert updated successfully" },
          { code: "400", description: "Invalid input" },
          { code: "401", description: "Unauthorized" },
          { code: "404", description: "Alert not found" }
        ]
      },
      {
        method: "DELETE",
        path: "/api/alerts/{id}",
        summary: "Delete alert",
        description: "Delete a specific alert by ID",
        parameters: [
          { name: "id", in: "path", required: true, type: "string", description: "Alert ID" }
        ],
        responses: [
          { code: "200", description: "Alert deleted successfully" },
          { code: "401", description: "Unauthorized" },
          { code: "403", description: "Invalid CSRF token" },
          { code: "404", description: "Alert not found" }
        ]
      }
    ]
  },
  {
    name: "Analytics & Insights",
    icon: <BarChart3 className="w-5 h-5" />,
    description: "Statistics, trends and competitive intelligence",
    endpoints: [
      {
        method: "GET",
        path: "/api/stats",
        summary: "Get dashboard statistics",
        description: "Retrieve dashboard statistics including total papers and category breakdown",
        responses: [
          { code: "200", description: "Statistics retrieved successfully" },
          { code: "500", description: "Server error" }
        ]
      },
      {
        method: "GET",
        path: "/api/trends",
        summary: "Get research trends",
        description: "Get research trends analysis",
        parameters: [
          { name: "period", in: "query", type: "string", description: "Time period (7d, 30d, 90d)" },
          { name: "metric", in: "query", type: "string", description: "Metric type (papers, tags, sources)" }
        ],
        responses: [
          { code: "200", description: "Trends data retrieved" }
        ]
      },
      {
        method: "GET",
        path: "/api/radar",
        summary: "Get technology radar",
        description: "Get technology radar data with quadrants and technologies",
        responses: [
          { code: "200", description: "Radar data retrieved" }
        ]
      },
      {
        method: "GET",
        path: "/api/recommendations",
        summary: "Get recommendations",
        description: "Get paper recommendations",
        parameters: [
          { name: "limit", in: "query", type: "integer", description: "Number of recommendations (default: 10)" }
        ],
        responses: [
          { code: "200", description: "Recommendations retrieved" }
        ]
      },
      {
        method: "GET",
        path: "/api/recommendations/poc",
        summary: "Get PoC recommendations",
        description: "Get proof-of-concept recommendations",
        responses: [
          { code: "200", description: "PoC recommendations retrieved" }
        ]
      },
      {
        method: "GET",
        path: "/api/competitive-intel",
        summary: "Get competitive intelligence",
        description: "Get competitive intelligence analysis",
        responses: [
          { code: "200", description: "Competitive intelligence retrieved" }
        ]
      }
    ]
  },
  {
    name: "Authentication",
    icon: <Lock className="w-5 h-5" />,
    description: "User authentication and session management",
    endpoints: [
      {
        method: "POST",
        path: "/api/auth/login",
        summary: "User login",
        description: "Authenticate user with email and password",
        requestBody: {
          example: {
            email: "user@example.com",
            password: "your-password"
          }
        },
        responses: [
          { code: "200", description: "Login successful" },
          { code: "401", description: "Invalid credentials" }
        ]
      },
      {
        method: "POST",
        path: "/api/auth/register",
        summary: "User registration",
        description: "Register new user",
        requestBody: {
          example: {
            email: "user@example.com",
            password: "your-password",
            name: "User Name"
          }
        },
        responses: [
          { code: "200", description: "Registration successful" },
          { code: "400", description: "Invalid input" }
        ]
      },
      {
        method: "GET",
        path: "/api/auth/me",
        summary: "Get current user",
        description: "Get current authenticated user info",
        responses: [
          { code: "200", description: "User info retrieved" },
          { code: "401", description: "Not authenticated" }
        ]
      },
      {
        method: "POST",
        path: "/api/auth/logout",
        summary: "User logout",
        description: "Logout current user",
        responses: [
          { code: "200", description: "Logout successful" }
        ]
      },
      {
        method: "POST",
        path: "/api/auth/google",
        summary: "Google OAuth login",
        description: "Authenticate via Google OAuth",
        responses: [
          { code: "200", description: "Authentication successful" }
        ]
      },
      {
        method: "POST",
        path: "/api/auth/oauth",
        summary: "OAuth initialization",
        description: "Initialize OAuth flow",
        requestBody: {
          example: {
            provider: "google",
            redirectUri: "https://example.com/callback"
          }
        },
        responses: [
          { code: "200", description: "OAuth initialized" }
        ]
      },
      {
        method: "GET",
        path: "/api/auth/callback",
        summary: "OAuth callback",
        description: "Handle OAuth callback",
        parameters: [
          { name: "code", in: "query", required: true, type: "string", description: "Authorization code" },
          { name: "state", in: "query", type: "string", description: "State parameter" }
        ],
        responses: [
          { code: "200", description: "OAuth callback handled" },
          { code: "400", description: "Invalid callback parameters" }
        ]
      },
      {
        method: "POST",
        path: "/api/auth/social",
        summary: "Social login",
        description: "Handle social media login",
        requestBody: {
          example: {
            provider: "github",
            accessToken: "gho_xxxxxxxx"
          }
        },
        responses: [
          { code: "200", description: "Social login successful" },
          { code: "401", description: "Invalid social token" }
        ]
      }
    ]
  },
  {
    name: "Collection Pipeline",
    icon: <Database className="w-5 h-5" />,
    description: "Paper collection and auto-collection management",
    endpoints: [
      {
        method: "POST",
        path: "/api/collection",
        summary: "Trigger collection",
        description: "Start paper collection pipeline with auto or pipeline mode",
        requestBody: {
          example: {
            mode: "pipeline",
            query: "machine learning banking",
            horizon: "month",
            useLLMOptimization: true,
            useLLMFiltering: true,
            maxResults: 20,
            minRelevanceScore: 70
          }
        },
        responses: [
          { code: "200", description: "Collection completed" },
          { code: "400", description: "Invalid input" }
        ]
      },
      {
        method: "GET",
        path: "/api/collection",
        summary: "Get collection stats",
        description: "Get collection statistics and status",
        responses: [
          { code: "200", description: "Stats retrieved" }
        ]
      },
      {
        method: "POST",
        path: "/api/auto-collect",
        summary: "Trigger auto-collection",
        description: "Trigger automatic collection based on preferences",
        requestBody: {
          example: {
            sources: ["arxiv", "pubmed"],
            keywords: ["machine learning", "AI"],
            limit: 50
          }
        },
        responses: [
          { code: "200", description: "Auto-collection triggered" }
        ]
      },
      {
        method: "GET",
        path: "/api/sources",
        summary: "Get sources",
        description: "Get all paper sources with optional filtering",
        parameters: [
          { name: "active", in: "query", type: "boolean", description: "Filter by active status" },
          { name: "type", in: "query", type: "string", description: "Filter by source type" }
        ],
        responses: [
          { code: "200", description: "Sources retrieved" }
        ]
      },
      {
        method: "POST",
        path: "/api/sources",
        summary: "Create source",
        description: "Create a new paper source",
        requestBody: {
          example: {
            name: "Custom RSS Feed",
            url: "https://example.com/feed.xml",
            type: "rss",
            active: true,
            config: {
              refreshInterval: 3600
            }
          }
        },
        responses: [
          { code: "201", description: "Source created successfully" },
          { code: "400", description: "Invalid input" },
          { code: "409", description: "Source already exists" }
        ]
      },
      {
        method: "DELETE",
        path: "/api/sources",
        summary: "Delete source",
        description: "Delete one or more sources",
        requestBody: {
          example: {
            ids: ["source-uuid-1", "source-uuid-2"]
          }
        },
        responses: [
          { code: "200", description: "Sources deleted successfully" },
          { code: "404", description: "Source not found" }
        ]
      },
      {
        method: "PATCH",
        path: "/api/sources",
        summary: "Update source",
        description: "Partially update source configuration",
        requestBody: {
          example: {
            id: "source-uuid",
            active: false,
            config: {
              refreshInterval: 7200
            }
          }
        },
        responses: [
          { code: "200", description: "Source updated successfully" },
          { code: "400", description: "Invalid input" },
          { code: "404", description: "Source not found" }
        ]
      },
      {
        method: "GET",
        path: "/api/source-types",
        summary: "Get source types",
        description: "Get available source types and their configurations",
        responses: [
          { code: "200", description: "Source types retrieved" }
        ]
      }
    ]
  },
  {
    name: "Daily Digest",
    icon: <Newspaper className="w-5 h-5" />,
    description: "Generate and manage daily research digests",
    endpoints: [
      {
        method: "GET",
        path: "/api/daily-digest",
        summary: "Get digest for date",
        description: "Retrieve the daily intelligence digest for a specific date. Returns cached content if available, or triggers generation if needed.",
        parameters: [
          { name: "date", in: "query", required: false, type: "string", description: "Date in YYYY-MM-DD format (Beijing Time). Defaults to today." }
        ],
        responses: [
          { code: "200", description: "Digest retrieved successfully" },
          { code: "404", description: "No digest found for date" },
          { code: "500", description: "Generation failed" }
        ]
      },
      {
        method: "POST",
        path: "/api/daily-digest",
        summary: "Regenerate digest",
        description: "Force regeneration of the daily digest for a specific date",
        requestBody: {
          example: { dateCode: "2026-03-23" }
        },
        responses: [
          { code: "200", description: "Digest regenerated successfully" },
          { code: "400", description: "Invalid date format" },
          { code: "500", description: "Generation failed" }
        ]
      },
      {
        method: "GET",
        path: "/api/daily-digest/batch",
        summary: "List missing digests",
        description: "Get all dates that have papers but no corresponding digests",
        responses: [
          { code: "200", description: "List of dates with missing digests" }
        ]
      },
      {
        method: "POST",
        path: "/api/daily-digest/batch",
        summary: "Generate batch digests",
        description: "Generate digests for multiple historical dates in one request",
        requestBody: {
          example: {
            dateCodes: ["2026-03-21", "2026-03-22"],
            maxConcurrent: 3
          }
        },
        responses: [
          { code: "200", description: "Batch processing completed" },
          { code: "400", description: "Invalid request body" }
        ]
      }
    ]
  },
  {
    name: "Export",
    icon: <Download className="w-5 h-5" />,
    description: "Export papers and digests to various formats",
    endpoints: [
      {
        method: "POST",
        path: "/api/export/powerpoint",
        summary: "Export to PowerPoint",
        description: "Export papers to PowerPoint presentation",
        requestBody: {
          example: {
            paperIds: ["uuid1", "uuid2"],
            template: "banking-research"
          }
        },
        responses: [
          { code: "200", description: "PowerPoint generated successfully" }
        ]
      },
      {
        method: "POST",
        path: "/api/export/social-media",
        summary: "Generate social media content",
        description: "Generate social media content from papers",
        requestBody: {
          example: {
            paperIds: ["uuid1"],
            platform: "linkedin",
            tone: "professional"
          }
        },
        responses: [
          { code: "200", description: "Social media content generated" }
        ]
      },
      {
        method: "POST",
        path: "/api/export/digest",
        summary: "Export digest",
        description: "Export digest in various formats",
        requestBody: {
          example: {
            dateCode: "2026-03-23",
            format: "pdf"
          }
        },
        responses: [
          { code: "200", description: "Digest exported successfully" }
        ]
      }
    ]
  },
  {
    name: "LLM Configuration",
    icon: <Cpu className="w-5 h-5" />,
    description: "LLM providers, models and configuration",
    endpoints: [
      {
        method: "GET",
        path: "/api/llm-providers",
        summary: "List LLM providers",
        description: "List all configured LLM providers",
        responses: [
          { code: "200", description: "Providers retrieved successfully" }
        ]
      },
      {
        method: "POST",
        path: "/api/llm-providers",
        summary: "Create provider",
        description: "Create a new LLM provider configuration",
        requestBody: {
          example: {
            name: "OpenAI",
            type: "openai",
            apiKey: "sk-xxxxxxxx",
            baseUrl: "https://api.openai.com/v1",
            defaultModel: "gpt-4",
            enabled: true
          }
        },
        responses: [
          { code: "201", description: "Provider created successfully" },
          { code: "400", description: "Invalid input" },
          { code: "409", description: "Provider already exists" }
        ]
      },
      {
        method: "PATCH",
        path: "/api/llm-providers",
        summary: "Update provider",
        description: "Update an existing LLM provider configuration",
        requestBody: {
          example: {
            id: "provider-uuid",
            defaultModel: "gpt-4-turbo",
            enabled: true
          }
        },
        responses: [
          { code: "200", description: "Provider updated successfully" },
          { code: "400", description: "Invalid input" },
          { code: "404", description: "Provider not found" }
        ]
      },
      {
        method: "DELETE",
        path: "/api/llm-providers",
        summary: "Delete provider",
        description: "Delete an LLM provider configuration",
        requestBody: {
          example: {
            id: "provider-uuid"
          }
        },
        responses: [
          { code: "200", description: "Provider deleted successfully" },
          { code: "404", description: "Provider not found" }
        ]
      },
      {
        method: "GET",
        path: "/api/llm-models",
        summary: "List LLM models",
        description: "List available models for current provider",
        responses: [
          { code: "200", description: "Models retrieved successfully" }
        ]
      },
      {
        method: "GET",
        path: "/api/llm-providers/groq-models",
        summary: "Get Groq models",
        description: "Get Groq-specific models",
        responses: [
          { code: "200", description: "Groq models retrieved" }
        ]
      },
      {
        method: "GET",
        path: "/api/llm-providers/ollama-models",
        summary: "Get Ollama models",
        description: "Get Ollama-specific models",
        responses: [
          { code: "200", description: "Ollama models retrieved" }
        ]
      },
      {
        method: "POST",
        path: "/api/llm-models/test",
        summary: "Test LLM model",
        description: "Test LLM model connection",
        requestBody: {
          example: {
            provider: "groq",
            model: "llama-3.3-70b-versatile"
          }
        },
        responses: [
          { code: "200", description: "Model test successful" },
          { code: "400", description: "Invalid provider or model" },
          { code: "500", description: "Connection test failed" }
        ]
      },
      {
        method: "POST",
        path: "/api/llm-init",
        summary: "Initialize LLM",
        description: "Initialize or reconfigure LLM service",
        requestBody: {
          example: {
            provider: "groq",
            model: "llama-3.3-70b-versatile",
            temperature: 0.7
          }
        },
        responses: [
          { code: "200", description: "LLM initialized successfully" },
          { code: "400", description: "Invalid configuration" }
        ]
      },
      {
        method: "POST",
        path: "/api/chat",
        summary: "Chat completion",
        description: "Send a chat completion request to the configured LLM",
        requestBody: {
          example: {
            messages: [
              { role: "system", content: "You are a helpful assistant." },
              { role: "user", content: "Summarize this research paper." }
            ],
            temperature: 0.7,
            maxTokens: 1000
          }
        },
        responses: [
          { code: "200", description: "Chat completion successful" },
          { code: "400", description: "Invalid request" },
          { code: "500", description: "LLM service error" }
        ]
      }
    ]
  },
  {
    name: "Papers Management",
    icon: <FileText className="w-5 h-5" />,
    description: "Manage research papers",
    endpoints: [
      {
        method: "GET",
        path: "/api/papers",
        summary: "List papers",
        description: "Retrieve papers with filtering, search, and pagination support",
        parameters: [
          { name: "search", in: "query", type: "string", description: "Search query for title and abstract" },
          { name: "sector", in: "query", type: "string", description: "Filter by sector tag" },
          { name: "topic", in: "query", type: "string", description: "Filter by topic tag" },
          { name: "page", in: "query", type: "integer", description: "Page number (default: 1)" },
          { name: "pageSize", in: "query", type: "integer", description: "Items per page (default: 20)" }
        ],
        responses: [
          { code: "200", description: "List of papers retrieved" }
        ]
      },
      {
        method: "GET",
        path: "/api/papers/{id}",
        summary: "Get paper details",
        description: "Get single paper details by ID",
        parameters: [
          { name: "id", in: "path", required: true, type: "string", description: "Paper ID" }
        ],
        responses: [
          { code: "200", description: "Paper details retrieved" },
          { code: "404", description: "Paper not found" }
        ]
      },
      {
        method: "PUT",
        path: "/api/papers/{id}",
        summary: "Update paper",
        description: "Update paper information",
        parameters: [
          { name: "id", in: "path", required: true, type: "string", description: "Paper ID" }
        ],
        requestBody: {
          example: {
            title: "Updated Title",
            abstract: "Updated abstract...",
            tags: ["AI", "Finance"]
          }
        },
        responses: [
          { code: "200", description: "Paper updated" },
          { code: "404", description: "Paper not found" }
        ]
      },
      {
        method: "DELETE",
        path: "/api/papers/{id}",
        summary: "Delete paper",
        description: "Delete paper (soft delete). Automatically triggers digest refresh.",
        parameters: [
          { name: "id", in: "path", required: true, type: "string", description: "Paper UUID" }
        ],
        responses: [
          { code: "200", description: "Paper deleted successfully" },
          { code: "404", description: "Paper not found" }
        ]
      },
      {
        method: "POST",
        path: "/api/papers/{id}/favorite",
        summary: "Toggle favorite",
        description: "Toggle favorite status for a paper",
        parameters: [
          { name: "id", in: "path", required: true, type: "string", description: "Paper ID" }
        ],
        responses: [
          { code: "200", description: "Favorite toggled" }
        ]
      },
      {
        method: "POST",
        path: "/api/papers/{id}/tags",
        summary: "Add tags",
        description: "Add tags to paper",
        parameters: [
          { name: "id", in: "path", required: true, type: "string", description: "Paper ID" }
        ],
        requestBody: {
          example: {
            tags: ["machine-learning", "risk-management"]
          }
        },
        responses: [
          { code: "200", description: "Tags added" }
        ]
      },
      {
        method: "DELETE",
        path: "/api/papers/{id}/tags",
        summary: "Remove tags",
        description: "Remove tags from paper",
        parameters: [
          { name: "id", in: "path", required: true, type: "string", description: "Paper ID" }
        ],
        requestBody: {
          example: {
            tags: ["machine-learning"]
          }
        },
        responses: [
          { code: "200", description: "Tags removed" },
          { code: "404", description: "Paper not found" }
        ]
      },
      {
        method: "POST",
        path: "/api/papers/{id}/auto-tag",
        summary: "Auto-generate tags",
        description: "Auto-generate tags using LLM",
        parameters: [
          { name: "id", in: "path", required: true, type: "string", description: "Paper ID" }
        ],
        responses: [
          { code: "200", description: "Tags generated" }
        ]
      },
      {
        method: "GET",
        path: "/api/papers/{id}/summary",
        summary: "Get paper summary",
        description: "Get AI-generated summary for a paper",
        parameters: [
          { name: "id", in: "path", required: true, type: "string", description: "Paper ID" }
        ],
        responses: [
          { code: "200", description: "Summary retrieved" }
        ]
      }
    ]
  },
  {
    name: "Settings",
    icon: <Settings className="w-5 h-5" />,
    description: "Application settings and configuration",
    endpoints: [
      {
        method: "GET",
        path: "/api/settings/prompts",
        summary: "Get prompts",
        description: "Get all prompt configurations",
        responses: [
          { code: "200", description: "Prompts retrieved successfully" }
        ]
      },
      {
        method: "PUT",
        path: "/api/settings/prompts",
        summary: "Update prompts",
        description: "Update prompt configuration",
        requestBody: {
          example: {
            prompts: {
              digestGeneration: "Generate a digest based on the following papers...",
              paperAnalysis: "Analyze this paper and extract key insights..."
            }
          }
        },
        responses: [
          { code: "200", description: "Prompts updated successfully" },
          { code: "400", description: "Invalid input" }
        ]
      },
      {
        method: "GET",
        path: "/api/settings/collection",
        summary: "Get collection settings",
        description: "Get collection settings",
        responses: [
          { code: "200", description: "Settings retrieved successfully" }
        ]
      },
      {
        method: "POST",
        path: "/api/settings/collection",
        summary: "Update collection settings",
        description: "Update collection settings",
        requestBody: {
          example: {
            autoCollect: true,
            collectionInterval: 3600,
            sources: ["arxiv", "pubmed"],
            keywords: ["machine learning", "AI"]
          }
        },
        responses: [
          { code: "200", description: "Settings updated successfully" },
          { code: "400", description: "Invalid input" }
        ]
      },
      {
        method: "GET",
        path: "/api/settings/llm",
        summary: "Get LLM settings",
        description: "Get LLM provider settings",
        responses: [
          { code: "200", description: "Settings retrieved successfully" }
        ]
      },
      {
        method: "POST",
        path: "/api/settings/llm",
        summary: "Update LLM settings",
        description: "Update LLM provider settings",
        requestBody: {
          example: {
            provider: "groq",
            model: "llama-3.3-70b-versatile",
            temperature: 0.7,
            maxTokens: 2000
          }
        },
        responses: [
          { code: "200", description: "Settings updated successfully" },
          { code: "400", description: "Invalid input" }
        ]
      },
      {
        method: "PATCH",
        path: "/api/settings/llm",
        summary: "Patch LLM settings",
        description: "Partially update LLM settings",
        requestBody: {
          example: {
            temperature: 0.5,
            maxTokens: 1500
          }
        },
        responses: [
          { code: "200", description: "Settings patched successfully" },
          { code: "400", description: "Invalid input" }
        ]
      },
      {
        method: "GET",
        path: "/api/user/notifications",
        summary: "Get notification settings",
        description: "Get user notification settings",
        responses: [
          { code: "200", description: "Settings retrieved successfully" }
        ]
      },
      {
        method: "POST",
        path: "/api/user/notifications",
        summary: "Update notification settings",
        description: "Update user notification settings",
        requestBody: {
          example: {
            emailDigest: true,
            pushAlerts: true,
            digestFrequency: "daily",
            alertKeywords: ["fraud detection", "credit scoring"]
          }
        },
        responses: [
          { code: "200", description: "Settings updated successfully" },
          { code: "400", description: "Invalid input" }
        ]
      }
    ]
  },
  {
    name: "Tags",
    icon: <Tag className="w-5 h-5" />,
    description: "Tags and categories management",
    endpoints: [
      {
        method: "GET",
        path: "/api/tags",
        summary: "Get all tags",
        description: "Get all tags with categories and counts",
        parameters: [
          { name: "category", in: "query", type: "string", description: "Filter by category" },
          { name: "includeCount", in: "query", type: "boolean", description: "Include paper count for each tag" }
        ],
        responses: [
          { code: "200", description: "Tags retrieved successfully" }
        ]
      }
    ]
  }
];

// 按字母顺序排序
apiGroups.sort((a, b) => a.name.localeCompare(b.name));

function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    GET: "bg-gradient-to-r from-indigo-500 to-indigo-600",
    POST: "bg-gradient-to-r from-purple-500 to-purple-600",
    PUT: "bg-gradient-to-r from-amber-500 to-amber-600",
    DELETE: "bg-gradient-to-r from-rose-500 to-rose-600",
    PATCH: "bg-gradient-to-r from-cyan-500 to-cyan-600"
  };

  return (
    <span className={`${colors[method] || colors.GET} text-white text-xs font-bold px-3 py-1.5 rounded-lg min-w-[70px] text-center uppercase tracking-wider shadow-lg`}>
      {method}
    </span>
  );
}

function EndpointCard({ endpoint }: { endpoint: ApiEndpoint }) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const curlExample = endpoint.method === "GET" 
    ? `curl https://research-copilot-kappa.vercel.app${endpoint.path}${endpoint.parameters?.some(p => p.in === "query") ? "?date=2026-03-23" : ""}`
    : `curl -X ${endpoint.method} https://research-copilot-kappa.vercel.app${endpoint.path.replace(/{.*?}/g, "123")} \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify(endpoint.requestBody?.example || {}, null, 2)}'`;

  return (
    <div className="border border-indigo-500/20 rounded-xl overflow-hidden bg-card/50 backdrop-blur-sm hover:border-indigo-500/40 transition-all duration-300">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 hover:bg-indigo-500/5 transition-colors"
      >
        <div className="flex items-center gap-4">
          <MethodBadge method={endpoint.method} />
          <div className="text-left">
            <div className="font-mono text-sm text-foreground font-semibold">{endpoint.path}</div>
            <div className="text-muted-foreground text-sm mt-0.5">{endpoint.summary}</div>
          </div>
        </div>
        <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="border-t border-indigo-500/20 p-5 space-y-5 bg-background/30">
          {endpoint.description && (
            <p className="text-foreground text-sm leading-relaxed">{endpoint.description}</p>
          )}

          {endpoint.parameters && endpoint.parameters.length > 0 && (
            <div>
              <h4 className="text-indigo-400 text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2">
                <Server className="w-4 h-4" /> Parameters
              </h4>
              <div className="bg-card rounded-lg overflow-hidden border border-indigo-500/10">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-indigo-500/10">
                      <th className="text-left p-3 text-indigo-300 font-semibold text-xs uppercase">Name</th>
                      <th className="text-left p-3 text-indigo-300 font-semibold text-xs uppercase">Type</th>
                      <th className="text-left p-3 text-indigo-300 font-semibold text-xs uppercase">In</th>
                      <th className="text-left p-3 text-indigo-300 font-semibold text-xs uppercase">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {endpoint.parameters.map((param, idx) => (
                      <tr key={idx} className="border-t border-indigo-500/10">
                        <td className="p-3">
                          <span className="font-mono text-foreground font-semibold">{param.name}</span>
                          {param.required && <span className="text-rose-400 ml-1">*</span>}
                        </td>
                        <td className="p-3">
                          <span className="bg-indigo-500/10 text-indigo-300 px-2 py-0.5 rounded text-xs font-mono">{param.type}</span>
                        </td>
                        <td className="p-3 text-muted-foreground italic">{param.in}</td>
                        <td className="p-3 text-muted-foreground">{param.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {endpoint.requestBody && (
            <div>
              <h4 className="text-indigo-400 text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2">
                <Code className="w-4 h-4" /> Request Body
              </h4>
              <div className="relative">
                <pre className="bg-background rounded-lg p-4 text-sm font-mono text-foreground overflow-x-auto border border-indigo-500/20">
                  {JSON.stringify(endpoint.requestBody.example, null, 2)}
                </pre>
                <button
                  onClick={() => copyToClipboard(JSON.stringify(endpoint.requestBody?.example, null, 2))}
                  className="absolute top-3 right-3 p-2 bg-indigo-500/20 hover:bg-indigo-500/30 rounded-lg transition-colors"
                >
                  {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-indigo-400" />}
                </button>
              </div>
            </div>
          )}

          {endpoint.responses && (
            <div>
              <h4 className="text-indigo-400 text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> Responses
              </h4>
              <div className="space-y-2">
                {endpoint.responses.map((resp, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 bg-card rounded-lg border border-indigo-500/10">
                    <span className={`font-mono font-bold text-sm ${
                      resp.code.startsWith('2') ? 'text-green-400' :
                      resp.code.startsWith('4') ? 'text-amber-400' :
                      'text-rose-400'
                    }`}>
                      {resp.code}
                    </span>
                    <span className="text-muted-foreground text-sm">{resp.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <h4 className="text-indigo-400 text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2">
              <Terminal className="w-4 h-4" /> Example
            </h4>
            <div className="relative">
              <pre className="bg-background rounded-lg p-4 text-sm font-mono text-foreground overflow-x-auto border border-indigo-500/20">
                {curlExample}
              </pre>
              <button
                onClick={() => copyToClipboard(curlExample)}
                className="absolute top-3 right-3 p-2 bg-indigo-500/20 hover:bg-indigo-500/30 rounded-lg transition-colors"
              >
                {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-indigo-400" />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ApiGroupSection({ group }: { group: ApiGroup }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mb-8">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 mb-4 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 rounded-xl border border-indigo-500/20 hover:border-indigo-500/40 transition-all"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400">{group.icon}</div>
          <div className="text-left">
            <h3 className="text-lg font-bold text-foreground">{group.name}</h3>
            <p className="text-muted-foreground text-sm">{group.description}</p>
          </div>
        </div>
        <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="space-y-3">
          {group.endpoints.map((endpoint, idx) => (
            <EndpointCard key={idx} endpoint={endpoint} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ApiDocPage() {
  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-background border-b border-indigo-500/20">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <span className="px-3 py-1 bg-indigo-500/20 text-indigo-400 text-sm font-semibold rounded-full border border-indigo-500/30">
              API Reference
            </span>
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent mb-4">
            Research Copilot API
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl">
            Complete API documentation for the Research Copilot platform.
            Build integrations, automate workflows, and access research data programmatically.
          </p>

          <div className="flex items-center gap-4 mt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Server className="w-4 h-4" />
              <span>Base URL: <code className="text-indigo-400 font-mono">https://research-copilot-kappa.vercel.app/api</code></span>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        {apiGroups.map((group, idx) => (
          <ApiGroupSection key={idx} group={group} />
        ))}
      </div>
    </div>
  );
}
