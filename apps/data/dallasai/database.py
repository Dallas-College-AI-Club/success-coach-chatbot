import os

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

# Load environment variables from .env
# Load variables from the .env file into the environment.
load_dotenv()

# Read the database connection string from the environment.
DATABASE_URL = os.getenv("DATABASE_URL_UNPOOLED")

# Stop execution if the required database URL is missing.
if DATABASE_URL is None:

    raise ValueError("DATABASE_URL_UNPOOLED environment variable is not set.")

DATABASE_URL = DATABASE_URL.replace(

    "postgresql://",
    "postgresql+psycopg://",
    1,

)

# Create the SQLAlchemy engine used to connect to the database.
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,  
)

# Configure a session factory for creating database sessions.
SessionLocal = sessionmaker(
    bind=engine,              
    autoflush=False,          
    autocommit=False,         
    expire_on_commit=False,   
)

# Base class that all ORM models will inherit from.
class Base(DeclarativeBase):
    """Base class for all SQLAlchemy ORM models."""

    pass

# Dependency/helper that provides a database session and ensures it is closed.
def get_db():
    """Provide a database session."""

    # Create a new database session.
    db = SessionLocal()
    try:
        # Make the session available to the caller.
        yield db
    finally:
        # Always close the session after use.
        db.close()