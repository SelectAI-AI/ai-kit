from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import Base, engine, apply_migrations
from .routers import (
    auth,
    modules,
    progress,
    certificates,
    instructor,
    pricing,
    discounts,
    payments,
    admin_orders,
)

Base.metadata.create_all(bind=engine)
apply_migrations(engine)  # adds demo_initialised column if absent

app = FastAPI(title="Course AI Learning Platform")

origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(modules.router)
app.include_router(progress.router)
app.include_router(certificates.router)
app.include_router(instructor.router)
app.include_router(pricing.router)
app.include_router(discounts.router)
app.include_router(payments.router)
app.include_router(admin_orders.router)


@app.get("/health")
def health():
    return {"status": "ok", "content_root": settings.content_root, "demo_mode": settings.demo_mode}
