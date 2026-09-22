from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable

try:
    from langchain_chroma import Chroma
except Exception:  # pragma: no cover - optional dependency fallback
    Chroma = None  # type: ignore

try:
    from langchain_core.documents import Document
except Exception:  # pragma: no cover - notebook/runtime fallback
    @dataclass
    class Document:  # type: ignore
        page_content: str
        metadata: dict[str, Any]

BASE_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

CONCEPT_CARDS: list[dict[str, str]] = [
    {
        "concept": "What MCP solves",
        "summary": "MCP standardizes how hosts, clients, and servers exchange context, tools, and prompts.",
    },
    {
        "concept": "Transport architecture",
        "summary": "The current Python SDK emphasizes stdio and Streamable HTTP; the docs also discuss legacy SSE examples for older ecosystems.",
    },
    {
        "concept": "MCP server primitives",
        "summary": "@mcp.tool(), @mcp.resource(), and @mcp.prompt() expose callable tools, readable resources, and prompt templates.",
    },
    {
        "concept": "LangGraph basics",
        "summary": "StateGraph, conditional edges, compile(), and invoke() make graph control flow explicit and inspectable.",
    },
    {
        "concept": "Human approval",
        "summary": "interrupt() and interrupt_before pause a graph so a human can approve, edit, or reject an action.",
    },
    {
        "concept": "Persistence",
        "summary": "MemorySaver, SqliteSaver, and stores enable short-term and long-term memory across runs.",
    },
    {
        "concept": "Multi-server agents",
        "summary": "MultiServerMCPClient can expose tools from multiple MCP servers to one agent.",
    },
    {
        "concept": "Production",
        "summary": "Community MCP servers, Docker deployment, and bearer-token auth are part of the production story.",
    },
]

def concept_map() -> list[dict[str, str]]:
    return list(CONCEPT_CARDS)

def concept_markdown() -> str:
    lines = ["# Concept map"]
    for item in CONCEPT_CARDS:
        lines.append(f"- **{item['concept']}** — {item['summary']}")
    return "\n".join(lines)

def build_demo_corpus() -> list[Document]:
    docs: list[Document] = []
    for item in CONCEPT_CARDS:
        docs.append(
            Document(
                page_content=f"{item['concept']}: {item['summary']}",
                metadata={"concept": item["concept"], "source": "concept_map"},
            )
        )
    docs.extend(
        [
            Document(
                page_content="Lab 1 builds a search_docs MCP tool and connects it to a LangGraph ReAct agent.",
                metadata={"concept": "Lab 1", "source": "lab"},
            ),
            Document(
                page_content="Lab 2 exposes SQLite through MCP resources and tools, with pytest validating query results.",
                metadata={"concept": "Lab 2", "source": "lab"},
            ),
            Document(
                page_content="Lab 3 connects three MCP servers—search, SQLite, and filesystem—to one agent using MultiServerMCPClient.",
                metadata={"concept": "Lab 3", "source": "lab"},
            ),
        ]
    )
    return docs

def _score_overlap(query: str, text: str) -> int:
    q_tokens = {t.lower() for t in query.replace("_", " ").split() if len(t) > 2}
    text_tokens = {t.lower().strip(".,:;()[]{}") for t in text.split()}
    return len(q_tokens & text_tokens)

def search_demo_corpus(query: str, top_k: int = 3) -> list[dict[str, Any]]:
    docs = build_demo_corpus()
    ranked = sorted(
        [
            {
                "content": doc.page_content,
                "metadata": doc.metadata,
                "score": _score_overlap(query, doc.page_content),
            }
            for doc in docs
        ],
        key=lambda item: item["score"],
        reverse=True,
    )
    return ranked[: max(1, top_k)]

def build_chroma_store(persist_dir: str | Path | None = None):
    if Chroma is None:
        return None
    persist_dir = Path(persist_dir or (DATA_DIR / "chroma_docs"))
    persist_dir.mkdir(parents=True, exist_ok=True)
    docs = build_demo_corpus()
    metadatas = [doc.metadata for doc in docs]
    texts = [doc.page_content for doc in docs]
    store = Chroma.from_texts(
        texts=texts,
        metadatas=metadatas,
        collection_name="mcp_langgraph_mastery",
        persist_directory=str(persist_dir),
    )
    return store

def format_top_matches(matches: list[dict[str, Any]]) -> str:
    lines = []
    for i, item in enumerate(matches, start=1):
        lines.append(f"{i}. {item['metadata'].get('concept', 'unknown')} (score={item['score']}): {item['content']}")
    return "\n".join(lines)

def demo_questions() -> list[str]:
    return [
        "Explain what MCP solves and how hosts differ from servers.",
        "Show how a LangGraph StateGraph with conditional edges works.",
        "How do I connect multiple MCP servers into one agent?",
        "What is the difference between interrupt_before and checkpointing?",
    ]
