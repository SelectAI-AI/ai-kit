# Deploying course-ai-platform

This platform runs as two containers orchestrated by Docker Compose:

- **backend** — FastAPI/uvicorn on port `8000`
- **frontend** — nginx on port `80`, which proxies `/api` to the backend

All backend configuration (including secrets) is supplied at **runtime** through a
single file: `backend/.env`. It is deliberately kept out of git (`.gitignore`) and
out of the Docker image (`.dockerignore`), so it must be placed on the server by hand.

---

## 1. Where the configuration goes

The backend reads its config from an env file at this exact path, relative to the
compose project directory:

```
<project>/backend/.env
```

On a typical server that is:

```
/opt/course-ai-platform/backend/.env
```

`docker-compose.yml` loads it via `env_file: ./backend/.env`. The file is **not**
baked into the image and is **not** in the repository — the person running the
deployment receives the `.env` contents separately and creates this file on the
server.

> The `CONTENT_ROOT` and `DATABASE_URL` values are overridden inside the container
> by `docker-compose.yml` (`/content` and `/app/data/platform.db`). You do not need
> to set those for the containerized deployment — leave whatever is in the shared
> `.env`; compose takes precedence for those two keys.

### Create the file on the server

```bash
mkdir -p /opt/course-ai-platform/backend
# paste the shared .env contents into this file:
nano /opt/course-ai-platform/backend/.env
# lock it down so only the deploy user can read the secrets:
chmod 600 /opt/course-ai-platform/backend/.env
```

Handle the shared `.env` contents over a secure channel (password manager / secrets
vault), never plaintext email or chat. Do not commit this file to git.

---

## 2. Required values before going public

The shared `.env` ships with dev defaults. The following **must** be set to real
values before exposing the platform beyond localhost:

| Key | Why it matters |
| --- | --- |
| `SECRET_KEY` | Signs JWTs. Generate a fresh 64-char random value: `openssl rand -hex 32`. Never reuse the dev default. |
| `INSTRUCTOR_SIGNUP_CODE` | Gatekeeps instructor registration. Use something non-guessable. |
| `DEMO_MODE` | **Must be `false` in production.** When `true`, auth is bypassed and a read-only guest session is injected — fine for showcases, wide open in prod. |
| `CORS_ORIGINS` | Lock to your real HTTPS origin(s), e.g. `https://your-domain.example`. The localhost default will block the real frontend. |
| `FRONTEND_BASE_URL` | Your real HTTPS domain. Used to build certificate QR-code verification URLs. |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Payment credentials. Start with test keys; switch to live (`rzp_live_...`) only when ready to charge. The key secret stays server-side and is never returned in responses or logs. |

The remaining keys (`REQUIRE_INSTRUCTOR_APPROVAL`, etc.) can keep their shared values
unless you have a reason to change them.

---

## 3. Local build & run (smoke test)

```bash
cd course-ai-platform
docker compose build
docker compose up -d
docker compose logs -f backend
```

Frontend: http://localhost — Backend health/docs: http://localhost:8000/docs

---

## 4. Build & push images to a registry

```bash
docker login ghcr.io   # or docker.io

docker build -t ghcr.io/<org>/course-ai-backend:latest ./backend
docker build -t ghcr.io/<org>/course-ai-frontend:latest ./frontend

docker push ghcr.io/<org>/course-ai-backend:latest
docker push ghcr.io/<org>/course-ai-frontend:latest
```

---

## 5. Deploy on a remote server (Docker + Compose already installed there)

`docker-compose.yml` builds the images from source (`build: ./backend` and
`build: ./frontend`). Pick **one** of the two paths below.

### Option A — build on the server (simplest)

Copy the whole repo so the Dockerfiles and source are present, then build in place.

```bash
# From your machine — copy the full final-package/ tree (contains the app source
# AND the course content the backend serves). backend/.env is NOT in git; place it
# separately (step 1).
scp -r <local>/final-package user@server:/opt/course-ai-content

# On the server:
#  1. Create /opt/course-ai-content/course-ai-platform/backend/.env from the shared
#     contents (step 1) and `chmod 600` it.
cd /opt/course-ai-content/course-ai-platform
docker compose build
docker compose up -d
```

The compose `..` bind mount already points `CONTENT_ROOT` at the surrounding
`final-package/` tree, so no path edit is needed with this layout.

### Option B — pre-built registry images (no build on server)

Build and push from your machine (step 4), then on the server run a compose file
that references the pushed image names instead of `build:`.

```bash
# On the server, edit docker-compose.yml: replace each `build: ./backend` /
# `build: ./frontend` with `image: ghcr.io/<org>/course-ai-backend:latest` etc.
# You still need the content tree for the backend's read-only bind mount.
scp docker-compose.yml user@server:/opt/course-ai-platform/
scp -r <local>/final-package user@server:/opt/course-ai-content

cd /opt/course-ai-platform
# Adjust the `..:/content:ro` volume to point at /opt/course-ai-content/final-package.
docker compose pull
docker compose up -d
```

### Verify after start

```bash
docker compose ps                       # both services should be "running"
curl -f http://localhost:8000/health    # backend health check
docker compose logs -f backend          # watch for startup errors
```

---

## 6. Production hardening (do before exposing to the internet)

- **TLS**: Put a TLS-terminating reverse proxy (Caddy / Traefik / nginx+certbot) in
  front of port `80`. Compose serves plain HTTP only.
- **Secrets precedence**: Pydantic reads real environment variables *before* the
  `.env` file. If you prefer a secrets manager (AWS Secrets Manager / SSM, GCP Secret
  Manager, Azure Key Vault, Kubernetes Secrets), inject the keys as environment
  variables and you can skip the `.env` file entirely — no code change needed.
- **Never** bake secrets into the image (`ENV SECRET_KEY=...` or `COPY .env`) and
  **never** put them in `docker-compose.yml`'s `environment:` block, which is
  committed. Secrets live only in `backend/.env` or an external manager.
- **Backups**: `platform_db` and `certificates` are named Docker volumes. Back them
  up before any redeploy that recreates volumes:
  ```bash
  docker run --rm -v course-ai-platform_platform_db:/data -v $PWD:/backup \
    alpine tar czf /backup/platform_db.tgz /data
  ```
- **Database at scale**: The default is SQLite on a volume — fine for a single backend
  instance. For multiple replicas or heavier concurrency, switch `DATABASE_URL` to
  Postgres (no code change required).
