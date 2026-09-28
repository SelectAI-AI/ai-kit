# Course AI Platform

React + FastAPI app that turns your `final-package` course folder into a self-paced
platform with progressive notebook unlocking and a verified completion certificate.
See `PLAN.md` for the architecture and the decisions behind it.

## Prerequisites

- Python 3.10+
- Node.js 18+ and npm (you're already set up)

## 1. Backend setup

Open PowerShell in the `backend/` folder:

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Edit `backend/.env` — it already has every setting, you mainly just need to confirm
`CONTENT_ROOT` points at your real folder:

```
CONTENT_ROOT=D:\personal_docs\course-ai\module-1\final-package
```

Then start the API:

```powershell
uvicorn app.main:app --reload --port 8000
```

Open **http://localhost:8000/docs** — that's FastAPI's interactive Swagger UI, useful
for poking at endpoints directly and a quick way to confirm the backend is healthy
without the frontend at all.

## 2. Frontend setup

In a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**.

## 3. First run walkthrough

1. **Register an instructor account** at `/register` — for the "Instructor code" field,
   use the value of `INSTRUCTOR_SIGNUP_CODE` in `backend/.env` (`letmein-instructor` by
   default). Change that value before giving this to anyone else.
2. **Register a normal student account** (leave the instructor code blank) — or just use
   your instructor account to click through as a student too, roles don't block browsing.
3. On the dashboard, your 7 modules show up automatically, discovered live from
   `CONTENT_ROOT`. Open one — the first notebook is unlocked, the rest are locked.
4. Submit the reflection prompt on notebook 1 to unlock notebook 2, and so on.
5. Once every module hits 100%, go to **Certificate** to request one. If
   `REQUIRE_INSTRUCTOR_APPROVAL=true` (the default), sign in as the instructor account,
   go to **Instructor**, and approve it — that generates the PDF.
6. Download the PDF from the Certificates page, and try the QR code — it opens
   `/verify/:certId`, a public page anyone can hit without logging in.

## Customizing modules (order, titles, real quiz questions)

Every notebook defaults to a generic "describe what you learned" prompt, because I only
ever saw your file*names*, not the content of your READMEs or notebooks. Drop a
`course_config.json` into any module folder to override order, titles, and unlock
questions — see `content-config-templates/` in this package for a pre-filled starting
point per module (best-guess ordering from filenames; check it against what you actually
built before trusting it).

```json
{
  "title": "AI Guardrails",
  "intro_file": "README.md",
  "notebooks": [
    {
      "file": "01_prompt_injection_defence.ipynb",
      "title": "Prompt Injection Defence",
      "question_type": "quiz",
      "prompt": "What header value did we check to catch the injected system prompt?",
      "answer": "x-forwarded-for"
    }
  ]
}
```

Copy the relevant `content-config-templates/<module>/course_config.json` into
`D:\personal_docs\course-ai\module-1\final-package\<module>\course_config.json` — no
restart needed, it's read fresh on every request.

## Troubleshooting

- **Dashboard shows "No modules found"** — `CONTENT_ROOT` in `backend/.env` doesn't
  point at a real folder, or the path has a typo. Restart uvicorn after editing `.env`.
- **CORS error in the browser console** — frontend isn't running on port 5173, or
  `CORS_ORIGINS` in `backend/.env` doesn't match the port you're actually using.
- **"Instructor access required"** — you registered without the instructor code, or
  typed it wrong. Re-register with the exact value from `INSTRUCTOR_SIGNUP_CODE`.
- **Notebook preview looks unstyled/broken** — that's `nbconvert`'s own HTML/CSS for the
  notebook, rendered in a white pane by design (readability over matching the dark
  theme) — not a bug.
