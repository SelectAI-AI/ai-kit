# mcp-langgraph-mastery

A guided lab workspace for MCP + LangGraph.

## What runs first

1. Open `notebooks/lab1_first_mcp_server.ipynb`.
2. Run the import/setup cell.
3. Execute the concept-map cell.
4. Then open `notebooks/lab2_sqlite_mcp.ipynb`.
5. Finish with `notebooks/lab3_multi_server_agent.ipynb`.

## Main files to edit while learning

- `src/tools/lab_helpers.py` for concept mapping, local search, and shared notebook helpers.
- `src/tools/db_utils.py` for SQLite schema, sample rows, and safe query helpers.
- `src/agents/langgraph_agent.py` for the LangGraph patterns:
  - ReAct agent wrapper
  - approval flow
  - supervisor / multi-agent graph
  - checkpointed resume flow
- `src/servers/search_server.py`, `src/servers/db_server.py`, and `src/servers/fs_server.py` if you want to inspect the raw MCP server layer.

## Why this structure

LangGraph is used as the main orchestration layer. LangChain provides model and tool integrations, and MCP exposes tools/resources/prompts through a standard interface. The MCP Python SDK supports tools, resources, prompts, and standard transports such as stdio and Streamable HTTP; MCP Inspector is the recommended debug tool. Current LangChain docs also describe `MultiServerMCPClient` for pulling tools from multiple MCP servers into one agent. 

LangGraph’s docs describe `StateGraph`, conditional edges, checkpoints for persistence, interrupts for human approval, and `Send` for fan-out patterns. The persistence guides also distinguish short-term checkpoints from long-term stores. 

## Setup

```bash
python -m venv .venv
# activate your venv
pip install -r requirements.txt
```

Fill `.env` with your keys:

- `GROQ_API_KEY`
- `LANGCHAIN_API_KEY`
- `TAVILY_API_KEY`

Then run the tests:

```bash
pytest -q
```

## Notebook flow

### Lab 1: First MCP Server
Focus:
- MCP core concepts
- host / client / server / transport
- stdio transport
- MCP Inspector
- `@mcp.tool()`, `@mcp.resource()`, `@mcp.prompt()`
- connect one MCP server to a LangGraph agent

### Lab 2: SQLite MCP
Focus:
- expose SQLite as a resource
- expose SQLite as queryable tools
- structured database prompts
- pytest checks for query output

### Lab 3: Multi-Server MCP Agent
Focus:
- `MultiServerMCPClient`
- search + SQLite + filesystem servers
- LangGraph supervisor flow
- shared vs scoped state
- long-term memory ideas with SQLite / Chroma
- production notes: community servers, Docker, bearer tokens

## MCP Inspector

For a local server, inspect it with the MCP Inspector from the project root:

```bash
npx @modelcontextprotocol/inspector uv run python -m src.servers.search_server
```

For a stdio server, the Inspector is the fastest way to verify tools and prompts without writing extra client code. 

## Notes

- The current SDK documentation emphasizes stdio and Streamable HTTP as standard transports; legacy SSE examples still appear in older ecosystem material. 
- LangChain’s MCP adapter exposes `MultiServerMCPClient` for aggregating tools from more than one MCP server. 
- For persistence, LangGraph checkpointers store thread-scoped state, and `SqliteSaver` is the local SQLite-backed option mentioned in the docs. 