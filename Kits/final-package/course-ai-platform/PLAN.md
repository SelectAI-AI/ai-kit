# PLAN — Course AI Platform

This is the source design doc (progressive unlocking + verified certification) built
against your actual `final-package` folder: 7 modules, 39 notebooks. It's scoped as a
**working local MVP**, not the enterprise version of the original doc — see
"What's simplified" below for the specific trade-offs and how to remove them later.

## Architecture

```
 Browser (React, Vite dev server :5173)
   │  JWT in Authorization header
   ▼
 FastAPI backend (:8000)
   ├─ auth        — register / login / me            (JWT + bcrypt)
   ├─ modules     — list / detail / unlock / view / download / package-zip
   ├─ progress    — per-user completion, cert eligibility
   ├─ certificates— request / approve / revoke / PUBLIC verify
   └─ instructor  — student roster, pending approvals
        │
        ├─ SQLite (platform.db) — users, progress, certificate records
        └─ content_scanner.py — reads your REAL folder on disk, live, every request:
             final-package/<module>/README.md | FLOW_GUIDE.md | RUN.md | setup.md
             final-package/<module>/*.ipynb
             final-package/<module>/course_config.json   (optional — order/titles/quizzes)
```

Nothing about your notebooks is copied into a database. The backend just reads your
`CONTENT_ROOT` folder on every request, the same way a file server would — so editing a
notebook or dropping in a new one shows up immediately, no re-import step.

## How unlocking works (maps to the doc's "README-Driven Unlocking")

The source doc's core idea — README lists tasks, submitting answers unlocks the next
notebook — is implemented as: **each module folder can have a `course_config.json`**
that defines notebook order, titles, and an unlock question per notebook. Three question
types, set per-notebook:

| `question_type` | What the student does | When to use it |
|---|---|---|
| `reflection` (default) | Free-text, ≥15 characters | You haven't written real quiz content yet — this is what ships for all 39 of your notebooks right now |
| `quiz` | Must match an exact `answer` string (case-insensitive) | Once you've written real questions from your actual README content |
| `self_attest` | Just a checkbox | Low-stakes notebooks where a reflection is overkill |

**Important honesty note:** I can only see your folder/file *names* from the directory
listing you pasted — I never read the actual content of your READMEs or notebooks. So
every notebook currently defaults to a generic reflection prompt, not a real quiz. The
`content-config-templates/` folder (see README.md) has a `course_config.json` per module
with my best-guess *ordering* from filenames — you should skim and reorder/retitle where
I guessed wrong, and swap in real `quiz` questions once you've reviewed your own content.

The first notebook in each module unlocks automatically; completing notebook *N* unlocks
notebook *N+1*. Order lives in `course_config.json`; if that file is absent, it falls
back to alphabetical.

## Certificates & identity verification

The source doc specs Persona/ID.me government-ID verification (~$1–5/check, needs a
business KYC account). That's real infrastructure for a paid credentialing product — not
something to wire up sight-unseen for what's currently a personal/team learning tool. So:

- **Shipped now:** self-attestation (checkbox + typed legal name) + optional instructor
  manual approval before the PDF is issued. Controlled by `REQUIRE_INSTRUCTOR_APPROVAL`
  in `backend/.env` (defaults `true`).
- **Extension point:** swap the `confirm_identity` check in
  `backend/app/routers/certificates.py` for a real call to Persona/ID.me/Veriff's API
  once you have an account — the certificate generation, QR code, and public verify
  endpoint (`/api/certificates/verify/{id}`) don't need to change at all.

Certificates are a landscape PDF (reportlab) with a QR code that points at
`{FRONTEND_BASE_URL}/verify/{cert_id}` — scanning it hits the public, unauthenticated
verify endpoint and shows valid / pending / revoked, matching the doc's live-check design.

## What's simplified vs. the source doc (and how to undo each one)

| Doc's design | This build | To upgrade |
|---|---|---|
| JupyterHub, Kubernetes, multi-tenant notebook servers | FastAPI reads `.ipynb` files directly, renders via `nbconvert` (no execution) | Only worth it once you have real concurrent multi-user load — not needed for personal/team use |
| Persona / ID.me / Veriff | Self-attestation + instructor approval | Add the provider's SDK call in `certificates.py`, see above |
| Postgres/MySQL + Redis | SQLite | Swap `DATABASE_URL` in `.env`; SQLAlchemy models don't change |
| Blockchain-backed audit trail | Plain DB rows (`status`, `revoked_reason`) | Add an append-only log table if you need tamper-evidence |
| Plagiarism detection / proctoring | Not implemented | Out of scope for a self-study tool; revisit if this becomes multi-student/graded |

## Security notes (worth knowing before you expose this beyond localhost)

- JWTs are stored in `localStorage` on the frontend — fine for local/personal use;
  for anything internet-facing, prefer httpOnly cookies to reduce XSS exposure.
- Notebook previews render via `dangerouslySetInnerHTML` (nbconvert's HTML output). Since
  the content is your own notebooks on your own machine, that's a reasonable trade-off
  locally — but don't point `CONTENT_ROOT` at a folder that ingests notebooks from
  untrusted third parties without adding HTML sanitization first.
- `.env` files inside your module folders are always excluded from downloads/zips
  (checked explicitly in `download-package`) — but double check none of your *notebook
  cells* have hardcoded API keys before unlocking this to anyone but yourself.
- `SECRET_KEY` and `INSTRUCTOR_SIGNUP_CODE` in `backend/.env` are dev defaults — change
  both before sharing this with anyone else.

## Suggested next steps, roughly in order

1. Run it locally against your real `final-package` folder (see README.md).
2. Skim the auto-generated `course_config.json` per module, fix ordering/titles, and
   promote a few notebooks per module from `reflection` to real `quiz` questions.
3. If this is heading toward being shared with others (teammates, a hackathon demo,
   etc.), change `SECRET_KEY`/`INSTRUCTOR_SIGNUP_CODE`, and decide whether you actually
   need real identity verification or whether self-attestation is enough for the audience.
4. If you outgrow SQLite/localhost, containerize (Dockerfile per service) and move to
   Postgres — the code doesn't need structural changes for that.
