from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime
from sqlalchemy import select
import uuid

from app.models.articles import ArticleBase
from app.database.db import Post, get_async_session, User
from app.core.users import current_active_user


router = APIRouter()


@router.post("/create-article")
async def create_article(
    post: ArticleBase,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    try:
        format_pattern = "%Y-%m-%d %H:%M:%S"
        datetime_object = datetime.strptime(post.created_date, format_pattern)

        new_post = Post(
            owner_id=user.id,
            title=post.title,
            content=post.content,
            published=str(post.published).lower(),
            created_date=datetime_object,
        )

        session.add(new_post)
        await session.commit()
        await session.refresh(new_post)
        return {"blog": new_post}

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    
@router.get("/get-articles")
async def get_articles( session: AsyncSession = Depends(get_async_session) ):
    results = await session.execute(select(Post))
    articles = [ row[0] for row in results.all() ]
    return {"articles": articles}

@router.get("/get-article/{id}")
async def get_article(id: str, session: AsyncSession = Depends(get_async_session)):
    try:
        article_id = uuid.UUID(id)
        results = await session.execute(select(Post).where(Post.id == article_id))
        article = [ row[0] for row in results.all() ]

        if not article:
            raise HTTPException(status_code=404, detail="Article not found")
        
        return {"article": article}
    
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# `create-blog` moved to `router/api/v1/articles.py` and mounted under `/api/v1`

# @router.put("/update-blog/{id}")
# def update_blog(id: int):
#     return {"message": "Blog "+ str(id) + " updated"}

@router.delete("/delete-article/{id}")
async def delete_article(
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

@router.get("/search")
def search(q: str = None):
    if q:
        return {"message": f"Search results for query: {q}"}
    else:
        raise HTTPException(status_code=400, detail="Query parameter 'q' is required")
