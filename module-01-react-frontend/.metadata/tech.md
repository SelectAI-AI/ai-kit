# Tech

## Frontend stack

- **React 18.3.1** + **TypeScript 5.5.3**, built with **Vite 5.4.2** (`@vitejs/plugin-react`).
- **react-router-dom 6.26.2** — client-side routing (`BrowserRouter`/`Routes`/`Route`, nested layout route).
- **Tailwind CSS 3.4.10** + `postcss` + `autoprefixer`, using the **shadcn/ui** pattern:
  - CSS-variable-driven HSL color tokens (`--background`, `--primary`, `--card`, etc.) defined in `src/index.css`, consumed by `tailwind.config.ts` theme.
  - `class-variance-authority` + `clsx` + `tailwind-merge` combined into a `cn()` helper (`src/lib/utils.ts`).
  - Local, hand-owned UI primitives in `src/components/ui/` (button, card, badge, progress, separator, skeleton) rather than a pulled-in component library.
  - `tailwindcss-animate` for animation utilities; `lucide-react` for icons.
- **`@monaco-editor/react` 4.6.0** — embeds the Monaco code editor for in-browser code cells (`CodeCell.tsx`, notebook/lab pages). Code is never executed in-app; students run it locally and self-report completion.
- **Copy/paste blocking on code cells**: this Monaco build uses the newer **EditContext** input model (`.native-edit-context`, not a classic hidden `<textarea>`), which reads/writes the clipboard directly on `keydown` and never dispatches native `copy`/`cut`/`paste` DOM events. The actual fix is a capturing `keydown` listener on the editor's DOM node that intercepts Ctrl/Cmd+V/C/X and Shift+Insert before Monaco's own handler runs (`CodeCell.tsx`'s `handleEditorMount`); Monaco action overrides and native clipboard-event listeners are kept too, as defense in depth for other input models/browsers. Confirmed against a real Chrome browser, not just mocked tests.
- **Global "blocked" banner**: `src/lib/securityBanner.ts` exposes `showSecurityBanner(message)`, which dispatches a `window` `CustomEvent`; `SecurityBanner.tsx` (mounted once in `AppShell.tsx`) listens for it and slides a message in at the top of the screen for ~2.8s. Used for copy/paste-blocked and screenshot-guard events.
- **Screenshot/recording deterrent (`useScreenCaptureGuard.ts`)**: blurs the app content (`filter: blur`) on `window` `blur` / `document.visibilitychange`, un-blurs on focus, and shows a banner on a `PrintScreen` keyup. This is a deterrent only — OS-level tools (Windows Snipping Tool, Win+Shift+S) don't reliably fire a `blur` event, and nothing here can stop a phone camera.
- **axios 1.7.7** — HTTP client, two configured instances (`chainClient` with a 30s timeout for POST step endpoints, `dataClient` for GETs), with a request interceptor injecting API-key headers from `localStorage`.
- **Radix primitives** (`@radix-ui/react-progress`, `@radix-ui/react-separator`) underlying the local `ui/` wrappers.
- **State management:** no library. Local component state + custom hooks (`useApiKeys`, `useProgress`, `useApiStatus`, etc.) backed by `localStorage`. No Redux/Zustand/Context providers anywhere.
- **Testing:** Vitest 2.0.5 + `@testing-library/react` 16 + `@testing-library/jest-dom` + `@testing-library/user-event`, `jsdom` environment, `fast-check` for property-based tests. Config lives inline in `vite.config.ts` (`test.environment: 'jsdom'`, `setupFiles: ['./src/__tests__/setup.ts']`).
- **Linting:** ESLint 9.9.1 with `@typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`; run via `npm run lint` (`--max-warnings 0`).
- **Path alias:** `@` → `./src` (both `tsconfig.json` and `vite.config.ts`).
- **TypeScript config:** target ES2020, `strict: true`, `noUnusedLocals`/`noUnusedParameters` enforced, JSX `react-jsx`.

### npm scripts
- `npm run dev` — Vite dev server (port 5173 per README)
- `npm run build` — `tsc && vite build`
- `npm run lint` — ESLint over `.ts`/`.tsx`
- `npm test` — `vitest run`

## Backend stack

- **Python**, **FastAPI 0.115.0** on **Uvicorn 0.31.0** (ASGI), default port 8000.
- **Pydantic 2.11.4** — request/response models, defined inline in `main.py`.
- **LangChain** stack: `langchain 0.3.25`, `langchain-core 0.3.59`, `langchain-groq 0.3.2` — LLM orchestration, Groq as the model provider.
- **LangSmith 0.3.45** — used both for tracing (`LANGCHAIN_TRACING_V2`) and for pulling eval results (`langsmith.Client`) in the Step 6 endpoint.
- **python-dotenv 1.1.0** — loads `backend/.env`.
- **httpx 0.27.2** — present as a dependency (async HTTP client, used by FastAPI/langchain stack).
- **pytest 8.3.5** + **hypothesis 6.131.15** — backend test suite (`backend/tests/`), including property-based tests.
- **No code execution / no Docker**: there is no sandbox and no `docker` Python SDK dependency. Students run exercise code in their own local Python environment (see `module-01-foundations`) and self-report completion in the UI — the backend never executes student-submitted code.
- **No database** — no ORM, no SQL/NoSQL driver anywhere in `requirements.txt`. All persistent-looking data (eval results) actually comes from the external LangSmith SaaS service; everything else is stateless per-request.

### Middleware / cross-cutting concerns

- **CORS** (`fastapi.middleware.cors.CORSMiddleware`): allows `http://localhost:5173` by default, extendable via comma-separated `ALLOWED_ORIGINS` env var; `allow_credentials=True`; all methods; explicit allow-headers for the custom API-key headers plus `"*"`.
- **Startup validation**: FastAPI lifespan hook checks `GROQ_API_KEY`, `LANGCHAIN_API_KEY`, `LANGCHAIN_TRACING_V2`, `LANGCHAIN_PROJECT` are set when `STRICT_ENV=true`, else exits the process.
- **Auth model**: no user auth. "Bring your own API key" — frontend stores 4 keys in `localStorage`, sends them as headers (`X-Groq-Api-Key`, `X-Langchain-Api-Key`, `X-Langchain-Tracing-V2`, `X-Langchain-Project`) on every request; backend's `resolve_keys()` prefers header values, falls back to server env vars, temporarily patches `os.environ` for the duration of the LangChain/Groq/LangSmith SDK calls, then restores it.

## Key architectural/technical constraints

1. **Hard external dependency**: `backend/main.py` inserts a sibling directory `../module-01-foundations` (outside this git repo) onto `sys.path` to import `chains.py` functions and `classify_query`/`routing_chain`. The backend cannot function without that sibling project checked out alongside this one.
2. **No in-app code execution**: exercise code in `CodeCell.tsx` is never sent to the backend or run anywhere in this app. Students install their own local Python environment (matching `module-01-foundations`'s `requirements.txt`) and run/verify the code themselves, then click "Mark as done" — a client-side self-attestation with no server-side validation.
3. **Groq + LangSmith as external SaaS dependencies**: model calls (Step 2+) require a valid `GROQ_API_KEY`; eval results (Step 6) require a valid `LANGCHAIN_API_KEY`/LangSmith project — the app degrades to error states without these.
4. **No persistence layer** beyond `localStorage` (frontend) and LangSmith (external) — restarting the backend loses no state because it holds none.
5. **Env var surface is small and explicit**: frontend only needs `VITE_API_BASE_URL`; backend needs `GROQ_API_KEY`, `LANGCHAIN_API_KEY`, `LANGCHAIN_TRACING_V2`, `LANGCHAIN_PROJECT`, plus optional `ALLOWED_ORIGINS` and `STRICT_ENV`.
