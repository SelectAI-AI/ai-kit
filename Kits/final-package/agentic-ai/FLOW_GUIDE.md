# CareLoom Flow Guide — Larkspur Electronics

How the 8 notebooks connect, what state/data flows between them, and how CareLoom grows
from a single routing decision into a full agentic support system.

## The shape of the module

```
1. langgraph_fundamentals
        |  (keyword triage: order vs. product)
        v
2. first_langgraph_agent
        |  (+ Groq, + web search, + calculator)
        v
3. agent_patterns_langgraph
        |  (+ ToolNode, + checkpointing, + human approval, + retries)
        v
4. multi_agent_graphs
        |  (+ supervisor, + parallel fan-out)
        v
5. database_connected_agents_sqlite_only
        |  (+ real Larkspur data: customers, orders, tickets)
        v
6. guided_lab_database_connected_agent
        |  (+ ChromaDB, + the real policy handbook, + SQLite/Chroma router)
        v
7. guided_lab_multi_agent_supervisor_graph
        |  (real subagents + the handbook, replacing the mechanical stand-ins from #4)
        v
8. long_term_memory_langgraph
   (+ memory that survives across separate threads/tickets)
```

Each notebook is self-contained and runnable on its own — nothing imports another notebook
— but conceptually each one adds one capability on top of the last, in the order above.

## What each notebook actually builds

### 1. `langgraph_fundamentals.ipynb` — the first decision
A message comes in. `classify_message` checks it for order-ish keywords (order, shipping,
refund, return, track...) and routes to `order_help_node` or `product_help_node`, which
draft a templated reply. `finalize_node` assembles the result. No model, no tools — just
`StateGraph`, conditional edges, and `@traceable` spans. This is the shape every later
notebook reuses: **classify → route → act → finalize**.

### 2. `first_langgraph_agent.ipynb` — the first real agent
Same idea, but the "classify → route → act" logic is now handled by an actual Groq model
instead of hand-written keyword rules, and "act" means calling real tools: Tavily web
search (for anything time-sensitive, like an exchange rate) and a calculator (for refund
math). `InMemorySaver` gives it thread-scoped memory, so a follow-up question in the same
`thread_id` has context from the turn before.

### 3. `agent_patterns_langgraph.ipynb` — making it safe to ship
Takes the "agent with tools" shape from #2 and adds the guardrails a real deployment
needs: `ToolNode` for structured tool execution, `interrupt_before=["tools"]` so a support
lead can review a proposed tool call before it runs, and `RetryPolicy` so a flaky
downstream call (the warehouse inventory service, here) doesn't fail the whole request.
Deliberately uses a deterministic planner instead of a live LLM, so the approval/retry
mechanics are easy to see without model output changing the picture between runs.

### 4. `multi_agent_graphs.ipynb` — splitting the work across agents
Some requests are one job; others are really three (research, write, review). This
notebook is the *mechanical* version of that split: a supervisor decides the plan, `Send`
fans work out to Researcher/Writer/QA stand-ins in parallel, and a reducer
(`operator.add`) merges their notes back into shared state. Still no live model — the
point is the orchestration shape, which #7 later fills in with real agents.

### 5. `database_connected_agents_sqlite_only.ipynb` — real data enters the picture
First notebook to touch Larkspur's actual operational data: a local SQLite file with
`customers`, `orders`, `order_items`, and `support_tickets` (Asha Rao, Imran Khan, Neha
Patel, Vikram Suresh, Divya Menon — reused as recurring characters later). A Groq agent
gets `sqlite_list_tables` / `sqlite_schema` / `sqlite_query` tools, returns a validated
`QueryResult` via `response_format`, and a second, smaller model reformats it into an
audit row saved back into SQLite. Establishes the "one model for reasoning, one smaller
model for extraction" split used again in #6.

### 6. `guided_lab_database_connected_agent.ipynb` — two kinds of memory, one router
Introduces the second data source every later notebook depends on conceptually: a real,
self-generated **Larkspur Customer Care & Policy Handbook** PDF, chunked and embedded into
ChromaDB. A router looks at each question and decides: is this a structured fact (product
price, warranty length, a saved agent note — SQLite) or a policy question (what does the
handbook actually say about a warranty claim — Chroma)? `SqliteSaver` checkpoints the
conversation so follow-ups stay in context.

### 7. `guided_lab_multi_agent_supervisor_graph.ipynb` — real agents, same shape as #4
Takes the supervisor/worker shape from #4 and rebuilds it with real Groq-backed
subagents: a Researcher with a `retrieve_evidence` tool against the same handbook from
#6 (regenerated locally, not imported), a Writer, and a QA agent that checks the draft
for unsupported claims. Produces an onboarding brief for new support hires — the same
document a trainee under review in #3 would eventually need.

### 8. `long_term_memory_langgraph.ipynb` — memory that outlives the ticket
Closes the loop: everything so far has been thread-scoped (a conversation remembers
itself, within one thread). This notebook adds memory that survives *across* threads —
Asha Rao's stated preference ("replacement over refund") in one ticket is retrieved by a
completely separate ticket later, via a Chroma-backed semantic memory store plus
periodic summarization of the conversation so old context stays compact.

## Data that recurs across notebooks

- **Customers**: Asha Rao (Chennai), Imran Khan (Bengaluru), Neha Patel (Mumbai), Vikram
  Suresh (Delhi), Divya Menon (Pune) — introduced in #5, referenced again in #8.
- **Products**: Keyboard, Mouse, Headphones, Monitor, Webcam, Desk Lamp — appear as
  `order_items` in #5 and as the `product_metadata` catalog in #6, with consistent
  pricing across both.
- **The policy handbook**: generated independently in #6 and #7 (each notebook is
  self-contained, so it's regenerated rather than shared), but it's the same document —
  same sections, same wording — in both places.
- **Refund approval threshold (₹3,000)**: introduced as a policy fact in #3's
  `policy_lookup` tool, and appears again as real handbook text in #6/#7.

## The offline-fallback thread

Every notebook that calls Groq, Tavily, or HuggingFace has a fallback with the same
calling interface, so the whole module runs without live credentials or network access —
useful for grading, CI, or just reading through without burning API calls. Look for
`[offline-fallback]` in any notebook's output, and see each notebook's own "what's
verified where" table for specifics.

## If you're teaching this as a sequence

Notebooks 1-4 stand alone as a "LangGraph fundamentals" arc (concepts only, escalating
complexity). Notebooks 5-8 are a "build CareLoom for real" arc (real data, real
documents, real cross-session memory). If you only have time for a shorter session, 1, 3,
6, and 8 cover the widest spread of concepts (state/routing, human-in-the-loop, RAG +
routing, long-term memory) with the least redundancy.
