# Helios: an MCP + LangGraph diligence copilot for Solstice Capital Partners

Three self-contained Jupyter notebooks that build up, in stages, a real MCP + LangGraph agent
system for a fictional renewable-energy infrastructure investor.

**Scenario.** Solstice Capital Partners acquires operating and late-stage-development solar, wind,
and storage projects across the US. **Helios** is the internal copilot its investment analysts use
during diligence — first a glossary lookup, then a structured deal tracker, then a full
multi-server research-and-approval agent.

## Notebooks

| Notebook | Builds | Key concepts |
|---|---|---|
| `lab1_mcp_fundamentals_solstice.ipynb` | A glossary MCP server + a LangGraph ReAct agent | host/client/server, stdio transport, `@mcp.tool()` / `@mcp.resource()` / `@mcp.prompt()`, MCP Inspector |
| `lab2_sqlite_mcp_solstice.ipynb` | A deal-tracker database exposed over MCP | resources vs. resource *templates*, read-only query guard, inline validation |
| `lab3_multi_server_agent_solstice.ipynb` | The full copilot: three MCP servers behind one LangGraph supervisor | `MultiServerMCPClient`, `Send` fan-out/fan-in, PDF RAG, human approval via `interrupt()`, checkpointing that survives a restart |

Each notebook is independent and regenerates everything it needs (databases, PDFs, MCP server
scripts) into `data/` and `mcp_servers/` folders next to itself the first time you run it — there's
no fixed run order, though reading them in order (1 -> 2 -> 3) tells one continuous story.

## Setup

```bash
pip install -r requirements.txt --break-system-packages   # the flag is a no-op if you don't need it
python -m ipykernel install --user --name python3          # only if Jupyter has no kernel registered yet
```

Everything runs with **no API keys and no internet access** — every external dependency (an LLM,
real sentence-transformer embeddings) has a deterministic, clearly-labeled `[offline-fallback]`
that keeps each notebook running top to bottom. To unlock the live paths, create a `.env` file
next to the notebooks:

```
GROQ_API_KEY=your-key-here
GROQ_MODEL=openai/gpt-oss-20b        # optional, this is already the default
```

For real (non-fallback) embeddings in Lab 3, additionally run
`pip install langchain-huggingface sentence-transformers` and make sure you have a route to
huggingface.co — no notebook code needs to change either way.

## MCP Inspector (optional)

Each notebook writes its server(s) to a local `mcp_servers/` folder. With Node.js installed, you
can poke at any of them directly:

```bash
npx @modelcontextprotocol/inspector python mcp_servers/glossary_server.py
```

## Notes on this build

- Every notebook was executed top-to-bottom with `nbclient` before delivery; the verification
  table at the end of each one lists exactly what ran in a sandboxed, no-network environment
  versus what's written against current SDKs but needs live credentials to exercise.
- A couple of real bugs turned up during that execution pass — a JSON-vs-string mismatch in an
  offline fallback, an MCP behavior where a tool returning a bare list becomes multiple content
  blocks instead of one, and a sync-checkpointer-vs-async-graph error — and are left documented
  inline in the notebooks rather than silently fixed, since they're genuinely useful things to
  have seen once.
