import os
import uuid
from collections.abc import AsyncGenerator
from datetime import datetime

from fastapi import Depends
from sqlalchemy import Boolean, Column, DateTime, Integer, String, ForeignKey, UniqueConstraint
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, relationship
from fastapi_users.db import SQLAlchemyUserDatabase, SQLAlchemyBaseUserTableUUID
from fastapi_users_db_sqlalchemy.generics import GUID

def _async_db_url(url: str) -> str:
    # Render injects postgres:// or postgresql:// — SQLAlchemy async needs +asyncpg.
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+asyncpg://", 1)
    elif url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
    else:
        return url  # SQLite or already normalised — leave untouched

    # Render passes sslmode=require (libpq style); asyncpg uses ssl=require.
    url = url.replace("sslmode=require", "ssl=require")
    url = url.replace("sslmode=verify-full", "ssl=verify-full")

    # If no ssl param at all and we're on Render, add it.
    if "ssl=" not in url and os.getenv("RENDER"):
        url += ("&" if "?" in url else "?") + "ssl=require"

    return url

DATABASE_URL = _async_db_url(os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./test.db"))

class Base(DeclarativeBase):
    pass

class User(Base, SQLAlchemyBaseUserTableUUID):
    __tablename__ = "users"
    role = Column(String, nullable=False, default="guest", server_default="guest")
    first_name = Column(String, nullable=True)
    last_name = Column(String, nullable=True)
    posts = relationship("Post", back_populates="owner")
    profile = relationship("UserProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    experiences = relationship("Experience", back_populates="user", cascade="all, delete-orphan")
    qualifications = relationship("Qualification", back_populates="user", cascade="all, delete-orphan")
    school_education = relationship("SchoolEducation", back_populates="user", cascade="all, delete-orphan")

class Post(Base):
    __tablename__ = "posts"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    owner_id = Column(GUID, ForeignKey("users.id"))
    title = Column(String, nullable=False, default="")
    content = Column(String, nullable=False)
    published = Column(String, default="true")
    created_date = Column(DateTime(timezone=True), default=datetime.utcnow)

    owner = relationship("User", back_populates="posts")
    likes = relationship("Like", back_populates="post", cascade="all, delete-orphan")
    comments = relationship("Comment", back_populates="post", cascade="all, delete-orphan")

class Like(Base):
    __tablename__ = "likes"
    __table_args__ = (UniqueConstraint("post_id", "user_id", name="uq_like_post_user"),)

    id      = Column(Integer, primary_key=True, autoincrement=True)
    post_id = Column(GUID, ForeignKey("posts.id"), nullable=False)
    user_id = Column(GUID, ForeignKey("users.id"), nullable=False)

    post = relationship("Post", back_populates="likes")

class Comment(Base):
    __tablename__ = "comments"

    id         = Column(GUID, primary_key=True, default=uuid.uuid4)
    post_id    = Column(GUID, ForeignKey("posts.id"), nullable=False)
    author_id  = Column(GUID, ForeignKey("users.id"), nullable=False)
    body       = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    post   = relationship("Post", back_populates="comments")
    author = relationship("User")

class UserProfile(Base):
    __tablename__ = "user_profiles"
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(GUID, ForeignKey("users.id"), unique=True, nullable=False)
    bio = Column(String, nullable=True)
    contact = Column(String, nullable=True)
    location = Column(String, nullable=True)
    gender = Column(String, nullable=True)
    headline = Column(String, nullable=True)
    user = relationship("User", back_populates="profile")

class Experience(Base):
    __tablename__ = "experiences"
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(GUID, ForeignKey("users.id"), nullable=False)
    company_name = Column(String, nullable=False, default="")
    designation = Column(String, nullable=False, default="")
    years = Column(Integer, nullable=False, default=0)
    months = Column(Integer, nullable=False, default=0)
    user = relationship("User", back_populates="experiences")

class Qualification(Base):
    __tablename__ = "qualifications"
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(GUID, ForeignKey("users.id"), nullable=False)
    institution = Column(String, nullable=False, default="")
    degree = Column(String, nullable=False, default="")
    field_of_study = Column(String, nullable=True)
    year = Column(Integer, nullable=True)
    user = relationship("User", back_populates="qualifications")

class SchoolEducation(Base):
    __tablename__ = "school_education"
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(GUID, ForeignKey("users.id"), nullable=False)
    grade = Column(String, nullable=False)
    school_name = Column(String, nullable=True)
    board = Column(String, nullable=True)
    percentage = Column(String, nullable=True)
    year = Column(Integer, nullable=True)
    user = relationship("User", back_populates="school_education")

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
    allow_registration = Column(Boolean, nullable=False, default=True, server_default="1")


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
