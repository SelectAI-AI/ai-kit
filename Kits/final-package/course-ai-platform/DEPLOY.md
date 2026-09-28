# Deploying course-ai-platform

## Local build & run

```bash
cd Kits/final-package/course-ai-platform
docker compose build
docker compose up -d
docker compose logs -f backend
```

Frontend: http://localhost — Backend: http://localhost:8000/docs

## Build & push images to a registry

```bash
docker login ghcr.io   # or docker.io

docker build -t ghcr.io/<org>/course-ai-backend:latest ./backend
docker build -t ghcr.io/<org>/course-ai-frontend:latest ./frontend

docker push ghcr.io/<org>/course-ai-backend:latest
docker push ghcr.io/<org>/course-ai-frontend:latest
```

## Deploy on a remote server (Docker + Compose already installed there)

```bash
# From your machine — copy the deploy files (compose + backend/.env, never committed to git)
scp docker-compose.yml user@server:/opt/course-ai-platform/
scp backend/.env user@server:/opt/course-ai-platform/backend/.env
scp -r ../.. user@server:/opt/course-ai-content   # the final-package/ content tree

# On the server — point CONTENT_ROOT's bind mount (docker-compose.yml's `..` volume)
# at wherever you placed the content tree, then:
cd /opt/course-ai-platform
docker compose pull      # if using pushed registry images — edit docker-compose.yml
                          # to reference the pushed image names instead of `build:`
docker compose up -d
```

Before exposing this beyond localhost:
- Change `SECRET_KEY` and `INSTRUCTOR_SIGNUP_CODE` in `backend/.env`.
- Put a real TLS-terminating reverse proxy (Caddy/Traefik/nginx+certbot) in front of port 80.
- `platform_db` and `certificates` are named Docker volumes — back them up (`docker run --rm -v course-ai-platform_platform_db:/data -v $PWD:/backup alpine tar czf /backup/platform_db.tgz /data`) before any redeploy that recreates volumes.
