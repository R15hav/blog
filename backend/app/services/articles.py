import uuid
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.database.db import Post, Like, Comment, User


def _post_to_dict(post: Post) -> dict:
    owner = post.owner
    if owner:
        parts = [owner.first_name, owner.last_name]
        author_name = " ".join(p for p in parts if p) or owner.email
    else:
        author_name = None
    return {
        "id": str(post.id),
        "owner_id": str(post.owner_id),
        "title": post.title,
        "content": post.content,
        "published": post.published,
        "created_date": post.created_date,
        "author_email": owner.email if owner else None,
        "author_name": author_name,
        "like_count": len(post.likes),
        "comment_count": len(post.comments),
    }


def _post_opts():
    return (
        selectinload(Post.owner),
        selectinload(Post.likes),
        selectinload(Post.comments),
    )


async def create_article(session: AsyncSession, user, post):
    try:
        datetime_object = datetime.strptime(post.created_date, "%Y-%m-%d %H:%M:%S")
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
        return new_post
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


async def list_articles(session: AsyncSession, skip: int = 0, limit: int = 10, search: str = ""):
    """Public endpoint — only published articles."""
    count_q = select(func.count()).select_from(Post).where(Post.published == "true")
    rows_q = select(Post).options(*_post_opts()).where(Post.published == "true")
    if search:
        pattern = f"%{search}%"
        author_ids = select(User.id).where(
            User.first_name.ilike(pattern) | User.last_name.ilike(pattern)
        )
        filt = Post.title.ilike(pattern) | Post.owner_id.in_(author_ids)
        count_q = count_q.where(filt)
        rows_q = rows_q.where(filt)
    total = (await session.execute(count_q)).scalar() or 0
    result = await session.execute(
        rows_q.order_by(Post.created_date.desc()).offset(skip).limit(limit)
    )
    return [_post_to_dict(p) for p in result.scalars().all()], total


async def list_all_articles(session: AsyncSession, skip: int = 0, limit: int = 20, search: str = ""):
    """Admin endpoint — all articles regardless of published status."""
    count_q = select(func.count()).select_from(Post)
    rows_q = select(Post).options(*_post_opts())
    if search:
        pattern = f"%{search}%"
        author_ids = select(User.id).where(
            User.first_name.ilike(pattern) | User.last_name.ilike(pattern)
        )
        filt = Post.title.ilike(pattern) | Post.owner_id.in_(author_ids)
        count_q = count_q.where(filt)
        rows_q = rows_q.where(filt)
    total = (await session.execute(count_q)).scalar() or 0
    result = await session.execute(
        rows_q.order_by(Post.created_date.desc()).offset(skip).limit(limit)
    )
    return [_post_to_dict(p) for p in result.scalars().all()], total


async def search_articles(session: AsyncSession, title: str):
    result = await session.execute(
        select(Post)
        .options(*_post_opts())
        .where(Post.title.ilike(f"%{title}%"))
    )
    return [_post_to_dict(p) for p in result.scalars().all()]


async def get_article_by_id(session: AsyncSession, id_str: str):
    try:
        article_id = uuid.UUID(id_str)
        result = await session.execute(
            select(Post)
            .options(*_post_opts())
            .where(Post.id == article_id)
        )
        post = result.scalars().first()
        if not post:
            raise HTTPException(status_code=404, detail="Article not found")
        return [_post_to_dict(post)]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


async def delete_article(session: AsyncSession, user, id_str: str):
    try:
        article_id = uuid.UUID(id_str)
        result = await session.execute(select(Post).where(Post.id == article_id))
        article = result.scalars().first()
        if not article:
            raise HTTPException(status_code=404, detail="Article not found")
        if not user.is_superuser and article.owner_id != user.id:
            raise HTTPException(status_code=403, detail="Not authorized to delete this article")
        await session.delete(article)
        await session.commit()
        return {"success": True, "message": "Article deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


async def update_article(session: AsyncSession, user, id_str: str, post):
    try:
        article_id = uuid.UUID(id_str)
        result = await session.execute(select(Post).where(Post.id == article_id))
        article = result.scalars().first()
        if not article:
            raise HTTPException(status_code=404, detail="Article not found")
        if not user.is_superuser and article.owner_id != user.id:
            raise HTTPException(status_code=403, detail="Not authorized to update this article")
        datetime_object = datetime.strptime(post.created_date, "%Y-%m-%d %H:%M:%S")
        article.title = post.title
        article.content = post.content
        article.published = str(post.published).lower()
        article.created_date = datetime_object
        session.add(article)
        await session.commit()
        await session.refresh(article)
        return article
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Likes ──────────────────────────────────────────────────────────────────────

async def toggle_like(session: AsyncSession, post_id_str: str, user_id) -> dict:
    post_id = uuid.UUID(post_id_str)
    result = await session.execute(
        select(Like).where(Like.post_id == post_id, Like.user_id == user_id)
    )
    existing = result.scalars().first()
    if existing:
        await session.delete(existing)
        liked = False
    else:
        session.add(Like(post_id=post_id, user_id=user_id))
        liked = True
    await session.commit()
    count = (await session.execute(
        select(func.count()).select_from(Like).where(Like.post_id == post_id)
    )).scalar()
    return {"count": count, "user_liked": liked}


async def get_like_status(session: AsyncSession, post_id_str: str, user_id=None) -> dict:
    post_id = uuid.UUID(post_id_str)
    count = (await session.execute(
        select(func.count()).select_from(Like).where(Like.post_id == post_id)
    )).scalar()
    user_liked = False
    if user_id:
        row = (await session.execute(
            select(Like).where(Like.post_id == post_id, Like.user_id == user_id)
        )).scalars().first()
        user_liked = row is not None
    return {"count": count, "user_liked": user_liked}


# ── Author-scoped queries ──────────────────────────────────────────────────────

async def list_author_articles(session: AsyncSession, owner_id, skip: int = 0, limit: int = 20, search: str = ""):
    count_q = select(func.count()).select_from(Post).where(Post.owner_id == owner_id)
    rows_q = select(Post).options(*_post_opts()).where(Post.owner_id == owner_id)
    if search:
        pattern = f"%{search}%"
        count_q = count_q.where(Post.title.ilike(pattern))
        rows_q = rows_q.where(Post.title.ilike(pattern))
    total = (await session.execute(count_q)).scalar() or 0
    result = await session.execute(rows_q.order_by(Post.created_date.desc()).offset(skip).limit(limit))
    return [_post_to_dict(p) for p in result.scalars().all()], total


async def list_comments_for_author(session: AsyncSession, owner_id, skip: int = 0, limit: int = 50):
    count_q = (
        select(func.count())
        .select_from(Comment)
        .join(Post, Comment.post_id == Post.id)
        .where(Post.owner_id == owner_id)
    )
    rows_q = (
        select(Comment)
        .options(selectinload(Comment.author), selectinload(Comment.post))
        .join(Post, Comment.post_id == Post.id)
        .where(Post.owner_id == owner_id)
        .order_by(Comment.created_at.desc())
        .offset(skip).limit(limit)
    )
    total = (await session.execute(count_q)).scalar() or 0
    comments = (await session.execute(rows_q)).scalars().all()
    return [
        {
            "id": str(c.id),
            "post_id": str(c.post_id),
            "post_title": c.post.title if c.post else "",
            "author_email": c.author.email if c.author else "unknown",
            "body": c.body,
            "created_at": c.created_at,
        }
        for c in comments
    ], total


# ── Comments ───────────────────────────────────────────────────────────────────

async def list_comments(session: AsyncSession, post_id_str: str) -> list:
    post_id = uuid.UUID(post_id_str)
    result = await session.execute(
        select(Comment)
        .options(selectinload(Comment.author))
        .where(Comment.post_id == post_id)
        .order_by(Comment.created_at.asc())
    )
    comments = result.scalars().all()
    return [
        {
            "id": str(c.id),
            "author_email": c.author.email if c.author else "unknown",
            "body": c.body,
            "created_at": c.created_at,
        }
        for c in comments
    ]


async def add_comment(session: AsyncSession, post_id_str: str, author_id, body: str) -> dict:
    post_id = uuid.UUID(post_id_str)
    comment = Comment(post_id=post_id, author_id=author_id, body=body)
    session.add(comment)
    await session.commit()
    await session.refresh(comment)
    result = await session.execute(
        select(Comment).options(selectinload(Comment.author)).where(Comment.id == comment.id)
    )
    c = result.scalars().first()
    return {
        "id": str(c.id),
        "author_email": c.author.email if c.author else "unknown",
        "body": c.body,
        "created_at": c.created_at,
    }


async def delete_comment(session: AsyncSession, comment_id_str: str, user) -> dict:
    comment_id = uuid.UUID(comment_id_str)
    result = await session.execute(select(Comment).where(Comment.id == comment_id))
    comment = result.scalars().first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    if not user.is_superuser and comment.author_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    await session.delete(comment)
    await session.commit()
    return {"success": True}


# ── Sitemap (lightweight projection for SEO crawl-wall) ────────────────────────

def _iso_utc(dt: datetime) -> str:
    if dt.tzinfo is not None:
        dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt.replace(microsecond=0).isoformat() + "Z"


async def list_sitemap_entries(
    session: AsyncSession, page: int, per_page: int
) -> tuple[list[dict], int]:
    base_filter = Post.published == "true"

    count_q = select(func.count()).select_from(Post).where(base_filter)
    total = (await session.execute(count_q)).scalar() or 0

    offset = (page - 1) * per_page
    rows_q = (
        select(Post.id, Post.created_date)
        .where(base_filter)
        .order_by(Post.created_date.desc())
        .offset(offset)
        .limit(per_page)
    )
    rows = (await session.execute(rows_q)).all()

    items = [
        {"id": str(row_id), "lastmod": _iso_utc(row_created)}
        for row_id, row_created in rows
    ]
    return items, total


async def get_sitemap_meta(session: AsyncSession) -> dict:
    PER_PAGE = 5000
    base_filter = Post.published == "true"

    row = (await session.execute(
        select(func.count(Post.id), func.max(Post.created_date)).where(base_filter)
    )).one()
    total, max_dt = row[0] or 0, row[1]

    total_pages = (total + PER_PAGE - 1) // PER_PAGE if total else 0
    return {
        "total": total,
        "max_lastmod": _iso_utc(max_dt) if max_dt is not None else None,
        "per_page": PER_PAGE,
        "total_pages": total_pages,
    }
