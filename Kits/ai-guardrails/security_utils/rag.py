"""
security_utils/rag.py

A deliberately tiny, dependency-free retrieval layer for the RAG-poisoning
lab (Notebook 3).

Why no real embedding model or vector DB? Because the security lesson —
*where did this chunk come from, and do I trust that source?* — is identical
whether retrieval is keyword overlap or cosine similarity over embeddings.
Stripping out the embedding stack keeps the notebook focused on provenance
and source validation instead of vector-store plumbing. In production you'd
swap `KeywordRetriever` for a real vector store; the `Document.source` /
`Document.trusted` provenance fields and the guardrail built around them
carry over unchanged.
"""

from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass
class Document:
    """A knowledge-base chunk that remembers its own provenance.

    The two security-relevant fields are `source` and `trusted`: real RAG
    leaks happen because a chunk's *content* is treated as authoritative
    while its *origin* is ignored. Tracking origin per-chunk is what makes a
    source-validation guardrail possible at all.
    """

    id: str
    text: str
    source: str
    trusted: bool = True


def _tokens(text: str) -> set[str]:
    return set(re.findall(r"[a-z0-9]+", text.lower()))


class KeywordRetriever:
    """Ranks documents by keyword overlap with the query. Stand-in for a
    vector retriever; same interface (`retrieve(query, k)`)."""

    def __init__(self, documents: list[Document]):
        self.documents = list(documents)

    def add(self, document: Document) -> None:
        self.documents.append(document)

    def retrieve(self, query: str, k: int = 3) -> list[Document]:
        q = _tokens(query)
        scored = [(len(q & _tokens(d.text)), d) for d in self.documents]
        scored = [(score, d) for score, d in scored if score > 0]
        scored.sort(key=lambda pair: pair[0], reverse=True)
        return [d for _, d in scored[:k]]
