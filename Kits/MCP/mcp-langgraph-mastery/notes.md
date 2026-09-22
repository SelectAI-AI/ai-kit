# Teaching Notes

This workspace is split into four teaching layers.

## Layer 1 — MCP core
- What MCP solves
- host / client / server
- stdio and HTTP-based transports
- MCP Inspector

## Layer 2 — Server building
- `@mcp.tool()`
- `@mcp.resource()`
- `@mcp.prompt()`
- schema validation from typed Python signatures

## Layer 3 — LangGraph
- `StateGraph`
- TypedDict state
- conditional edges
- compile / invoke
- checkpoints and resume
- interrupts and approval gates

## Layer 4 — multi-server orchestration
- `MultiServerMCPClient`
- search / SQLite / filesystem servers
- supervisor nodes
- fan-out with `Send`
- memory and production patterns
