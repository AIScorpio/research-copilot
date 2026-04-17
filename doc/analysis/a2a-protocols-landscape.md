# A2A Protocols & Frameworks Landscape Analysis

> Last updated: April 2026

---

## Executive Summary

Two protocol categories have emerged for agent interoperability:

1. **Open Standards (A2A, MCP)** — vendor-neutral protocols for interoperability
2. **Orchestration Frameworks (OpenAI Agents SDK, LangGraph, etc.)** — SDKs for building agent workflows

These are complementary layers: open standards for external exposure, frameworks for internal orchestration.

---

## Protocol Comparison

| Criteria | A2A | MCP | OpenAI Agents | LangGraph | Semantic Kernel |
|----------|-----|-----|---------------|-----------|-----------------|
| **Primary Purpose** | Agent-to-agent collaboration | Tool/function exposure | Agent orchestration | Workflow orchestration | Agent construction |
| **Agent Wrapping** | Native (Agent Card) | Partial (as tools) | No (in-process) | No (in-process) | No (in-process) |
| **Discovery** | Agent Cards at `/.well-known/agent.json` | Manual/Registry | None | None | None |
| **Remote Access** | HTTP/gRPC/REST | STDIO/HTTP | No | Cloud only | No |
| **Streaming** | SSE, gRPC streams | SSE | No | Yes | No |
| **Multi-turn** | Native (context/task IDs) | No | Sessions | StateGraph | AgentThread |
| **Auth Built-in** | OAuth2, mTLS, API keys, OIDC | Bearer, API keys | None | Cloud only | None |
| **Spec Status** | v1.0.0 (Linux Foundation) | Stable (Anthropic) | v0.13.6 | Stable | v1.41.2 |

---

## Recommended Architecture

```
External Clients
       │
   ┌───┴───┐
   │ A2A   │      MCP
   │ Layer │      Layer
   └───┬───┘      └──┬──┘
       └─────────────┘
             │
    Agent Orchestration Layer
    (LangGraph / SK / Agents SDK)
             │
    Internal Tools / Plugins
```

### Decision Framework

| Requirement | Recommendation |
|-------------|----------------|
| Expose agent as discoverable service | **A2A Protocol** |
| Expose tools/functions to AI apps | **MCP** |
| Internal orchestration (Python) | **LangGraph** or **OpenAI Agents SDK** |
| Internal orchestration (.NET/Java) | **Semantic Kernel** |
| Long-running async with push notifications | **A2A** |

### Key Insight: A2A + MCP is the Winning Combination

- **A2A** handles agent-to-agent collaboration (peer-to-peer, stateful, multi-turn)
- **MCP** handles agent-to-tool interaction (function calling, resource access)

A production system should support both.
