# Tech

The repo has two distinct technical surfaces: **Python notebooks/labs** (the course content) and the **React + FastAPI learning platform** (`module-01-react-frontend`).

## Course labs (Python / Jupyter)

- **Python 3** with **Jupyter notebooks** (`.ipynb`) as the primary lab format.
- **LangChain 1.x / LangChain-core** + **LangGraph** — LLM orchestration and agent graphs.
- **langchain-groq** — Groq is the model provider throughout.
- **LangSmith** — tracing and evaluation (red-team eval checkpoints, scoring gates).
- **presidio-analyzer / presidio-anonymizer** — PII detection and masking (guardrails module).
- **python-dotenv** — each kit loads its own `.env` (copy from `.env.example`).
- **pytest** (+ **hypothesis** for property-based tests where present) — lab test suites.

Dependencies live in per-kit `requirements.txt`. Some notebooks generate source files (e.g. `security_utils/detectors.py`) only when their `%%writefile` cells are run — treat missing generated files as expected, not broken.

### Common lab commands
```bash
pip install -r requirements.txt   # per kit
pytest tests/ -v                  # unit tests (integration tests need a real Groq key)
```

## Learning platform — Frontend (`module-01-react-frontend`)

- **React 18.3** + **TypeScript 5.5** (strict mode; `noUnusedLocals`/`noUnusedParameters`), built with **Vite 5.4**.
- **react-router-dom 6** for routing.
- **Tailwind CSS 3.4** + PostCSS + Autoprefixer, using the **shadcn/ui pattern**: CSS-variable HSL tokens in `src/index.css`, `cn()` helper (`clsx` + `tailwind-merge` + `class-variance-authority`) in `src/lib/utils.ts`, hand-owned primitives in `src/components/ui/`. Icons via `lucide-react`.
- **@monaco-editor/react** — embedded code editor for exercise cells (display/edit only; code is never executed in-app).
- **axios** — HTTP client; API keys injected from `localStorage` via a request interceptor.
- **State:** no state library. Local component state + custom hooks (`useApiKeys`, `useProgress`, etc.) backed by `localStorage`.
- **Testing:** **Vitest** + `@testing-library/react` + `jsdom`, with **fast-check** for property-based tests. Config is inline in `vite.config.ts`.
- **Path alias:** `@` → `./src`.

### Frontend commands (run from `module-01-react-frontend/`)
```bash
npm install
npm run dev      # Vite dev server on http://localhost:5173 (run manually, not via agent)
npm run build    # tsc + vite build -> dist/
npm run lint     # ESLint over .ts/.tsx, --max-warnings 0
npm test         # vitest run
```

## Learning platform — Backend (`module-01-react-frontend/backend`)

- **FastAPI** on **Uvicorn** (ASGI), default port **8000**; models defined inline with **Pydantic 2**.
- **LangChain + langchain-groq + LangSmith** for LLM calls and eval-result retrieval.
- **httpx** async client; **pytest + hypothesis** for tests (`backend/tests/`).
- **No database, no Docker, no code sandbox.** State is stateless-per-request; the only "persistence" is `localStorage` (frontend) and the external LangSmith SaaS.
- **Auth:** no user auth. Bring-your-own-key — 4 keys sent as headers (`X-Groq-Api-Key`, `X-Langchain-Api-Key`, `X-Langchain-Tracing-V2`, `X-Langchain-Project`); `resolve_keys()` prefers headers, falls back to env, temporarily patches `os.environ` around SDK calls, then restores.
- **CORS** allows `http://localhost:5173` by default (extend via `ALLOWED_ORIGINS`).

### Backend commands (run from `module-01-react-frontend/backend/`)
```bash
pip install -r requirements.txt
uvicorn main:app --reload   # run manually in its own terminal
pytest tests/ -v
```

## Environment / constraints to remember

- **External SaaS dependencies:** most model steps require a valid `GROQ_API_KEY`; eval steps require `LANGCHAIN_API_KEY` + a LangSmith project. The app degrades to error states without them.
- **Sibling-project dependency:** `backend/main.py` adds `../module-01-foundations` (outside this repo) to `sys.path`. The backend cannot run without that sibling checked out alongside it.
- **Env vars:** frontend needs `VITE_API_BASE_URL`; backend needs `GROQ_API_KEY`, `LANGCHAIN_API_KEY`, `LANGCHAIN_TRACING_V2`, `LANGCHAIN_PROJECT`, plus optional `ALLOWED_ORIGINS` and `STRICT_ENV`.
- **Never commit secrets.** `.env` files exist in several kits — use `.env.example` as the template and keep real keys out of git.
- On Windows (`cmd`), chain commands with `&` (not `&&`); do not launch dev servers or watchers through the agent — recommend the user run them manually.
