# Structure

## Overview

Two-part project living in one repo:

- **Frontend** (`src/`) — React 18 + TypeScript SPA, built with Vite.
- **Backend** (`backend/`) — Python FastAPI service, single-file app (`main.py`), imports a *sibling* project (`../module-01-foundations`, outside this repo) for the actual LangChain lab logic.

No database. No global auth. The backend is a thin API wrapper around a Jupyter-notebook-based course project. There is no in-app code execution — students run exercise code in their own local Python environment and self-report completion in the UI.

## Root layout

```
module-01-react-frontend/
  src/                 React app
  backend/             FastAPI service
  dist/                build output (checked in from a prior `npm run build`)
  index.html           Vite entry HTML
  vite.config.ts       dev server, path alias, vitest config
  tsconfig.json        strict TS, path alias @/* -> ./src/*
  tailwind.config.ts   shadcn/ui-style token theme
  postcss.config.js
  eslint.config.js / .eslintrc.cjs
  .env.example         VITE_API_BASE_URL
  README.md
```

## `src/` (frontend)

```
src/
  main.tsx             ReactDOM root, <StrictMode><App /></StrictMode>, no other providers
  App.tsx              react-router-dom v6 routes
  index.css            Tailwind directives + shadcn CSS-variable color tokens

  api/
    client.ts           axios instances (chainClient, dataClient), all backend calls, error normalisation

  types/
    api.ts               request/response TS interfaces mirroring backend Pydantic models

  hooks/
    useApiKeys.ts        student API keys, persisted to localStorage
    useApiStatus.ts      polls GET /api/status for the "API: Connected" badge
    useProgress.ts       step-completion state, persisted to localStorage
    useScreenCaptureGuard.ts  blurs page content on window blur/tab-hide, flags PrintScreen keyup — deterrent only, not a guarantee
    useChecklist.ts
    useClassify.ts
    useChainInvoke.ts
    useStepInvoke.ts
    useEvalResults.ts

  lib/
    utils.ts             cn() helper (clsx + tailwind-merge), standard shadcn pattern
    securityBanner.ts    showSecurityBanner(message) — dispatches a window CustomEvent SecurityBanner.tsx listens for

  components/
    AppShell.tsx         layout: header, connection badge, progress bar, step nav (locks future steps)
    NavBar.tsx
    PageHeader.tsx
    NotebookPage.tsx
    MarkdownCell.tsx
    CodeCell.tsx          Monaco-based code cell (uses @monaco-editor/react); copy/cut/paste/drop blocked at the keydown level (students must type); "Mark as done" self-attest button, no in-app execution
    SecurityBanner.tsx    global top-of-screen banner, shown via lib/securityBanner.ts's showSecurityBanner() (copy/paste blocked, screenshot guard)
    ConceptCheck.tsx
    ExercisePanel.tsx
    RemediationPanel.tsx
    ui/                   shadcn/ui-style local primitives
      badge.tsx button.tsx card.tsx progress.tsx separator.tsx skeleton.tsx

  pages/
    Step1EnvSetup.tsx    routed: /step/1
    Step2Groq.tsx        routed: /step/2
    Step3Prompts.tsx     routed: /step/3
    Step4Chains.tsx      routed: /step/4
    Step5Routing.tsx     routed: /step/5
    Step6Eval.tsx        routed: /step/6
    EvalDashboard.tsx    NOT routed in App.tsx — has tests, unused/legacy
    LabViewer.tsx        NOT routed in App.tsx — has tests, unused/legacy
    Playground.tsx       NOT routed in App.tsx — has tests, unused/legacy
    QueryRouter.tsx       NOT routed in App.tsx — has tests, unused/legacy

  __tests__/
    setup.ts             vitest/jsdom setup
    App.test.tsx, api.client.test.ts, useProgress.test.ts, package-json.test.ts
    CodeCell.test.tsx           copy/cut/paste/drop blocking + "Mark as done" self-attest behavior
    SecurityBanner.test.tsx     global banner show/hide/replace behavior
    useScreenCaptureGuard.test.ts  blur/focus/visibility/PrintScreen behavior
    Step2Groq.test.tsx, Step5Routing.test.tsx, Step6Eval.test.tsx
    EvalDashboard.test.tsx, LabViewer.test.tsx, Playground.test.tsx, QueryRouter.test.tsx
```

No `store/`, no `assets/`, no dedicated `styles/` folder. No Redux/Zustand/Context providers — state is local component state plus the custom hooks above, backed by `localStorage`.

### Routing (`App.tsx`)

Single layout route `/` → `<AppShell>`, nested children:
- `index` → redirect to `/step/1`
- `/step/1` .. `/step/6` → the six Step pages

`AppShell` sequentially locks steps: a step is locked if `stepIndex > highestCompleted + 1`; locked steps render disabled and `alert()` instead of navigating.

## `backend/` (Python/FastAPI)

```
backend/
  main.py             FastAPI app: routes, CORS, Pydantic models, key resolution, lifespan env check — all inline, no controllers/models/routes split
  requirements.txt
  .env / .env.example
  tests/
    test_unit.py test_properties.py test_structure.py
```

No in-app code execution: there is no sandbox, no Docker dependency, and no `/api/execute` route. Students run exercise code in their own local Python environment and self-report completion via a "Mark as done" button in the UI — the backend only ever handles the interactive LLM/chain/routing/eval calls listed below.

No `controllers/`, `models/`, `routes/`, `middleware/`, `config/`, or `db/` — everything is in `main.py`.

**Endpoints** (all under `/api`):
| Route | Purpose |
|---|---|
| GET `/api/status` | connection/model status for the frontend badge |
| POST `/api/steps/1/check-env` | validates required env vars |
| POST `/api/steps/2/invoke` | calls Groq via `langchain-groq` |
| POST `/api/steps/3/prompt` | runs a named prompting technique (zero_shot, few_shot, cot, role, json_output, multi_step) |
| POST `/api/steps/4/chain` | invokes a LangChain chain (imported from `../module-01-foundations`) |
| POST `/api/steps/5/route` | query classification/routing (imported from `../module-01-foundations`) |
| GET `/api/steps/6/eval` | pulls eval results from LangSmith |
| GET `/api/health` | liveness |
| POST `/api/chain/invoke`, POST `/api/classify`, GET `/api/eval/results` | legacy aliases delegating to the step-numbered routes above |

**Critical external dependency:** `main.py` inserts `../module-01-foundations` (a sibling directory *outside this repo*) onto `sys.path` to import `chains`, `classify_query`, `routing_chain`, etc. This backend cannot run standalone without that sibling project present on disk.

## Build artifacts

`dist/` contains a prior production build (`index.html`, hashed JS/CSS bundles) — not source, just build output checked into the tree.
