from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.articles import ArticleBase
from app.database.db import get_async_session, User
from app.core.users import current_active_user
from app.services.articles import (
    create_article as svc_create_article,
    list_articles as svc_list_articles,
    get_article_by_id as svc_get_article_by_id,
    delete_article as svc_delete_article,
)


router = APIRouter()


@router.post("/create-article")
async def create_article(
    post: ArticleBase,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    new_post = await svc_create_article(session, user, post)
    return {"blog": new_post}


@router.get("/get-articles")
async def get_articles(session: AsyncSession = Depends(get_async_session)):
    articles = await svc_list_articles(session)
    return {"articles": articles}


@router.get("/get-article/{id}")
async def get_article(id: str, session: AsyncSession = Depends(get_async_session)):
    article = await svc_get_article_by_id(session, id)
    return {"article": article}


@router.put("/update-blog/{id}")
def update_blog(id: int):
    return {"message": "Blog " + str(id) + " updated"}


@router.delete("/delete-article/{id}")
async def delete_article(
    id: str,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    result = await svc_delete_article(session, user, id)
    return result


# @router.get("/search")
# def search(q: str = None):
#     if q:
#         return {"message": f"Search results for query: {q}"}
#     else:
#         from fastapi import HTTPException
#         raise HTTPException(status_code=400, detail="Query parameter 'q' is required")
