#Standard library imports
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

#Local application imports
from app.models.users import UserRead, UserCreate, UserUpdate
from app.api.v1.articles import router as articles_router

from app.database.db import create_db_and_tables
from app.core.users import fastapi_users, auth_backend

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create database and tables
    await create_db_and_tables()
    yield
    # Shutdown: any cleanup can be done here

app = FastAPI(lifespan=lifespan)

# Define allowed origins (frontend URLs)
origins = [
    "http://localhost:3000",
    "https://your-production-frontend.com",
]

# Add the CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,         # Allows specified origins
    allow_credentials=True,        # Allows cookies/authorization headers
    allow_methods=["*"],           # Allows all methods (GET, POST, PUT, DELETE, etc)
    allow_headers=["*"],           # Allows all headers
)

app.include_router(
    fastapi_users.get_auth_router(auth_backend), 
    prefix="/auth/jwt", 
    tags=["auth"]
)
app.include_router(
    fastapi_users.get_register_router( UserRead, UserCreate ), 
    prefix="/auth", 
    tags=["auth"]
)
app.include_router(
    fastapi_users.get_reset_password_router(), 
    prefix="/auth", 
    tags=["auth"]
)
app.include_router(
    fastapi_users.get_verify_router( UserRead ), 
    prefix="/auth", 
    tags=["auth"]
)
app.include_router(
    fastapi_users.get_users_router( UserRead, UserUpdate ), 
    prefix="/users", 
    tags=["users"]
)
app.include_router(articles_router, prefix="/api/v1", tags=["articles"])

