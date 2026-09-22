# Module 01 — Foundations (React Frontend)

Interactive learning platform for Module 01 of the Practical AI/ML Engineering course. Mirrors the content of `module-01-foundations/01_guided_lab.ipynb` as a structured, browser-based experience.

## Setup Instructions

1. Ensure Node.js 18+ is installed on your machine.
2. Navigate to this directory:
   ```bash
   cd module-01-react-frontend
   ```
3. Copy the environment example file and fill in your backend URL:
   ```bash
   cp .env.example .env
   ```
4. Install dependencies:
   ```bash
   npm install
   ```
5. Start the backend (in a separate terminal, from `module-01-react-frontend/backend/`):
   ```bash
   uvicorn main:app --reload
   ```
6. Start the frontend development server:
   ```bash
   npm run dev
   ```
7. Open your browser at `http://localhost:5173`.

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `VITE_API_BASE_URL` | Base URL of the FastAPI backend service | `http://localhost:8000` |

Copy `.env.example` to `.env` and set `VITE_API_BASE_URL` to the URL where your backend is running. The default value (`http://localhost:8000`) works when running the backend locally with default settings.

## Development Server

Start the Vite development server with:

```bash
npm run dev
```

The server listens on `http://localhost:5173` by default. Hot module replacement (HMR) is enabled — changes to source files are reflected in the browser immediately without a full page reload.

Other available scripts:

```bash
npm run build   # Type-check and build for production (output in dist/)
npm run lint    # Run ESLint across all TypeScript/TSX files
npm test        # Run the Vitest test suite
```
