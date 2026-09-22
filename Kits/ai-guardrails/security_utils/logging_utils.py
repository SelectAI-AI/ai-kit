"""
security_utils/logging_utils.py

Structured, append-only audit logging for InternalAssist.

Production AI systems need an audit trail that is independent of the
conversation itself: every input, every guardrail verdict, and every
blocking decision must be attributable later -- to a human reviewer, a
compliance audit, or an incident investigation, long after the chat session
is gone. This is distinct from (and complementary to) LangSmith tracing:
LangSmith is for *debugging and evaluating* model behaviour during
development; this audit log is a durable, queryable, security-relevant
record meant to outlive any one trace.

This logger is deliberately plain stdlib (no LangChain dependency) so it can
be reused by the notebook, by helper modules, and by pytest without circular
imports.
"""

from __future__ import annotations

import json
import logging
import os
import time
import uuid
from pathlib import Path
from typing import Any

DEFAULT_LOG_PATH = os.environ.get("AUDIT_LOG_PATH", "logs/audit_log.jsonl")


class AuditLogger:
    """Append-only JSON-lines audit logger for guardrail decisions.

    Each call to :meth:`log` writes exactly one JSON object per line. JSON
    Lines (rather than a single JSON array) is the standard format for audit
    logs because it is append-safe: a crash mid-write can corrupt at most the
    last line, never the whole file, and you never have to read+rewrite the
    entire log just to add one record.
    """

    def __init__(self, path: str | Path = DEFAULT_LOG_PATH) -> None:
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)

    def log(
        self,
        *,
        event: str,
        session_id: str,
        verdict: str,
        detail: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Write one structured audit record and return it.

        Args:
            event: what kind of event this is, e.g. ``"injection_scan"``.
            session_id: caller-supplied id used to correlate records that
                belong to the same conversation or red-team run.
            verdict: outcome of the event, e.g. ``"blocked"``, ``"allowed"``,
                ``"flagged"``.
            detail: arbitrary structured context (pattern names, matched
                snippets, latency, etc).
        """
        record: dict[str, Any] = {
            "ts": time.time(),
            "event_id": str(uuid.uuid4()),
            "session_id": session_id,
            "event": event,
            "verdict": verdict,
            "detail": detail or {},
        }
        with self.path.open("a", encoding="utf-8") as f:
            f.write(json.dumps(record, default=str) + "\n")
        return record

    def read_all(self) -> list[dict[str, Any]]:
        """Read back every record (used by the scorecard cells and pytest)."""
        if not self.path.exists():
            return []
        with self.path.open("r", encoding="utf-8") as f:
            return [json.loads(line) for line in f if line.strip()]

    def clear(self) -> None:
        """Delete all records. Useful for getting a clean slate between runs."""
        if self.path.exists():
            self.path.unlink()


def get_logger(name: str = "internalassist.security") -> logging.Logger:
    """Standard library logger for console/dev output.

    Kept separate from :class:`AuditLogger`: this one is for humans watching
    the notebook run in real time; the audit log is the durable record meant
    for later review.
    """
    logger = logging.getLogger(name)
    if not logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(
            logging.Formatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s")
        )
        logger.addHandler(handler)
        logger.setLevel(os.environ.get("LOG_LEVEL", "INFO"))
    return logger
