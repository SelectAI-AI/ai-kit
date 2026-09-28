# RAG Engineering — Bramblewood Gear Co. / FieldWise

**Company:** Bramblewood Gear Co., an outdoor equipment retailer (tents,
sleeping bags, backpacks, stoves, hiking footwear).

**Product:** FieldWise, the internal retrieval-augmented assistant support
agents use to answer gear-care, troubleshooting, and warranty questions
instead of searching several wikis by hand.

All six notebooks share this one scenario, so it reads as a single
progressive build rather than six unrelated demos: start with retrieval
fundamentals, layer on prompt-flow techniques, add conversation and
memory, wire up a full pipeline against a real document, expose it over
MCP, and finally evaluate whether it's good enough to ship.

## Setup (once)

1. Keep `.env` in the same folder as the notebooks — every notebook loads
   it with `load_dotenv()`.
2. Fill in real values if you have them:
   ```env
   GROQ_API_KEY=your_groq_key
   GROQ_MODEL=llama-3.3-70b-versatile
   LANGSMITH_API_KEY=your_langsmith_key
   LANGSMITH_TRACING=true
   LANGSMITH_PROJECT=fieldwise-rag
   ```
3. You don't strictly need any of the above to run every notebook end to
   end. Each one checks once whether the live embedding model, Groq, and
   LangSmith are reachable, and falls back to a deterministic offline
   equivalent if not — it prints which mode it's in (`EMBEDDINGS_MODE`,
   `LLM_MODE`, `LANGSMITH_MODE`) near the top. Install
   `sentence-transformers` + `langchain-huggingface` if you want live
   semantic embeddings instead of the offline lexical fallback.

## Run order

Each notebook installs its own packages in its first code cell, so they
can technically run in any order — but they're written to be read in this
sequence:

1. **`naive_to_advanced_rag_fieldwise.ipynb`**
   Retrieval fundamentals: naive baseline, multi-query, HyDE, parent-child,
   reranking — using FieldWise's gear-care KB articles. Start here to see
   *why* a plain vector search often isn't enough.

2. **`prompt_flows_in_rag_fieldwise.ipynb`**
   Query rewriting, context compression, and reusable prompt templates
   (including a style switch between a terse internal note and a
   customer-facing reply).

3. **`conversational_rag_fieldwise.ipynb`**
   A multi-turn support ticket: chat history folded into retrieval,
   routing (cache vs. retrieval vs. direct), per-ticket session memory,
   semantic caching, and an LLM-grounded final reply.

4. **`end_to_end_rag_pipeline_fieldwise.ipynb`**
   The full pipeline against a real document: generates Bramblewood's
   *Product Care & Warranty Handbook* as an actual PDF, then runs
   load → split → embed → Chroma → LCEL RAG chain → LangSmith tracing.

5. **`mcp_core_concepts_langchain_fieldwise.ipynb`**
   Exposes the same handbook search as a local MCP server
   (`@mcp.tool`/`@mcp.resource`/`@mcp.prompt`) and connects it to a
   LangChain agent with a structured `SupportResolution` output. The
   heaviest notebook — spawns a real subprocess MCP server over stdio.

6. **`rag_evaluation_fieldwise.ipynb`**
   Before FieldWise goes in front of real agents: an internal eval set (16
   hand-written Q&A pairs grounded in Bramblewood's own content, not a
   public benchmark), baseline vs. query-rewrite comparison, LangSmith
   experiment tracking, and local proxy metrics (faithfulness, context
   precision, recall).

## What's real vs. offline in each notebook

Every notebook ends with a **Verification summary** table stating exactly
what was executed and confirmed, and what only activates with live
credentials and network access. As a quick reference:

| Notebook | Needs Groq? | Needs LangSmith? | Needs live embeddings? |
|---|---|---|---|
| naive_to_advanced_rag | No | No | Optional (offline fallback works fine) |
| prompt_flows_in_rag | No | No | Optional |
| conversational_rag | Yes, for the final reply | No | Optional |
| end_to_end_rag_pipeline | Yes | Yes (tracing) | Optional |
| mcp_core_concepts_langchain | Yes, for the live agent step only | No | Optional |
| rag_evaluation | Yes | Yes (dataset + evaluate) | Optional |

The MCP server, the tool/resource/prompt loading, and the Chroma index in
every notebook run over local processes and disk — none of that needs
network access, only Groq and LangSmith calls do.
