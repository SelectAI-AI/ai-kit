"""
security_utils/config.py

Centralised environment/config loading.

Production systems never scatter ``os.environ.get()`` calls through business
logic -- secrets and tunables are loaded once, lightly validated, and passed
around as a typed object. That gives you one place to look when a credential
rotates or a default needs tuning, and makes it obvious in a code review
which environment variables the application actually depends on.

This module deliberately has zero LangChain dependency so it can be imported
by plain pytest, plain scripts, or notebooks without pulling in the rest of
the stack.
"""

from __future__ import annotations

import os
from dataclasses import dataclass

from dotenv import load_dotenv

# Loads variables from a local .env file into the process environment.
# Safe no-op if no .env file is present (e.g. in CI where vars are injected
# directly), and never overwrites a variable that is already set.
load_dotenv()


@dataclass(frozen=True)
class Settings:
    """Typed view over the environment variables this lab depends on."""

    groq_api_key: str
    groq_model: str
    langsmith_tracing: bool
    langsmith_project: str
    audit_log_path: str
    injection_block_threshold: int


def get_settings() -> Settings:
    """Load and lightly validate configuration from environment variables.

    Raises:
        RuntimeError: if a required secret (GROQ_API_KEY) is missing, with a
            message that tells the learner exactly what to do about it. This
            is itself a small piece of secure design: fail loudly and early
            at startup, never silently fall back to an unauthenticated call.
    """
    groq_api_key = os.environ.get("GROQ_API_KEY", "").strip()
    if not groq_api_key:
        raise RuntimeError(
            "GROQ_API_KEY is not set. Copy .env.example to .env in the "
            "project root and fill in your Groq API key before continuing."
        )

    return Settings(
        groq_api_key=groq_api_key,
        groq_model=os.environ.get("GROQ_MODEL", "openai/gpt-oss-20b"),
        langsmith_tracing=os.environ.get("LANGSMITH_TRACING", "false").strip().lower()
        == "true",
        langsmith_project=os.environ.get("LANGSMITH_PROJECT", "internalassist-nb1"),
        audit_log_path=os.environ.get("AUDIT_LOG_PATH", "logs/audit_log.jsonl"),
        injection_block_threshold=int(os.environ.get("INJECTION_BLOCK_THRESHOLD", "1")),
    )
