#Standard library imports
import uuid
from fastapi import FastAPI, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from contextlib import asynccontextmanager
from sqlalchemy import select
from datetime import datetime

#Local application imports
from app.models.articles import ArticleBase
from app.models.users import UserRead, UserCreate, UserUpdate

from app.db import Post, get_async_session, create_db_and_tables, User
from app.core.users import fastapi_users, auth_backend, current_active_user

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create database and tables
    await create_db_and_tables()
    yield
    # Shutdown: any cleanup can be done here

app = FastAPI(lifespan=lifespan)
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

@app.get("/get-blogs")
async def get_blogs( session: AsyncSession = Depends(get_async_session) ):
    results = await session.execute(select(Post))
    blogs = [ row[0] for row in results.all() ]
    return {"blogs": blogs}

@app.get("/get-blog/{id}")
async def get_blog(id: str, session: AsyncSession = Depends(get_async_session)):
    try:
        article_id = uuid.UUID(id)
        results = await session.execute(select(Post).where(Post.id == article_id))
        blog = [ row[0] for row in results.all() ]

        if not blog:
            raise HTTPException(status_code=404, detail="Blog not found")
        
        return {"blog": blog}
    
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/create-blog")
async def create_blog(
    post: ArticleBase, 
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session)
    ):

    format_pattern = "%Y-%m-%d %H:%M:%S"
    # Convert the string to a datetime object
    datetime_object = datetime.strptime(post.created_date, format_pattern)

    new_post = Post(
        owner_id=user.id,
        title=post.title,
        content=post.content,
        published=str(post.published).lower(),
        created_date=datetime_object
    )

    session.add(new_post)
    await session.commit()
    await session.refresh(new_post)
    return {"blog": new_post}

# @app.put("/update-blog/{id}")
# def update_blog(id: int):
#     return {"message": "Blog "+ str(id) + " updated"}

@app.delete("/delete-blog/{id}")
async def delete_blog(
    id: str, 
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session)):
    try:
        article_id = uuid.UUID(id)
        results = await session.execute(select(Post).where(Post.id == article_id))
        article = results.scalars().first()

        if not article:
            raise HTTPException(status_code=404, detail="Article not found")
        if article.owner_id != user.id:
            raise HTTPException(status_code=403, detail="Not authorized to delete this article")

        await session.delete(article)
        await session.commit()
        return {"success": True, "message": "Article deleted successfully"}

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e)) 

@app.get("/search")
def search(q: str = None):
    if q:
        return {"message": f"Search results for query: {q}"}
    else:
        raise HTTPException(status_code=400, detail="Query parameter 'q' is required")