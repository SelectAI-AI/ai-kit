# Enterprise AI Security & Guardrails
## A 5-notebook module on building security guardrails for LLM applications

All five notebooks share one running scenario, so the security controls you
build accumulate into something realistic instead of five disconnected toy
examples.

## The scenario: BranchLine

**BranchLine** is an internal IT/HR helpdesk copilot used by branch,
contact-center, and back-office staff at *Millbrook Bank*, a fictional
regional bank. It answers staff questions, summarizes support tickets, and —
in later notebooks — reads internal documents and takes real actions through
tools (ticket lookups, database queries, email).

| Notebook | Type | Topic | What BranchLine gains |
|---|---|---|---|
| **1** | Guided Lab | Prompt injection & jailbreak defence | A hardened chat pipeline: instruction hierarchy + a LangChain callback guard that detects and blocks 5 named injection patterns |
| **2** | Solo Exercise | PII & secret protection | A masking pipeline so retrieved customer/employee data never leaks PII into a response or a vector store |
| **3** | Guided Lab | RAG poisoning & data integrity | Source validation for a real retrieval pipeline, after seeing it get poisoned |
| **4** | Guided Lab (methodology) | LangSmith eval security checkpoint | An automated, repeatable red-team gate (≥0.80 score) that future changes must pass before shipping |
| **5** | Challenge | Secure agent design | A full guardrail stack on a LangGraph agent: rate limiting, tool whitelisting, least privilege, query sandboxing |

Across the module, you'll take BranchLine from an unguarded prototype (one
system prompt, one LLM call, no checks) to a hardened agent with five
independent, defense-in-depth layers — and you'll measure every one of them
against a reproducible 18-case red-team corpus plus a 12-case benign control
set, rather than eyeballing whether a fix "feels like" it worked.

## Learning objectives

By the end of this module you should be able to:

- Tell the difference between **direct** prompt injection, **indirect**
  prompt injection, and **jailbreaks** — and explain why a detector tuned
  for one doesn't automatically catch the others.
- Build canary-token-based red-team measurement (Attack Success Rate, False
  Positive Rate) instead of eyeballing whether an attack "felt like" it worked.
- Explain why `BaseCallbackHandler.raise_error` defaults to `False` in
  LangChain, and why that matters for any guardrail built on callbacks.
- Mask PII before it reaches a response *or* an embedding step, and prove
  redaction coverage rather than assuming it.
- Explain why retrieval ranks on relevance, not trust, and how per-chunk
  provenance closes that gap.
- Turn ad hoc red-teaming into a gated, repeatable evaluation.
- Harden an agent with tool whitelisting, least privilege, query sandboxing,
  rate limiting, and output validation.
- Honestly describe what a given guardrail layer does **not** cover.

## No Groq account? No problem

Notebook 1 is the only notebook in this module that calls a real LLM, and it
detects automatically whether you have a live `GROQ_API_KEY` configured. If
you don't (or the call fails for any reason — bad key, no network, a
decommissioned model), it falls back to a deterministic, network-free stand-in
with the exact same calling interface, clearly labeled `[offline-fallback]`
wherever it's active. Every section, scorecard, and assertion in the module
runs top-to-bottom either way. If you do have a Groq key, drop it in `.env`
and the notebook uses it transparently instead — no code changes needed.

## Setup

### 1. Requirements

- Python 3.11 or newer
- A [Groq](https://console.groq.com) account and API key (optional — free
  tier is fine; see above)
- A [LangSmith](https://smith.langchain.com) account and API key (optional,
  same as above)
- Jupyter (Lab or Notebook) or an editor with notebook support (VS Code, etc.)

### 2. Create a virtual environment and install dependencies

```bash
cd ai-guardrails
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate

pip install -r requirements.txt
pip install jupyterlab ipykernel    # if you don't already have a Jupyter setup
```

### 3. Configure your `.env` (optional)

```bash
cp .env.example .env
```

Open `.env` and fill in `GROQ_API_KEY` (from the
[Groq console](https://console.groq.com/keys)) and `LANGSMITH_API_KEY` (from
your [LangSmith settings page](https://smith.langchain.com)) if you have
them. Leave the other values at their defaults unless you have a reason to
change them. If you skip this file entirely, Notebook 1 uses the offline
fallback model and Notebooks 1 & 4 skip the LangSmith-specific cells with an
explanatory message — nothing else in the module is affected.

Groq retires model IDs periodically. If you ever get a 404 or "model
decommissioned" error, check
[console.groq.com/docs/models](https://console.groq.com/docs/models) for the
current list and update `GROQ_MODEL` in your `.env` — no code changes
needed, since the notebook reads the model name from configuration rather
than hardcoding it.

### 4. Run the notebooks, in order

```bash
jupyter lab
```

Open `01_prompt_injection_defence.ipynb` and run the cells **top to bottom**,
then move on to `02_...`, `03_...`, and so on. Each notebook writes files
that later notebooks depend on — see "How this module is organized" below.

### 5. Run the tests

From the project root, with your virtual environment active, **after**
running at least Notebook 1 (and Notebook 2, for its test file):

```bash
pytest tests/ -v
```

This runs the **unit tests** — pure-Python checks against the detector,
prompt, and callback modules the notebooks generate, using a fake/offline
chat model. No network access required, runs in well under a second.

To also run the **integration tests** (real Groq calls through the full
hardened pipeline, asserting the same ASR/FPR thresholds as the notebook):

```bash
pytest tests/ -v -m integration
```

These need a real `GROQ_API_KEY` in your `.env` and will make real API calls.

## How this module is organized

This module is deliberately **notebook-first**: almost everything lives in
the five `.ipynb` files. There is no pre-shipped `security_utils/` package or
`tests/` folder in this project — every module and every test file is
written to disk by a `%%writefile` cell the first time you run the notebook
that needs it. That means:

- The notebook cell that writes a module **is** the documentation for it —
  there's exactly one place to read the code.
- `security_utils/`, `tests/`, `logs/`, and `pytest.ini` will all appear on
  disk once you start running Notebook 1 — that's expected, not a missing
  download.
- Some of those files are infrastructure you just import (environment
  loading, the red-team corpus, audit logging, the offline fallback model,
  PII/RAG mechanics) — Notebook 1's Section 0 explains the distinction in
  full. Others (the detectors, the instruction-hierarchy prompt, the
  callback guard, your PII redaction logic) are the lab's actual
  deliverable, and you build them yourself.

```
ai-guardrails/
├── README.md                                <- you are here
├── requirements.txt
├── .env.example                              <- copy to .env and fill in your keys (optional)
├── 01_prompt_injection_defence.ipynb         <- start here
├── 02_pii_masking_pipeline.ipynb
├── 03_rag_poisoning.ipynb
├── 04_langsmith_eval_checkpoint.ipynb
├── 05_secure_agent.ipynb
│
│   (everything below appears once you run the notebooks -- none of it
│    ships pre-built)
│
├── security_utils/
│   ├── __init__.py
│   ├── config.py            written by Notebook 1        environment/settings loading
│   ├── corpus.py            written by Notebook 1        red-team corpus + benign control set + scoring oracle
│   ├── logging_utils.py     written by Notebook 1        structured audit logging
│   ├── offline_llm.py       written by Notebook 1        [offline-fallback] deterministic stand-in for ChatGroq
│   ├── detectors.py         written by Notebook 1        pattern detectors (Sections 7 & 9 -- your build)
│   ├── prompts.py           written by Notebook 1        instruction-hierarchy prompts (Section 8 -- your build)
│   ├── callbacks.py         written by Notebook 1        the runtime guardrail callback (Section 9 -- your build)
│   ├── pii.py               written by Notebook 2        PII span detection + masking mechanics
│   ├── pii_solution.py      written by Notebook 2        your redact()/coverage() (Section 5b -- your build)
│   └── rag.py               written by Notebook 3        keyword retriever + Document provenance
├── tests/
│   ├── test_injection_corpus.py   written by Notebook 1
│   └── test_pii.py                written by Notebook 2
├── pytest.ini                written by Notebook 1
└── logs/                     created automatically the first time any notebook logs an event
    ├── audit_log.jsonl
    ├── pii_audit.jsonl
    ├── rag_audit.jsonl
    ├── eval_audit.jsonl
    └── agent_audit.jsonl
```

## What "done" looks like

After running all five notebooks in order, you should have:

- A full `security_utils/` package and `tests/` suite generated on disk (see
  above), plus `logs/*.jsonl` files recording every guardrail decision made
  across the module.
- Notebook 1: a security scorecard showing Attack Success Rate on the five
  named patterns dropping to single digits, with a verified false-positive
  rate, and all Section 11 assertions passing.
- Notebook 2: 100% redaction coverage on the sample employee record, with
  `pytest tests/test_pii.py` passing.
- Notebook 3: the poisoned document blocked from the model's context while
  the real policy remains retrievable.
- Notebook 4: an overall security score ≥ 0.80, printed alongside an honest
  per-slice breakdown (named patterns vs. jailbreaks vs. benign controls).
- Notebook 5: every attack scenario blocked, every legitimate request
  served, and the confidential bonus-pool figure never appearing in any
  agent output.
- `pytest tests/ -v` passing (unit tests; add `-m integration` for the
  integration tests, which need a real Groq key).

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `ImportError: cannot import name 'X' from 'security_utils...'` | You're running a notebook cell (or pytest) before an earlier `%%writefile` cell has run. Re-run the relevant notebook from the top. |
| Notebook 1 prints `Chat model backend: [offline-fallback] ...` even though you set a key | Check `.env` is actually in the project root and `GROQ_API_KEY` isn't a placeholder value; the probe cell prints the specific error it hit. |
| Groq returns a 404 / model decommissioned error | See the `GROQ_MODEL` note in Setup step 3 — update `.env`, no code changes needed. |
| `pytest tests/ -v` collects 0 items and skips with a message about a missing module | Expected if you haven't run the corresponding notebook yet — that's the module the tests check. |
| LangSmith cells print "Set a real LANGSMITH_API_KEY..." and skip | Expected without a configured key — this is the same offline/live pattern as the chat model, not an error. |
| PII backend prints `regex` instead of `presidio` | Expected if `presidio-analyzer` or its spaCy model isn't installed — the notebook explains why this is a designed fallback, not a failure. |

## Module-wide takeaway

No single guardrail layer is sufficient on its own. BranchLine ends this
module protected by five independent controls — injection detection,
PII masking, RAG provenance, a gated eval, and agent-level sandboxing — and
none of them is perfect alone. That's defense in depth: an attacker has to
defeat all five, and every attempt along the way is logged for review.
