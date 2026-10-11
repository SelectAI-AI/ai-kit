from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base

from .config import settings

connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(settings.database_url, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def apply_migrations(engine):
    statements = [
        "ALTER TABLE progress ADD COLUMN demo_initialised BOOLEAN DEFAULT FALSE",
        "ALTER TABLE progress ADD COLUMN status VARCHAR DEFAULT 'not_submitted'",
        "ALTER TABLE progress ADD COLUMN submission_text VARCHAR",
        "ALTER TABLE progress ADD COLUMN submitted_at DATETIME",
        "ALTER TABLE progress ADD COLUMN review_note VARCHAR",
        "ALTER TABLE progress ADD COLUMN reviewed_by VARCHAR",
        "ALTER TABLE users ADD COLUMN discount_tier VARCHAR DEFAULT 'none'",
    ]
    with engine.connect() as conn:
        for stmt in statements:
            try:
                conn.execute(text(stmt))
                conn.commit()
            except Exception:
                pass  # column already exists — safe to ignore
