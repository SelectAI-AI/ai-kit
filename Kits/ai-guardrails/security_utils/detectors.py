"""
security_utils/detectors.py

Pattern-detection functions for the five named injection patterns.
Built in Notebook 1: Section 7 (direct patterns) and Section 9 (indirect
pattern + the recursive encoded-payload decoder).
"""

from __future__ import annotations

import base64
import codecs
import re
from dataclasses import dataclass

from security_utils.corpus import InjectionPattern


@dataclass(frozen=True)
class Detection:
    pattern: InjectionPattern
    snippet: str
    confidence: str  # "low" | "medium" | "high"
    detector: str


def _compile_any(patterns: list[str]) -> re.Pattern:
    return re.compile("|".join(f"(?:{p})" for p in patterns), re.IGNORECASE)


# ---------------------------------------------------------------------------
# Pattern 1: Direct Instruction Override
# ---------------------------------------------------------------------------
DIRECT_OVERRIDE_PATTERNS = [
    r"ignore\s+(all\s+)?(previous|prior|above|the)\s+(instructions?|rules?|prompts?)",
    r"disregard\s+(your|the|all)\s+(rules?|instructions?|policy|policies)",
    r"forget\s+(what|everything)\s+(you\s+were|i)\s+(told|said)",
    r"new\s+instructions?\s*:",
    r"override\s+(your|the)\s+(instructions?|rules?|system\s+prompt)",
    r"print\s+(your|the)\s+(full\s+)?system\s+prompt",
    r"repeat\s+(back\s+)?(everything\s+in\s+)?your\s+system\s+prompt",
]
_DIRECT_OVERRIDE_RE = _compile_any(DIRECT_OVERRIDE_PATTERNS)


def detect_direct_override(text: str) -> Detection | None:
    match = _DIRECT_OVERRIDE_RE.search(text)
    if match:
        return Detection(InjectionPattern.DIRECT_OVERRIDE, match.group(0), "high", "detect_direct_override")
    return None


# ---------------------------------------------------------------------------
# Pattern 2: Delimiter / Context Breakout
# ---------------------------------------------------------------------------
DELIMITER_BREAKOUT_PATTERNS = [
    r"---\s*end\s+system\s+prompt\s*---",
    r"</\s*system\s*>",
    r"<\s*system\s*>",
    r"\[/?inst\]",
    r'"""',
]
_DELIMITER_BREAKOUT_RE = _compile_any(DELIMITER_BREAKOUT_PATTERNS)


def detect_delimiter_breakout(text: str) -> Detection | None:
    match = _DELIMITER_BREAKOUT_RE.search(text)
    if match:
        return Detection(InjectionPattern.DELIMITER_BREAKOUT, match.group(0), "high", "detect_delimiter_breakout")
    return None


# ---------------------------------------------------------------------------
# Persona / Role Hijack (one of the 5 named patterns; built here alongside
# the other direct-text detectors)
# ---------------------------------------------------------------------------
PERSONA_HIJACK_PATTERNS = [
    r"\byou\s+are\s+now\b",
    r"\bact\s+as\b.{0,40}\b(unfiltered|unrestricted|no\s+rules?|no\s+restrictions?)\b",
    r"\bdeveloper\s+mode\b",
    r"\bDAN\b",
    r"\bno\s+content\s+polic(y|ies)\b",
    r"\bunfiltered\s+ai\b",
    r"\bpretend\s+to\s+be\b.{0,40}\b(unfiltered|unrestricted|no\s+(rules?|restrictions?|policy))\b",
]
_PERSONA_HIJACK_RE = _compile_any(PERSONA_HIJACK_PATTERNS)


def detect_persona_hijack(text: str) -> Detection | None:
    match = _PERSONA_HIJACK_RE.search(text)
    if match:
        return Detection(InjectionPattern.PERSONA_HIJACK, match.group(0), "high", "detect_persona_hijack")
    return None


# ---------------------------------------------------------------------------
# Pattern 3: Encoded Payload
# Three signals, each cheap: a named-scheme keyword, a long base64-shaped
# token, or an unusually high density of leetspeak digit-for-letter swaps.
# On any signal, we attempt to actually decode and recursively check the
# result for direct-override intent -- catching the attack regardless of
# which encoding scheme was used, instead of hardcoding "translate every
# possible obfuscation by hand."
# ---------------------------------------------------------------------------
ENCODING_SCHEME_KEYWORDS = re.compile(r"\b(base64|rot13|leetspeak)\b", re.IGNORECASE)
LONG_BASE64_TOKEN = re.compile(r"[A-Za-z0-9+/]{24,}={0,2}")
_LEET_MAP = str.maketrans({"0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t"})


def _looks_like_leetspeak(text: str) -> bool:
    words = re.findall(r"[A-Za-z0-9]{3,}", text)
    if not words:
        return False
    leet_words = [w for w in words if re.search(r"[A-Za-z]", w) and re.search(r"[0-9]", w)]
    return (len(leet_words) / len(words)) > 0.25


def _decode_candidates(text: str) -> list[str]:
    candidates: list[str] = []
    for token in LONG_BASE64_TOKEN.findall(text):
        try:
            candidates.append(base64.b64decode(token).decode("utf-8", errors="ignore"))
        except Exception:
            continue
    try:
        candidates.append(codecs.decode(text, "rot13"))
    except Exception:
        pass
    candidates.append(text.translate(_LEET_MAP))
    return candidates


def detect_encoded_payload(text: str) -> Detection | None:
    has_scheme_keyword = bool(ENCODING_SCHEME_KEYWORDS.search(text))
    has_long_b64_token = bool(LONG_BASE64_TOKEN.search(text))
    is_leetspeak = _looks_like_leetspeak(text)

    if not (has_scheme_keyword or has_long_b64_token or is_leetspeak):
        return None

    for candidate in _decode_candidates(text):
        nested = detect_direct_override(candidate)
        if nested:
            return Detection(InjectionPattern.ENCODED_PAYLOAD, candidate[:80], "high", "detect_encoded_payload")

    if has_long_b64_token or is_leetspeak:
        # Suspicious shape, but decoding didn't confirm override intent --
        # flag at lower confidence rather than silently passing it through.
        return Detection(InjectionPattern.ENCODED_PAYLOAD, text[:80], "medium", "detect_encoded_payload")

    # A bare mention of an encoding scheme name with no payload and no
    # decoded override intent is treated as benign (e.g. "can you base64
    # encode this for me?" -- a completely normal IT-helpdesk request).
    return None


def scan_text(text: str) -> list[Detection]:
    """Run all four direct-pattern detectors against one piece of text."""
    checks = [detect_direct_override, detect_delimiter_breakout, detect_encoded_payload, detect_persona_hijack]
    return [d for d in (check(text) for check in checks) if d is not None]


# ---------------------------------------------------------------------------
# Pattern 4 (numbered to match the lab's 5-pattern list as "indirect
# embedded"): indirect injection via embedded/untrusted content.
# Added once the instruction-hierarchy template (Section 8) gives us a
# reliable, taggable boundary to scan inside.
# ---------------------------------------------------------------------------
UNTRUSTED_BLOCK_RE = re.compile(
    r"<untrusted_external_content>(.*?)</untrusted_external_content>",
    re.IGNORECASE | re.DOTALL,
)

INDIRECT_INSTRUCTION_PATTERNS = [
    r"\bassistant\b.{0,80}\b(ignore|instead|disregard|reveal|email|send|approve|disable)\b",
    r"\bnote\s+to\s+(the\s+)?(ai|assistant)\b",
    r"<!--\s*system\s*:",
    r"\bsystem\s*:\s",
]
_INDIRECT_INSTRUCTION_RE = _compile_any(INDIRECT_INSTRUCTION_PATTERNS)


def detect_indirect_embedded(text: str) -> Detection | None:
    """Scan ONLY inside <untrusted_external_content> blocks. Scanning the
    whole message would risk matching against the system prompt's OWN
    legitimate instructions about how to handle untrusted content -- see the
    notebook for a live demonstration of exactly that bug."""
    for block in UNTRUSTED_BLOCK_RE.findall(text):
        match = _INDIRECT_INSTRUCTION_RE.search(block)
        if match:
            return Detection(InjectionPattern.INDIRECT_EMBEDDED, block.strip()[:120], "high", "detect_indirect_embedded")
    return None


def scan_rendered_prompt(text: str) -> list[Detection]:
    """Full scan of one piece of text: the four direct-pattern detectors
    plus the indirect-embedded-content detector."""
    direct_hits = scan_text(text)
    indirect_hit = detect_indirect_embedded(text)
    return direct_hits + ([indirect_hit] if indirect_hit else [])
