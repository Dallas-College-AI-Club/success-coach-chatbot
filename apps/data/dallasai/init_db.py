import asyncio

from sqlalchemy import text

from dallasai.database import SessionLocal, engine
from dallasai.models import Base


async def init_database():
    print("Creating database schema...")
    conn = SessionLocal()
    conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


if __name__ == "__main__":
    asyncio.run(init_database())
