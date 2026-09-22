"""
security_utils/pii.py

Minimal PII detection/masking engine shared by Notebook 2 and its tests.

Design note (why this is "infrastructure" and not something you write):
the *mechanics* of finding spans, resolving overlaps, and masking
right-to-left are fiddly and easy to get subtly wrong (off-by-one indices,
overlapping matches, masking left-to-right and corrupting later offsets).
Those mechanics are given to you here. What you build in the notebook is the
part that actually matters for security: which entity types you choose to
detect, and how you *prove* (with a test) that none of them leak.

Two detection backends:

  * Presidio (preferred) -- Microsoft's PII analyzer, which adds NER-based
    detection of names, locations, etc. on top of pattern matching. Requires
    `presidio-analyzer` + a spaCy model.
  * Regex fallback -- a small, dependency-free set of patterns for the
    structured identifiers that matter most (email, SSN, phone, card, IP).
    Always available, so the notebook runs even where Presidio's model can't
    be installed.

`Recognizer.from_environment()` picks Presidio if it imports and builds, and
silently falls back to regex otherwise.
"""

from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass(frozen=True)
class PiiSpan:
    """One detected PII span: a labelled, half-open [start, end) range."""

    entity_type: str
    start: int
    end: int

    @property
    def length(self) -> int:
        return self.end - self.start


# ---------------------------------------------------------------------------
# Regex backend -- the dependency-free fallback. These cover the structured
# identifiers; names/addresses need Presidio's NER. The notebook discusses
# why regex alone is a floor, not a ceiling.
# ---------------------------------------------------------------------------
DEFAULT_PII_PATTERNS: dict[str, re.Pattern] = {
    # Order matters only for tie-breaking overlaps; SSN before PHONE so a
    # NNN-NN-NNNN string is labelled as an SSN, not a partial phone match.
    "US_SSN": re.compile(r"\b\d{3}-\d{2}-\d{4}\b"),
    "EMAIL_ADDRESS": re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b"),
    "CREDIT_CARD": re.compile(r"\b(?:\d[ -]*?){13,16}\b"),
    "PHONE_NUMBER": re.compile(r"\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b"),
    "IP_ADDRESS": re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b"),
}


def _resolve_overlaps(spans: list[PiiSpan]) -> list[PiiSpan]:
    """Keep non-overlapping spans, preferring earlier-starting then longer
    matches. Masking overlapping spans would corrupt offsets."""
    spans = sorted(spans, key=lambda s: (s.start, -s.length))
    resolved: list[PiiSpan] = []
    last_end = -1
    for s in spans:
        if s.start >= last_end:
            resolved.append(s)
            last_end = s.end
    return resolved


class RegexRecognizer:
    """Pattern-only PII detection. Always available, no model download."""

    backend = "regex"

    def __init__(self, patterns: dict[str, re.Pattern] | None = None):
        self.patterns = patterns or DEFAULT_PII_PATTERNS

    def detect(self, text: str) -> list[PiiSpan]:
        spans = [
            PiiSpan(label, m.start(), m.end())
            for label, pat in self.patterns.items()
            for m in pat.finditer(text)
        ]
        return _resolve_overlaps(spans)


class PresidioRecognizer:
    """NER + pattern PII detection via Microsoft Presidio (if available)."""

    backend = "presidio"

    def __init__(self) -> None:
        from presidio_analyzer import AnalyzerEngine

        self._engine = AnalyzerEngine()

    def detect(self, text: str) -> list[PiiSpan]:
        results = self._engine.analyze(text=text, language="en")
        spans = [PiiSpan(r.entity_type, r.start, r.end) for r in results]
        return _resolve_overlaps(spans)


def get_recognizer(prefer_presidio: bool = True):
    """Return a Presidio recognizer if it imports and builds, else regex.

    Building Presidio can fail if the spaCy model isn't installed; we catch
    that and fall back rather than crashing the notebook.
    """
    if prefer_presidio:
        try:
            return PresidioRecognizer()
        except BaseException:
            # Broad on purpose: a missing spaCy model can surface as an
            # ImportError, an OSError, or even a SystemExit from Presidio's
            # auto-download attempt. Any failure to build means "use regex".
            pass
    return RegexRecognizer()


def mask_text(text: str, spans: list[PiiSpan]) -> str:
    """Replace each span with a ``<ENTITY_TYPE>`` placeholder.

    Applied right-to-left so that masking one span never shifts the offsets
    of spans still to be processed -- the single most common bug when people
    write this themselves.
    """
    for s in sorted(spans, key=lambda s: s.start, reverse=True):
        text = text[: s.start] + f"<{s.entity_type}>" + text[s.end :]
    return text
