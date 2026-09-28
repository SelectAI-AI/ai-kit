# Product

This repository (`ai-kit` / `course-ai`) is the content and platform for a **Practical AI/ML Engineering course**. It teaches engineers how to build production LLM applications through hands-on labs.

## Two kinds of deliverable

1. **Learning kits** — collections of Jupyter notebooks (guided labs, solo exercises, and challenges) under `Kits/`, each grouped by topic:
   - `agenticai-with-langgraph` — building agents with LangGraph (single agent, multi-agent supervisor graphs, long-term memory, DB-connected agents).
   - `ai-guardrails` — LLM security: prompt injection defence, PII masking, RAG poisoning, LangSmith eval checkpoints, secure agents.
   - `rag-engineering` — naive-to-advanced RAG, conversational RAG, prompt flows, RAG evaluation.
   - `db` — database fundamentals for AI, vector stores, text-to-SQL, dev/test/prod serverless.
   - `MCP` — Model Context Protocol with LangGraph.
   - `final-package` — the assembled, student-facing bundle of the above modules.

2. **Interactive learning platform** — `module-01-react-frontend`, a browser-based app that mirrors notebook content as a structured, step-by-step experience with an embedded code editor.

## Guiding principles

- **Realistic, accumulating scenarios** — labs within a module share one running scenario (e.g. `InternalAssist`) so controls build on each other instead of being disconnected toy examples.
- **Learn by building and breaking** — students attack their own systems (red-team corpora, poisoned retrieval) and measure results with real metrics before applying fixes.
- **No in-app code execution** — the platform never runs student-submitted code. Students run exercises in their own local Python environment and self-report completion (client-side self-attestation, no server-side validation).
- **Bring your own keys** — model/eval access uses the student's own Groq and LangSmith API keys, never bundled credentials.
