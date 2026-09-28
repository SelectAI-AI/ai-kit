# Databases for AI — Portside Logistics / RouteMind

A 6-notebook module on databases and retrieval for AI systems, all built around one
running scenario: **Portside Logistics**, a regional freight and parcel carrier operating
out of Chennai, Bengaluru, and Mumbai depots, and **RouteMind**, its internal AI
operations copilot.

RouteMind sits between dispatchers and two kinds of knowledge: structured operational
data (shipments, drivers, freight cost) in SQLite, and unstructured policy documents
(the driver handbook, the safety and compliance guide, the customer SLA policy, hazmat
handling procedures, and the vehicle maintenance manual) that get chunked, embedded, and
searched semantically. Every notebook in this module builds toward RouteMind being able
to answer a dispatcher's question correctly, whichever store the answer actually lives in.

## Notebook order

1. **`database_fundamentals_routemind.ipynb`** — SQLite architecture, schema design for
   an AI workload (RouteMind's own query log, latency log, token usage, cache), raw SQL
   vs SQLModel, file-backed vs in-memory connections, async access with `aiosqlite`.
2. **`llm_to_database_strategy_routemind.ipynb`** — the SQL vs vector vs hybrid decision,
   a small keyword-based query router, structured output into database rows, and an
   optional Groq-backed structured-output cell.
3. **`data_ingestion_vector_stores_routemind.ipynb`** — document loaders, metadata,
   chunking, local embeddings, Chroma persistence, and FAISS in-memory search, taught at
   the concept level with small inline examples.
4. **`guided_lab_ingest_store_document_set_routemind.ipynb`** — the hands-on version of
   (3): generates Portside's 5 real policy PDFs on first run, then loads, chunks (3
   configurations), embeds, and stores all 5 for real, comparing retrieval across
   configurations.
5. **`guided_lab_text_to_sql_routemind.ipynb`** — a working text-to-SQL agent over a
   seeded `customers` / `drivers` / `shipments` / `shipment_items` / `support_tickets`
   schema, with a Groq/OpenAI/Ollama backend selector and LangSmith tracing.
6. **`dev_test_prod_serverless_routemind.ipynb`** — environment-specific configuration,
   `:memory:` vs file-backed SQLite, pytest fixtures, test data seeding, and a local
   evaluation workflow, as RouteMind gets ready to move behind FastAPI.

## Offline/live duality

This sandbox has no network route to `api.groq.com`, `huggingface.co`, or
`api.smith.langchain.com`, so every cell that calls one of those wraps the live call in a
`try/except` and falls back to a deterministic, clearly-labeled offline path:

- **Groq** (`ChatGroq` / `create_agent`) → falls back to a small offline responder that
  still runs real SQL through the same tools; only the phrasing is templated.
- **Hugging Face embeddings** (`sentence-transformers/all-MiniLM-L6-v2`) → falls back to
  `OfflineHashEmbeddings`, a deterministic hashing-trick vectorizer, so Chroma/FAISS still
  do real similarity search on shared vocabulary (rougher than true semantic embeddings,
  but functional).
- **LangSmith tracing** → the context manager runs either way; the upload itself just
  can't complete without a route to LangSmith's API.

All 6 notebooks were executed end-to-end in this sandbox with **0 errors**. Each notebook
that touches a live backend has a "Verification status in this environment" table near
the end, distinguishing what ran for real here from what only gets exercised once you
have your Groq/LangSmith keys and normal internet access, on your own machine.

## `sample_pdfs/`

The 5 PDFs that `guided_lab_ingest_store_document_set_routemind.ipynb` generates on first
run are also included here directly, in case you want to open them without running the
notebook. The notebook is self-contained either way -- it only generates them if `./pdfs`
doesn't already have 5 PDFs in it, so dropping your own documents in instead works too.
