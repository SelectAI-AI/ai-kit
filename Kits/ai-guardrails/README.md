# Enterprise AI Security & Guardrails
## Notebook 1 of 5 — Prompt Injection & Jailbreak Defence (Guided Lab)

This is the first notebook in a 5-part module on building security
guardrails for LLM applications. All five notebooks share one running
scenario so the security controls you build accumulate into something
realistic, rather than five disconnected toy examples.

## The scenario: InternalAssist

**InternalAssist** is an internal IT/HR helpdesk copilot for a fictional
company, *Northwind Corp*. It answers employee questions, summarizes
support tickets, and — in later notebooks — reads internal documents and
takes real actions through tools (directory lookups, email, ticketing).

| Notebook | Type | Topic | What InternalAssist gains |
|---|---|---|---|
| **1 — this one** | Guided Lab | Prompt injection & jailbreak defence | A hardened chat pipeline: instruction hierarchy + a LangChain callback guard that detects and blocks 5 named injection patterns |
| 2 | Solo Exercise | PII & secret protection | A masking pipeline so retrieved employee data never leaks PII into a response or a vector store |
| 3 | Guided Lab | RAG poisoning & data integrity | Source validation for a real retrieval pipeline, after seeing it get poisoned |
| 4 | Guided Lab (methodology) | LangSmith eval security checkpoint | An automated, repeatable red-team gate (≥0.80 score) that future changes must pass before shipping |
| 5 | Challenge | Secure agent design | A full guardrail stack on a LangGraph agent: rate limiting, tool whitelisting, least privilege, query sandboxing |

## What this notebook covers

You'll build InternalAssist **v0** (no guardrails at all — exactly what a
prototype under deadline pressure looks like), attack it yourself with a
reproducible 18-case red-team corpus covering five named injection patterns
plus jailbreak variants, measure how bad it is, and then build and compare
three mitigation strategies before validating the fix:

1. **Input sanitization** — a free, regex/keyword pre-filter (Section 7)
2. **Instruction hierarchy enforcement** — a prompting strategy that gives
   untrusted pasted content an explicit boundary (Section 8)
3. **A LangChain callback guard** — runtime detection and blocking, wired
   into the model-call lifecycle (Section 9) — **this is the lab's named
   deliverable**

Along the way you'll hit (and fix) two real bugs in the guardrail itself —
the notebook walks through finding and understanding both before patching
them, rather than just handing you working code.

## Learning objectives

By the end of this notebook you should be able to:

- Tell the difference between **direct** prompt injection, **indirect**
  prompt injection, and **jailbreaks** — and explain why a detector tuned
  for one doesn't automatically catch the others.
- Explain why `BaseCallbackHandler.raise_error` defaults to `False` in
  LangChain, and why that matters for any guardrail built on callbacks.
- Build canary-token-based red-team measurement (Attack Success Rate, False
  Positive Rate) instead of eyeballing whether an attack "felt like" it worked.
- Articulate the usability/security, cost/protection, and latency/validation
  trade-offs that come with each mitigation layer, with numbers to back it up.
- Honestly describe what a given guardrail layer does **not** cover.

## File map

```
prompt-injection-lab/
├── README.md                              <- you are here
├── SETUP.md                                <- environment setup, do this first
├── requirements.txt
├── .env.example                             <- copy to .env and fill in your keys
├── 01_prompt_injection_defence.ipynb        <- the lab itself, start to finish
├── security_utils/
│   ├── __init__.py
│   ├── config.py            (pre-built)     environment/settings loading
│   ├── corpus.py            (pre-built)     the red-team corpus + benign control set + scoring oracle
│   ├── logging_utils.py     (pre-built)     structured audit logging
│   ├── detectors.py         (you generate this by running Section 7 & 9)
│   ├── prompts.py           (you generate this by running Section 8)
│   └── callbacks.py         (you generate this by running Section 9)
├── tests/
│   └── test_injection_corpus.py
├── pytest.ini
└── logs/                                    <- audit_log.jsonl lands here once you run the notebook
```

`detectors.py`, `prompts.py`, and `callbacks.py` will **not** exist until
you run the notebook's `%%writefile` cells — that's intentional. The corpus
and the scoring logic are given to you (a red team's "answer key" is
curated centrally, not reinvented per exercise); the actual detection and
defense code is what you're here to build.

## What "done" looks like

After running the full notebook, you should have:

- A `logs/audit_log.jsonl` file with one record per guardrail decision made
  during the notebook run.
- A security scorecard (printed in Section 13) showing Attack Success Rate
  dropping from your v0 baseline down to single digits on the five named
  patterns, with a verified false-positive rate on the benign control set.
- All assertions in Section 11 passing.
- `pytest tests/ -v` passing (the unit tests; see `SETUP.md` for the
  integration tests, which need a real Groq key).
- A LangSmith dataset, `internalassist-injection-corpus-v1`, visible in your
  LangSmith project — this is what Notebook 4 builds its automated
  checkpoint on top of.

## Up next

**Notebook 2 (Solo Exercise) — PII & Secret Protection.** InternalAssist can
now resist the five named injection patterns. It still has no idea that an
employee record, once retrieved, might contain a Social Security number that
should never appear in a chat response or get embedded into a vector store.
