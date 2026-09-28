# Running DiffSage — FastAPI Deployment module

Kestrel Software / DiffSage: an AI pull-request review agent, wrapped in
FastAPI, deployed locally with Uvicorn. This is the run guide; the notebook
(`fastapi_deployment_diffsage.ipynb`) is the teaching content.

## 1. Prerequisites

- Windows with Anaconda, VS Code + Jupyter extension (or Jupyter directly)
- Python 3.10+
- No API keys required — everything below runs fully offline

## 2. (Optional) live mode

Only needed if you want real Groq / Tavily / LangSmith instead of the
offline doubles. Create a `.env` file in this folder:

```
GROQ_API_KEY=
GROQ_MODEL=openai/gpt-oss-20b
TAVILY_API_KEY=
LANGSMITH_TRACING=true
LANGSMITH_API_KEY=
LANGSMITH_PROJECT=diffsage
```

Leave any of these blank (or omit the file entirely) and that piece runs
offline automatically — `/health` reports which mode each service is in.

## 3. Run the notebook

Open `fastapi_deployment_diffsage.ipynb` in Jupyter and run all cells top to
bottom.

This does two things: it teaches each piece (the chat model double, style
guide retrieval, the connection pool and the bug it hides, the LangGraph
checkpointer, the agent itself), and — partway through — it writes a
standalone **`main.py`** into this same folder via `%%writefile`. The last
few cells start that app in a background thread inside the notebook and hit
it with real `curl`, so you see the exact request/response shapes before
ever leaving Jupyter.

If step 5 below is all you want, you can stop after the `%%writefile main.py`
cell runs — you don't need to run the later in-notebook server demo cells
first.

## 4. Install dependencies (if running outside the notebook)

```
pip install fastapi "uvicorn[standard]" langgraph langgraph-checkpoint-sqlite aiosqlite chromadb langchain-core langchain-groq tavily-python python-dotenv
```

On a system Python install (not Anaconda) you may see an
`externally-managed-environment` error — add `--break-system-packages` to
the command above. This does not apply to a normal Anaconda environment.

## 5. Run the server

From an Anaconda Prompt, in this folder:

```
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

You should see:

```
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Application startup complete.
```

`Ctrl+C` stops it. `--reload` restarts the server automatically when you
edit `main.py`.

## 6. Try it — curl commands

These are exactly what the notebook runs, so you can compare output
directly. On Windows 10+, `curl.exe` is built in — these work as-is from
Anaconda Prompt. If you're in PowerShell, replace the trailing `\` with a
backtick `` ` ``; if you're in plain `cmd.exe`, paste each command as one
line instead (`cmd` doesn't support line continuation the same way).

**Health check** — also reports which services are live vs. offline:

```
curl http://127.0.0.1:8000/health
```

**`POST /invoke`** — blocking, full JSON back:

```
curl -X POST http://127.0.0.1:8000/invoke ^
  -H "Content-Type: application/json" ^
  -d "{\"repo\": \"kestrel/billing-service\", \"pr_number\": 214, \"branch\": \"feat/stripe-webhook-retry\", \"files_changed\": [\"billing/webhook.py\", \"requirements.txt\"], \"diff\": \"diff --git a/requirements.txt b/requirements.txt\\n+requests==2.25.0\"}"
```

**`POST /stream`** — same payload, Server-Sent Events back (`-N` disables
curl's output buffering so you see tokens as they arrive):

```
curl -N -X POST http://127.0.0.1:8000/stream ^
  -H "Content-Type: application/json" ^
  -d "{\"repo\": \"kestrel/billing-service\", \"pr_number\": 214, \"branch\": \"feat/stripe-webhook-retry\", \"files_changed\": [\"billing/webhook.py\", \"requirements.txt\"], \"diff\": \"diff --git a/requirements.txt b/requirements.txt\\n+requests==2.25.0\"}"
```

Note the `^` line continuation and escaped `\"` quotes — that's `cmd.exe`
syntax, since Windows JSON-in-curl needs its quotes escaped differently than
bash. If you're in Git Bash or WSL, use the single-quoted style from the
notebook instead (trailing `\`, unescaped `"` inside `'...'`).

## 7. What gets created

Running the server creates two SQLite files in this folder:

- `reviews.db` — application data: review records and comments (this is the
  pooled, `aiosqlite`-backed connection story)
- `checkpoints.db` — LangGraph's own state, keyed by thread id
  (`repo:pr_number`). Delete it to reset all agent memory; delete
  `reviews.db` to reset review history. They're independent of each other.

## 8. Troubleshooting

- **Port already in use** — a previous server didn't shut down cleanly.
  Change `--port` or find and stop the old process
  (`netstat -ano | findstr :8000`, then `taskkill /PID <pid> /F`).
- **`ModuleNotFoundError`** — you're likely in a different environment than
  the one you ran `pip install` in. Confirm with `where python` /
  `where uvicorn`.
- **`/invoke` is slow the first time** — `chromadb`'s import (not the
  request itself) is the cost; it's paid once per process, not once per
  request.
