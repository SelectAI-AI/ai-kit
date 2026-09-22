"""
security_utils/callbacks.py

Runtime guardrail: detect and block prompt injection before the request
reaches the model. Built in Notebook 1, Section 9 (v1, after the
per-message-scope fix found earlier in this section).
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from langchain_core.callbacks import BaseCallbackHandler
from langchain_core.messages import BaseMessage

from security_utils.detectors import Detection, scan_rendered_prompt
from security_utils.logging_utils import AuditLogger, get_logger

logger = get_logger(__name__)

# Why we scan messages individually, human messages only, instead of joining
# everything into one string (see the notebook cells above for how we found
# this the hard way):
#
# 1. Statistical heuristics (the leetspeak-density check) get diluted to
#    nothing once a short attack payload is mixed in with a long trusted
#    system prompt -- the ratio that mattered in isolation disappears.
# 2. The indirect-embedded-content detector looks for a PAIRED
#    <untrusted_external_content>...</untrusted_external_content> span. If
#    the system prompt happens to mention that tag name in passing while
#    explaining the rule, concatenating it with the human turn's real tag
#    pair lets the regex match from that incidental mention all the way to
#    the real closing tag -- silently scanning a huge, wrong span that
#    includes the system prompt's own legitimate instructions.
# 3. Conceptually: the system message is operator-authored and trusted.
#    Attacker-controlled content only ever arrives in the human turn,
#    directly or pasted in as "untrusted context" -- so that is the only
#    thing we need to scan.


class PromptInjectionDetected(Exception):
    """Raised when the guardrail blocks a request before it reaches the LLM."""

    def __init__(self, detections: list[Detection], session_id: str):
        self.detections = detections
        self.session_id = session_id
        patterns = ", ".join(sorted({d.pattern.value for d in detections}))
        super().__init__(f"Blocked request (session={session_id}): matched [{patterns}]")


class InjectionGuardCallback(BaseCallbackHandler):
    """Scans each human message individually, right before the fully
    assembled prompt is sent to the model.

    Hooking `on_chat_model_start` means we inspect the prompt AFTER prompt
    assembly (instruction-hierarchy template already applied) but BEFORE the
    network call to Groq. A detection raised here means the malicious prompt
    never reaches the model: no tokens billed, no latency spent on a round
    trip, nothing for the model to (possibly) comply with.
    """

    raise_error = True  # without this, LangChain swallows our exception and
                         # the chain runs anyway -- see Section 9 intro.

    def __init__(self, audit_logger: AuditLogger | None = None, block_threshold: int = 1):
        super().__init__()
        self.audit_logger = audit_logger or AuditLogger()
        self.block_threshold = block_threshold

    def on_chat_model_start(
        self,
        serialized: dict[str, Any],
        messages: list[list[BaseMessage]],
        *,
        run_id: UUID,
        parent_run_id: UUID | None = None,
        tags: list[str] | None = None,
        metadata: dict[str, Any] | None = None,
        **kwargs: Any,
    ) -> None:
        metadata = metadata or {}
        session_id = metadata.get("session_id", str(run_id))

        detections: list[Detection] = []
        for batch in messages:
            for message in batch:
                if message.type != "human" or not isinstance(message.content, str):
                    continue
                detections.extend(scan_rendered_prompt(message.content))

        if len(detections) >= self.block_threshold:
            self.audit_logger.log(
                event="injection_scan", session_id=session_id, verdict="blocked",
                detail={"case_id": metadata.get("case_id"),
                        "matches": [{"pattern": d.pattern.value, "detector": d.detector, "snippet": d.snippet} for d in detections]},
            )
            logger.warning("Blocked request %s: %s", session_id, [d.pattern.value for d in detections])
            raise PromptInjectionDetected(detections, session_id)

        self.audit_logger.log(
            event="injection_scan", session_id=session_id, verdict="allowed",
            detail={"case_id": metadata.get("case_id")},
        )
