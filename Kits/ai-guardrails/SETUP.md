# Setup

## 1. Requirements

- Python 3.11 or newer
- A [Groq](https://console.groq.com) account and API key (free tier is fine)
- A [LangSmith](https://smith.langchain.com) account and API key (free tier is fine)
- Jupyter (Lab or Notebook) or an editor with notebook support (VS Code, etc.)

## 2. Create a virtual environment and install dependencies

```bash
cd prompt-injection-lab
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate

pip install -r requirements.txt
pip install jupyterlab ipykernel    # if you don't already have a Jupyter setup
```

## 3. Configure your `.env`

```bash
cp .env.example .env
```

Open `.env` and fill in:

- `GROQ_API_KEY` — from the [Groq console](https://console.groq.com/keys)
- `LANGSMITH_API_KEY` — from your [LangSmith settings page](https://smith.langchain.com)

Leave the other values at their defaults unless you have a reason to change
them.

### A note on `GROQ_MODEL`

Groq retires model IDs periodically. As of this lab's writing, the default
(`openai/gpt-oss-20b`) and the suggested alternative (`openai/gpt-oss-120b`)
are both current and fast. If you ever get a 404 or "model decommissioned"
error from Groq, check
[console.groq.com/docs/models](https://console.groq.com/docs/models) for the
current list and update `GROQ_MODEL` in your `.env` — no code changes needed,
since the notebook reads the model name from configuration rather than
hardcoding it.

## 4. Run the notebook

```bash
jupyter lab
```

Open `01_prompt_injection_defence.ipynb` and run the cells **top to bottom,
in order**. Several cells use `%%writefile` to generate
`security_utils/detectors.py`, `prompts.py`, and `callbacks.py` — these
files do not exist until those cells run, and later cells (and the pytest
suite) depend on them.

The notebook makes real calls to Groq (roughly 50-70 across the full run, on
the cheap default model) and, if `LANGSMITH_TRACING=true`, sends traces to
your LangSmith project. Both are inexpensive on free tiers, but if you're
re-running cells repeatedly while debugging, consider lowering how many
sections you re-run rather than restarting from the top every time.

## 5. Run the tests

From the project root, with your virtual environment active:

```bash
pytest tests/ -v
```

This runs the **unit tests** — pure-Python checks against the detector,
prompt, and callback modules you just generated, using a fake/offline chat
model. No network access required, runs in well under a second. These will
fail with a clear skip message if you haven't run the notebook yet.

To also run the **integration tests** (real Groq calls through the full
hardened pipeline, asserting the same ASR/FPR thresholds as the notebook):

```bash
pytest tests/ -v -m integration
```

These need your `.env` configured and will make real API calls.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `RuntimeError: GROQ_API_KEY is not set` | You haven't created `.env`, or it's missing the key. Re-check step 3. |
| `ImportError: cannot import name 'X' from 'security_utils.detectors'` | You're running a notebook cell (or pytest) before an earlier `%%writefile` cell has run. Re-run the notebook from the top. |
| Groq returns a 404 / model decommissioned error | See the `GROQ_MODEL` note above — update `.env`, no code changes needed. |
| `pytest tests/ -v` collects 0 items and skips with a message about a missing module | Expected if you haven't run the notebook yet — that's the modules the tests check. |
| LangSmith dataset creation cell errors with an auth error | Double-check `LANGSMITH_API_KEY` in `.env`, and that `LANGSMITH_TRACING=true`. |
