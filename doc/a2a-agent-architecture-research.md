# A2A Agent Communication Architecture: Research & Recommendations

> Synthesized from Google A2A Protocol v1.0 specification, production samples, partner implementations (Twilio, Identity Machines, Ethereum ERC-8004), and industry multi-agent frameworks (CrewAI, AutoGen, LangGraph).

---

## 1. Google A2A Protocol: Production Patterns

### 1.1 Protocol Architecture (3-Layer Model)

A2A v1.0 (released March 2026, Linux Foundation) defines a clean 3-layer architecture:

```
Layer 1: Data Model (canonical, protocol-agnostic, defined in protobuf)
  └─ Task, Message, Part, Artifact, AgentCard, Extension

Layer 2: Abstract Operations (what agents can do)
  └─ SendMessage, SendStreamingMessage, GetTask, ListTasks, CancelTask,
     SubscribeToTask, PushNotificationConfig*, GetExtendedAgentCard

Layer 3: Protocol Bindings (how to do it over the wire)
  └─ JSON-RPC 2.0 over HTTP(S) [primary], gRPC, HTTP/REST, Custom
```

**Key insight**: The canonical source of truth is `spec/a2a.proto`. All JSON schemas, SDKs, and bindings are generated from it. This prevents specification drift.

### 1.2 Agent Discovery: Solving the "Agent Mesh" Problem

A2A does NOT prescribe a single discovery mechanism. Instead it defines **three strategies**:

| Strategy | Mechanism | Best For |
|----------|-----------|----------|
| **Well-Known URI** | `/.well-known/agent-card.json` (RFC 8615) | Public agents, domain-scoped discovery |
| **Curated Registry** | Central registry with search/filter API | Enterprise, marketplaces, governed ecosystems |
| **Direct Configuration** | Hardcoded URLs, env vars, config files | Tightly-coupled systems, development |

**Agent Card** is the discovery unit - a JSON document containing:
- `name`, `description`, `provider` (identity)
- `url` (service endpoint)
- `capabilities` (streaming, pushNotifications, extensions)
- `security` (auth schemes: OAuth2, mTLS, API keys)
- `skills[]` (what the agent can do, with tags, input/output modes, examples)
- `extensions[]` (custom protocol additions via URI)

**Production recommendation**: For a research pipeline, use **Direct Configuration** for internal agents (URLs in env/config) and **Curated Registry** if you expect third-party agents to plug in.

### 1.3 Facade/Orchestrator Agent Pattern

A2A natively supports the "facade agent" pattern through:

1. **Hybrid Message/Task approach**: The facade agent returns `Message` for capability discovery/negotiation, then creates `Task` objects for actual work delegation.

2. **Context-based grouping**: A `contextId` groups related tasks across multiple sub-agents. The facade maintains the context while delegating sub-tasks.

3. **Parallel follow-ups**: Multiple tasks can run in parallel within the same context:
   ```
   Task 1: Extract papers from source → contextId: "research-session-123"
   Task 2: Classify papers → contextId: "research-session-123", referenceTaskIds: [Task 1]
   Task 3: Generate summaries → contextId: "research-session-123", referenceTaskIds: [Task 1]
   ```

4. **Task immutability**: Once a task completes, it cannot be restarted. Refinements create new tasks in the same context. This gives clean audit trails.

5. **Agent Gateway Protocol (AGP) Extension**: An official extension introducing "Autonomous Squads" (ASq) that routes Intent payloads based on declared Capabilities.

**Production pattern**:
```
User → Orchestrator Agent (A2A Client)
         ├─→ PaperFetcher Agent (A2A Server)  → Task: fetch papers
         ├─→ Classifier Agent (A2A Server)    → Task: classify papers
         ├─→ Summarizer Agent (A2A Server)    → Task: generate summaries
         └─→ Synthesizer Agent (A2A Server)   → Task: synthesize findings
```

### 1.4 Communication Modalities

A2A supports three interaction patterns:

| Pattern | Mechanism | Latency | Use Case |
|---------|-----------|---------|----------|
| **Request/Response** | SendMessage → Task/Message | Low | Quick lookups, simple queries |
| **Streaming (SSE)** | SendStreamingMessage → continuous events | Very low | Progress updates, large output generation |
| **Push Notifications** | Webhook callbacks for task state changes | Async | Long-running tasks, disconnected clients |

### 1.5 A2A + MCP: Complementary, Not Competing

| MCP (Model Context Protocol) | A2A (Agent2Agent Protocol) |
|------------------------------|---------------------------|
| Agent ↔ Tool/Resource | Agent ↔ Agent |
| Structured, stateless function calls | Stateful, multi-turn collaboration |
| Calculator, DB query, API call | Delegate to specialist agent |
| "Using capabilities" | "Partnering on tasks" |

**Pattern**: Each A2A agent internally uses MCP to talk to its tools. A2A handles the agent-to-agent layer.

---

## 2. Industry Multi-Agent Patterns

### 2.1 Framework Comparison

| Aspect | A2A | CrewAI | AutoGen | LangGraph |
|--------|-----|--------|---------|-----------|
| **Communication** | HTTP(S) JSON-RPC, gRPC | In-process, function calls | In-process, message passing | In-process, graph edges |
| **Discovery** | Agent Cards | YAML config | Code config | Code config |
| **Async** | Native (push, SSE) | Limited | Limited | Native (graph state) |
| **State** | Task lifecycle | Crew memory | Conversation memory | Graph checkpointing |
| **Interop** | Cross-framework | CrewAI-only | AutoGen-only | LangGraph-only |
| **Security** | OAuth2, mTLS, API keys | None built-in | None built-in | None built-in |
| **Deployment** | Independent services | Single process | Single process | Single process |

**Key takeaway**: CrewAI/AutoGen/LangGraph are orchestration frameworks for in-process multi-agent systems. A2A is a **wire protocol** for cross-service, cross-framework, cross-organizational agent communication. They solve different problems.

### 2.2 CrewAI Decomposition Model (Relevant to Research Pipelines)

CrewAI uses a clear decomposition model:
- **Role** (what the agent is): "Senior Data Researcher"
- **Goal** (what it achieves): "Uncover cutting-edge developments"
- **Backstory** (context/personality): "Seasoned researcher with 10 years..."
- **Tools** (capabilities): Search, RAG, code execution
- **Process**: Sequential, Hierarchical, or Hybrid
- **Delegation**: `allow_delegation: true` enables agent-to-agent task handoff

**Process types**:
- **Sequential**: Agent A → Agent B → Agent C (pipeline)
- **Hierarchical**: Manager delegates to workers (facade pattern)
- **Hybrid**: Combination with conditional routing

**CrewAI Flows** add orchestration:
- `@start` triggers, `@listen` events, `@router` conditional branching
- State persistence and resumption for long-running workflows

### 2.3 Microservice Patterns Applied to Agent Architecture

| Microservice Pattern | Agent Architecture Equivalent |
|---------------------|------------------------------|
| **API Gateway** | Orchestrator/Facade agent - single entry point, routes to sub-agents |
| **Service Mesh** | Agent Card registry + mutual auth between agents |
| **Sidecar** | MCP tool layer - each agent has tools co-located via MCP |
| **Circuit Breaker** | Timeout + fallback: if sub-agent fails, return cached/default response |
| **Saga Pattern** | Compensating tasks: if summarizer fails, roll back classification |
| **CQRS** | Separate read agents (query papers) from write agents (store/modify papers) |
| **Event Sourcing** | Task history as immutable event log (A2A task history) |
| **Backend for Frontend** | Specialized orchestrator per use case (search vs. analyze vs. export) |
| **Bulkhead** | Rate limiting per agent (`max_rpm`, `max_execution_time`) |
| **Canary Deployment** | New agent version handles N% of traffic via registry routing |

### 2.4 Event-Driven vs Request-Driven Communication

| Aspect | Request-Driven (HTTP/gRPC) | Event-Driven (Pub/Sub) |
|--------|---------------------------|----------------------|
| **A2A Native?** | Yes (primary) | Via push notifications |
| **Latency** | Lower (direct) | Higher (broker overhead) |
| **Decoupling** | Tight (caller knows callee) | Loose (publisher doesn't know subscriber) |
| **Reliability** | Caller must retry | Broker handles redelivery |
| **Best for** | Synchronous collaboration, real-time | Fan-out, async workflows, event pipelines |

**Recommendation**: Use request-driven (A2A native HTTP) for the main orchestration flow. Add event-driven (push notifications) for long-running tasks like paper extraction or analysis that may take minutes.

---

## 3. Agent Decomposition Principles

### 3.1 Single Responsibility Principle for Agents

Each agent should have **one clear reason to change**:

```
BAD:  ResearchAgent (searches, classifies, summarizes, synthesizes)
GOOD: PaperFetcherAgent, ClassifierAgent, SummarizerAgent, SynthesizerAgent
```

**Test**: Can you describe the agent's job in one sentence without "and"? If not, decompose further.

### 3.2 Data Gravity: Agents Own Their Data

Each agent should own its data domain and expose it through its A2A interface, not by sharing databases:

```
PaperFetcherAgent:  owns paper source URLs, fetch state, raw content
ClassifierAgent:    owns classification labels, confidence scores
SummarizerAgent:    owns generated summaries, extraction metadata
SynthesizerAgent:   owns synthesis artifacts, cross-paper analysis
```

**A2A mechanism**: Data flows via `Message.parts` (text, data, file references) and `Artifact` objects. Agents don't share internal state - they exchange information through the protocol.

### 3.3 Interface Segregation: Expose Only What's Needed

Agent Cards should declare **minimal, focused skill sets**:

```json
// PaperFetcher Agent Card
{
  "skills": [{
    "id": "fetch-papers",
    "name": "Fetch Papers",
    "description": "Fetch papers from academic databases",
    "inputModes": ["application/json"],
    "outputModes": ["application/json", "text/plain"],
    "examples": ["Fetch 10 papers about transformer architectures from arXiv"]
  }]
}
```

### 3.4 Dependency Inversion: Depend on Abstractions

Agents should depend on **Agent Cards (contracts)**, not concrete implementations:

```
Orchestrator depends on: "an agent that can fetch papers" (skill: fetch-papers)
NOT: PaperFetcherAgent running at http://localhost:8081
```

**A2A mechanism**: The orchestrator discovers agents by skill/tags from a registry, not hardcoded URLs.

### 3.5 The "Penny-Pinching" Rule

Don't decompose further than the cost of the boundary justifies:

| Factor | Cost of New Agent Boundary |
|--------|---------------------------|
| HTTP call overhead | ~5-50ms per call |
| Serialization/deserialization | ~1-10ms |
| Agent Card maintenance | Ongoing |
| Auth/security per agent | Ongoing |
| Debugging complexity | Increases with each agent |

**Heuristic**: If two agents always run in sequence with no independent use case, merge them. If they might be called independently, reused elsewhere, or need independent scaling, split them.

---

## 4. Production Readiness Checklist for A2A

### 4.1 Pre-Exposure Checklist

Before exposing an agent externally:

- [ ] **Agent Card** published and valid (JSON schema)
- [ ] **Skills** clearly documented with `id`, `name`, `description`, `examples`
- [ ] **Input/Output modes** declared (`inputModes`, `outputModes`)
- [ ] **Authentication** configured (OAuth2, API keys, mTLS)
- [ ] **TLS** enabled (HTTPS mandatory)
- [ ] **Version** field set and incremented on changes
- [ ] **Error handling** returns proper JSON-RPC error codes
- [ ] **Idempotency** for SendMessage (same messageId = same result)
- [ ] **Task lifecycle** properly managed (submitted → working → completed/failed)
- [ ] **Streaming** capability correctly declared and implemented
- [ ] **Push notification** security (webhook URL validation, auth)
- [ ] **Input validation** - treat all external data as untrusted (prompt injection risk!)
- [ ] **Rate limiting** configured (`max_rpm`, request quotas)
- [ ] **Distributed tracing** with OpenTelemetry (W3C Trace Context headers)
- [ ] **Metrics** exposed (request rate, error rate, latency, task processing time)
- [ ] **Logging** with taskId, contextId, correlation IDs
- [ ] **Health check** endpoint

### 4.2 SLA Definition for Agents

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Response Time (Message)** | < 500ms P95 | Time to first byte for Message responses |
| **Response Time (Task)** | < 2s P95 to submit | Time to return Task object |
| **Task Completion** | < 30s P95 | End-to-end task completion |
| **Availability** | 99.9% uptime | HTTP health check |
| **Error Rate** | < 1% | 5xx responses / total requests |
| **Streaming Latency** | < 200ms between events | Time between SSE events |

### 4.3 Graceful Degradation Patterns

```
Pattern 1: Timeout Fallback
  try sub-agent with 10s timeout
  if timeout → return cached result or partial result with warning

Pattern 2: Capability Degradation
  if LLM model unavailable → fall back to simpler model
  if full analysis fails → return partial analysis

Pattern 3: Circuit Breaker
  if sub-agent fails 3 consecutive times → mark circuit open
  route to fallback agent for 60s cooldown
  then attempt single probe request

Pattern 4: Input-Required State
  if agent needs clarification → return Task(state: input-required)
  orchestrator asks user → continues task
```

### 4.4 Canary Deployments for Agents

```
1. Deploy new agent version alongside old (v1.0, v1.1)
2. Registry routes 5% traffic to v1.1
3. Monitor: error rate, latency, output quality
4. Gradually increase to 25%, 50%, 100%
5. Rollback if degradation detected
```

**A2A mechanism**: Version is in the Agent Card. Registry can route based on client capabilities or percentage.

### 4.5 Contract Testing Between Agents

```
1. Each agent publishes a contract (Agent Card + skill schemas)
2. Consumer agents write tests against the contract, not the implementation
3. Contract tests verify:
   - SendMessage accepts declared input modes
   - Returns Task or Message as expected
   - Task lifecycle follows state machine
   - Error codes match specification
   - Extension activation works correctly
4. Run contract tests in CI before any deployment
```

---

## 5. Real-World Lessons and Failure Modes

### 5.1 What Went Wrong in Early Multi-Agent Systems

| Failure Mode | Description | Mitigation |
|-------------|-------------|------------|
| **Context window explosion** | Agents pass entire conversation history, exceeding token limits | CrewAI's `respect_context_window: true` auto-summarizes; A2A's `historyLength` parameter limits history |
| **Prompt injection via Agent Cards** | Malicious agents craft Agent Card fields to inject prompts | **Treat all external data as untrusted**. Sanitize Agent Card fields before using in LLM prompts |
| **Ambiguous task routing** | In message-only systems, unclear which goal a message refers to | Use A2A's `taskId` + `contextId` for unambiguous routing |
| **Cascading failures** | One agent failure causes downstream agents to fail | Circuit breaker pattern + `input-required` state for human intervention |
| **Task proliferation** | Creating tasks for trivial interactions floods the system | Use hybrid Message/Task approach: Messages for chat, Tasks for goal-oriented work |
| **Over-decomposition** | Too many tiny agents creates more overhead than value | Apply the "penny-pinching" rule |
| **Infinite loops** | Agents delegate back and forth without progress | `max_iter`, `max_execution_time`, and `max_retry_limit` guards |
| **Lost context in long chains** | Information degrades as it passes through many agents | Each agent should produce self-contained artifacts; use `referenceTaskIds` |

### 5.2 Common Failure Modes (Ranked by Frequency)

1. **LLM hallucination in task routing** - orchestrator sends work to wrong agent
2. **Token limit exceeded** - agent can't process large inputs
3. **Authentication failures** - OAuth token expired, API key rotation
4. **Timeout on long-running tasks** - paper extraction takes too long
5. **Serialization errors** - agent returns data in unexpected format
6. **Rate limiting** - too many requests to upstream APIs (Semantic Scholar, arXiv)
7. **State corruption** - task store loses state on crash
8. **Circular dependencies** - Agent A waits on Agent B which waits on Agent A

### 5.3 Emerged Best Practices

1. **Hybrid Message/Task model**: Use Messages for discovery and quick interactions, Tasks for goal-oriented work (Google's recommended pattern)

2. **Opaque execution**: Agents should NOT expose internal state, memory, or tools to other agents. All communication through A2A protocol messages.

3. **Extension-based customization**: Use A2A extensions for domain-specific needs (Twilio's latency extension, traceability extension) rather than modifying the core protocol

4. **Trust boundaries**: Treat agents outside your control as potentially malicious. Validate all inputs. Sign Agent Cards.

5. **Three interaction tiers**:
   - **Synchronous** (HTTP): For real-time, low-latency needs
   - **Streaming** (SSE): For progress updates and large outputs
   - **Async** (Push): For long-running tasks and disconnected clients

6. **Context management**: Use `contextId` to group related tasks, `taskId` for individual work units, `referenceTaskIds` for task dependencies

7. **Observability by default**: OpenTelemetry tracing, structured logging with correlation IDs, metrics for all operations

---

## 6. Concrete Recommendations: Research Paper Pipeline Decomposition

### 6.1 Proposed Agent Topology

```
┌─────────────────────────────────────────────────┐
│              Research Orchestrator                │
│  (Facade Agent - A2A Client to all sub-agents)   │
│  Skills: research, analyze, export                │
└──────┬──────┬──────┬──────┬──────┬──────────────┘
       │      │      │      │      │
       ▼      ▼      ▼      ▼      ▼
    ┌─────┐┌─────┐┌──────┐┌─────┐┌──────┐
    │Fetch││Class││Summ. ││Synth││Export│
    │Agent││Agent││Agent ││Agent││Agent │
    └─────┘└─────┘└──────┘└─────┘└──────┘
```

### 6.2 Agent Decomposition with A2A Agent Cards

**PaperFetcherAgent**
- `skill`: `fetch-papers` - Search and retrieve papers from academic sources
- Input: search query, filters (date, venue, citation count)
- Output: list of paper metadata + full text (as Artifacts)
- Async: Yes (paper fetching can take 10-30s per paper)
- Push notifications: Yes

**ClassifierAgent**
- `skill`: `classify-papers` - Categorize papers by topic, methodology, relevance
- Input: paper metadata or full text
- Output: classification labels with confidence scores (structured data)
- Sync: Yes (fast LLM classification)

**SummarizerAgent**
- `skill`: `summarize-papers` - Generate structured summaries of papers
- Input: paper full text
- Output: summary artifact (structured JSON with key findings, methods, results)
- Streaming: Yes (generates summary incrementally)

**SynthesizerAgent**
- `skill`: `synthesize-findings` - Cross-paper analysis and synthesis
- Input: multiple paper summaries + classifications
- Output: synthesis report artifact
- Long-running: Yes (may take minutes for large collections)

**ExportAgent**
- `skill`: `export-results` - Export to various formats (Markdown, PDF, LaTeX)
- Input: synthesis report or individual summaries
- Output: exported document artifact
- Sync: Yes

### 6.3 Recommended Implementation Order

1. **Phase 1**: Monolithic (all in one process) - validate the pipeline logic
2. **Phase 2**: Internal A2A (all agents on localhost) - add protocol boundaries
3. **Phase 3**: Selective externalization - only PaperFetcher and Exporter as external A2A services
4. **Phase 4**: Full mesh - all agents as independent A2A services with registry

### 6.4 Key Technical Decisions

| Decision | Recommendation | Rationale |
|----------|---------------|-----------|
| Protocol binding | JSON-RPC 2.0 over HTTP(S) | Best SDK support, simplest debugging |
| Discovery | Direct configuration (env vars) initially, registry later | Start simple, add complexity when needed |
| Auth | API keys internally, OAuth2 for external agents | Security proportional to trust boundary |
| State store | SQLite → PostgreSQL for task persistence | Start simple, scale when needed |
| Streaming | SSE for Summarizer and Synthesizer | Users want progress on long operations |
| Push notifications | For PaperFetcher and Synthesizer | These can take minutes |
| Extensions | Traceability extension (required) | Debugging cross-agent workflows is critical |
| Observability | OpenTelemetry + structured JSON logs | Industry standard, works with existing tools |

---

## Sources

- A2A Protocol v1.0 Specification: https://a2a-protocol.org/latest/specification/
- A2A GitHub (23.1k stars): https://github.com/a2aproject/A2A
- A2A Samples: https://github.com/a2aproject/a2a-samples
- A2A Extensions blog post (Google Developers, Sept 2025): https://developers.googleblog.com/en/a2a-extensions-empowering-custom-agent-functionality/
- Twilio Latency Extension (July 2025): https://github.com/twilio-labs/a2a-latency-extension
- Identity Machines Zero-Trust Extension: https://github.com/identitymachines/ironbook-a2a-extension
- Ethereum ERC-8004 (Trustless Agents): https://ethereum-magicians.org/t/erc-8004-trustless-agents/25098
- A2A Tasks vs Messages discussion: https://discuss.google.dev/t/a2a-protocol-demystifying-tasks-vs-messages/255879
- CrewAI Agent Documentation: https://docs.crewai.com/concepts/agents
- DeepLearning.AI A2A Course: https://goo.gle/dlai-a2a
