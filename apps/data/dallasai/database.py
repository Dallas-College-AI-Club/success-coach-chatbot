import os
from collections.abc import Generator

from dotenv import load_dotenv
from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker

load_dotenv()


def get_database_url() -> str:
    """Return the unpooled PostgreSQL database URL."""

    database_url = os.getenv("DATABASE_URL_UNPOOLED")

    if not database_url:
        raise ValueError(
            "DATABASE_URL_UNPOOLED environment variable is not set."
        )

    return database_url.replace(
        "postgresql://",
        "postgresql+psycopg://",
        1,
    )


DATABASE_URL = get_database_url()

engine: Engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
    expire_on_commit=False,
)


def get_db() -> Generator[Session, None, None]:
    """Provide a database session and close it afterward."""

    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()
