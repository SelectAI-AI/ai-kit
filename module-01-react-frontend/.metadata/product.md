# Product

## What this is

An interactive, browser-based learning platform for **Module 01 ("Foundations")** of a Practical AI/ML Engineering course. It mirrors the content of a Jupyter notebook (`module-01-foundations/01_guided_lab.ipynb` in a sibling project) as a structured, guided, step-by-step web experience rather than a static notebook.

## Target user

A student working through the course's first module — learning the basics of calling an LLM (Groq), prompting techniques, LangChain chains, query routing/classification, and evaluation via LangSmith. The product assumes the student supplies their own API keys (Groq, LangSmith) rather than the course providing shared credentials.

## Core workflow

The app is structured as a **6-step linear lab**, enforced by sequential locking (`AppShell` — a step is locked until the previous one is completed):

1. **Step 1 — Env Setup** (`Step1EnvSetup.tsx`): verifies the student's environment/API keys are correctly configured (`POST /api/steps/1/check-env`).
2. **Step 2 — Groq basics** (`Step2Groq.tsx`): first LLM call via Groq (`POST /api/steps/2/invoke`).
3. **Step 3 — Prompting techniques** (`Step3Prompts.tsx`): exercises across zero-shot, few-shot, chain-of-thought, role prompting, JSON output, and multi-step prompting (`POST /api/steps/3/prompt`).
4. **Step 4 — Chains** (`Step4Chains.tsx`): building/invoking LangChain chains (basic, JSON-output, Pydantic-structured) (`POST /api/steps/4/chain`).
5. **Step 5 — Routing** (`Step5Routing.tsx`): query classification and routing logic (`POST /api/steps/5/route`).
6. **Step 6 — Evaluation** (`Step6Eval.tsx`): pulls and displays evaluation results from LangSmith (`GET /api/steps/6/eval`).

Each step page composes shared building blocks: `MarkdownCell` (lesson content), `CodeCell` (Monaco-editor code cell — read/write, but not executable in-app), `ConceptCheck` (comprehension checks), `ExercisePanel` (graded exercises), `RemediationPanel` (feedback/hints when a check fails).

## Completion model — self-attested, not sandboxed

There is no in-app code execution. Students are expected to install and run the exercise code themselves in their own local Python environment (matching the sibling `module-01-foundations` project), watching/typing the code rather than copying it in — `CodeCell` blocks copy, cut, paste, and drag-and-drop on the editor to reinforce this (see `useScreenCaptureGuard`/`SecurityBanner` below for the screenshot side of the same goal). Once a student has run the code locally and confirmed it works, they click **"Mark as done"** on the cell, which self-attests completion with no server-side validation. This is a deliberate product decision: the goal is that students actually type and understand the code (since a certificate is issued on completion), not that the platform verifies correctness — there was previously a Docker-based sandbox (`POST /api/execute`) that ran student code server-side and validated its output, but it has been removed in favor of this self-attested, locally-run model.

`ConceptCheck` (multiple-choice) is the only mechanism that remains machine-checked — it still validates the selected answer against a correct value before allowing the step to complete.

## Anti-cheating measures — deterrents, not guarantees

Two measures reinforce "type/watch, don't copy" across the app, both implemented client-side and both explicitly understood (per product decision) to deter casual attempts rather than stop a determined user:

- **Copy/paste blocking** on `CodeCell`'s Monaco editor — Ctrl/Cmd+C/V/X, right-click clipboard actions, and drag-and-drop are all intercepted, with a top-of-screen banner ("Copying/Pasting is disabled — please write your own code.") shown on each attempt.
- **Screenshot/recording deterrent** — the whole app content blurs on window blur / tab switch (with a banner explaining why), and a PrintScreen keypress triggers its own banner. This does **not** reliably catch OS-level screenshot tools (Windows Snipping Tool, Win+Shift+S don't consistently fire a window blur event) and cannot stop a phone camera pointed at the screen — it's a deterrent against casual capture, not a security control.

## Progress & session model

- Progress (`useProgress` hook) and API keys (`useApiKeys` hook) persist in the browser's `localStorage` — there's no backend user account, no login, and no server-side persistence of student progress.
- The header shows a live "API: Connected/Disconnected" badge (`useApiStatus`, polling `GET /api/status`) and an overall progress bar reflecting how many of the 6 steps are complete.
- Because state lives only in `localStorage`, progress is per-browser/per-device, not synced across devices, and is lost if storage is cleared.

## Existing but unused/legacy surface

Several pages exist in the codebase with their own tests but are **not wired into the router** (`App.tsx` only routes `/step/1`–`/step/6`):
- `EvalDashboard.tsx`, `LabViewer.tsx`, `Playground.tsx`, `QueryRouter.tsx`

These likely represent an earlier product direction (a freeform playground / standalone lab viewer / eval dashboard, separate from the guided 6-step flow) that was superseded by the current step-locked structure, or components staged for a future release. The backend still exposes legacy route aliases (`/api/chain/invoke`, `/api/classify`, `/api/eval/results`) that mirror these unused pages' likely original API needs — consistent with an in-progress consolidation from a more open-ended tool into the current guided-lab format.

## Business context / constraints

- This is a **course companion tool**, not a standalone commercial product — its value is entirely coupled to the external `module-01-foundations` notebook project it wraps and re-presents. It cannot be understood or deployed independently of that sibling project.
- No monetization, multi-tenancy, or user-management concerns — it's single-user-per-browser, bring-your-own-API-key, and stateless on the server side aside from the LangChain/Groq/LangSmith calls.
