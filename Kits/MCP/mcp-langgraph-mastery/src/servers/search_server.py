from __future__ import annotations

from mcp.server.fastmcp import FastMCP

from src.tools.lab_helpers import concept_map, concept_markdown, format_top_matches, search_demo_corpus

mcp = FastMCP("guided-lab-search", json_response=True)


@mcp.tool()
def search_docs(query: str, top_k: int = 3) -> dict:
    """Search the guided-lab concept corpus."""
    matches = search_demo_corpus(query=query, top_k=top_k)
    return {
        "query": query,
        "top_k": top_k,
        "matches": matches,
        "rendered": format_top_matches(matches),
    }


@mcp.resource("concepts://map")
def get_concept_map() -> str:
    """Return the concept map as markdown."""
    return concept_markdown()


@mcp.prompt()
def search_prompt(topic: str, audience: str = "student") -> str:
    """Create a retrieval prompt for the lab corpus."""
    return (
        f"You are teaching {audience} about {topic}. "
        "Use the concept map, then explain the answer in short sections: concept, why it matters, and one example."
    )


if __name__ == "__main__":
    mcp.run(transport="stdio")
