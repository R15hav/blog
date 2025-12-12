#Standard library imports
from fastapi import FastAPI, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from contextlib import asynccontextmanager

#Local application imports
from app.schemas import PostBase
from app.db import Post, get_async_session, create_db_and_tables

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create database and tables
    await create_db_and_tables()
    yield
    # Shutdown: any cleanup can be done here

app = FastAPI(lifespan=lifespan)

@app.get("/get-blogs")
def get_blogs():
    return {"message": "List of blogs"}

@app.get("/get-blog/{id}")
def get_blog(id: int):
    return {"message": "Blog "+ str(id)}

@app.post("/create-blog")
def create_blog(post: PostBase):
    return {"message": post}

@app.put("/update-blog/{id}")
def update_blog(id: int):
    return {"message": "Blog "+ str(id) + " updated"}

@app.delete("/delete-blog/{id}")
def delete_blog(id: int):
    return {"message": "Blog "+ str(id) + " deleted"}   

@app.get("/search")
def search(q: str = None):
    if q:
        return {"message": f"Search results for query: {q}"}
    else:
        raise HTTPException(status_code=400, detail="Query parameter 'q' is required")