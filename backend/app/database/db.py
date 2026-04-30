import os
import uuid
from collections.abc import AsyncGenerator
from datetime import datetime

from fastapi import Depends
from sqlalchemy import Boolean, Column, DateTime, Integer, String, ForeignKey, Uuid
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, relationship
from fastapi_users.db import SQLAlchemyUserDatabase, SQLAlchemyBaseUserTableUUID

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./test.db")

# asyncpg needs postgresql+asyncpg://... but SQLite needs sqlite+aiosqlite://...
# The env var should already use the correct async driver prefix.

class Base(DeclarativeBase):
    pass

class User(Base, SQLAlchemyBaseUserTableUUID):
    __tablename__ = "users"
    role = Column(String, nullable=False, default="guest", server_default="guest")
    posts = relationship("Post", back_populates="owner")

class Post(Base):
    __tablename__ = "posts"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id = Column(Uuid(as_uuid=True), ForeignKey("users.id"))
    title = Column(String, nullable=False, default="")
    content = Column(String, nullable=False)
    published = Column(String, default="true")
    created_date = Column(DateTime(timezone=True), default=datetime.utcnow)

    owner = relationship("User", back_populates="posts")

class ThemeConfig(Base):
    __tablename__ = "theme_configs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    url = Column(String, nullable=False)
    is_active = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

class SiteConfig(Base):
    __tablename__ = "site_configs"

    id = Column(Integer, primary_key=True, default=1)
    site_name = Column(String, nullable=False, default="My Blog")
    logo_url = Column(String, nullable=True)


engine = create_async_engine(DATABASE_URL)
async_session_maker = async_sessionmaker(engine, expire_on_commit=False)

async def create_db_and_tables():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_maker() as session:
        yield session

async def get_user_db(session: AsyncSession = Depends(get_async_session)):
    yield SQLAlchemyUserDatabase(session, User)
