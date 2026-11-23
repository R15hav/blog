import uuid
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.database.db import Post, Like, Comment, User


# Public article and comment payloads identify people by user ID and display
# name only. Email addresses are never included: they are private to the user
# and to admin-only views (see services/admin.py).
DISPLAY_NAME_FALLBACK = "Member"


def display_name(user) -> str | None:
    """First and last name, or a neutral label. Never derived from the email."""
    if user is None:
        return None
    return " ".join(p for p in (user.first_name, user.last_name) if p) or DISPLAY_NAME_FALLBACK


def _comment_to_dict(c: Comment) -> dict:
    return {
        "id": str(c.id),
        "author_id": str(c.author_id),
        "author_name": display_name(c.author),
        "body": c.body,
        "created_at": c.created_at,
    }


def _post_to_dict(post: Post) -> dict:
    return {
        "id": str(post.id),
        "owner_id": str(post.owner_id),
        "title": post.title,
        "content": post.content,
        "published": post.published,
        "created_date": post.created_date,
        "author_name": display_name(post.owner),
        "like_count": len(post.likes),
        "comment_count": len(post.comments),
    }


def _post_opts():
    return (
        selectinload(Post.owner),
        selectinload(Post.likes),
        selectinload(Post.comments),
    )


# ── Visibility ─────────────────────────────────────────────────────────────────
#
# A published article is visible to everyone. An unpublished article (draft) is
# visible only to its owner and to superusers. Every endpoint that reads or
# writes an article by ID on behalf of a caller must go through this check;
# callers who may not see a draft get the same 404 as for a missing article, so
# draft IDs are not confirmed to exist.

def _parse_uuid(value: str, detail: str) -> uuid.UUID:
    try:
        return uuid.UUID(value)
    except ValueError:
        raise HTTPException(status_code=400, detail=detail)


def can_view_post(post: Post, user=None) -> bool:
    if str(post.published).lower() == "true":
        return True
    if user is None:
        return False
    return bool(user.is_superuser) or post.owner_id == user.id


async def get_visible_post(session: AsyncSession, post_id: uuid.UUID, user=None) -> Post:
    """Return the post if `user` may see it; otherwise raise 404."""
    post = (await session.execute(select(Post).where(Post.id == post_id))).scalars().first()
    if post is None or not can_view_post(post, user):
        raise HTTPException(status_code=404, detail="Article not found")
    return post


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
    """Public endpoint — only published articles. Owners and admins reach drafts
    through the author dashboard and the admin article list instead."""
    result = await session.execute(
        select(Post)
        .options(*_post_opts())
        .where(Post.published == "true")
        .where(Post.title.ilike(f"%{title}%"))
    )
    return [_post_to_dict(p) for p in result.scalars().all()]


async def get_article_by_id(session: AsyncSession, id_str: str, user=None):
    try:
        article_id = uuid.UUID(id_str)
        result = await session.execute(
            select(Post)
            .options(*_post_opts())
            .where(Post.id == article_id)
        )
        post = result.scalars().first()
        if not post or not can_view_post(post, user):
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
        # A draft the caller may not see is reported as missing, not forbidden.
        if not article or not can_view_post(article, user):
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
        # A draft the caller may not see is reported as missing, not forbidden.
        if not article or not can_view_post(article, user):
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

async def toggle_like(session: AsyncSession, post_id_str: str, user) -> dict:
    post_id = _parse_uuid(post_id_str, "Invalid article ID")
    await get_visible_post(session, post_id, user)
    user_id = user.id
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


async def get_like_status(session: AsyncSession, post_id_str: str, user=None) -> dict:
    post_id = _parse_uuid(post_id_str, "Invalid article ID")
    await get_visible_post(session, post_id, user)
    user_id = getattr(user, "id", None)
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
    # Authors see who commented on their articles by name, not by email.
    return [
        {
            **_comment_to_dict(c),
            "post_id": str(c.post_id),
            "post_title": c.post.title if c.post else "",
        }
        for c in comments
    ], total


# ── Comments ───────────────────────────────────────────────────────────────────

async def list_comments(session: AsyncSession, post_id_str: str, user=None) -> list:
    post_id = _parse_uuid(post_id_str, "Invalid article ID")
    await get_visible_post(session, post_id, user)
    result = await session.execute(
        select(Comment)
        .options(selectinload(Comment.author))
        .where(Comment.post_id == post_id)
        .order_by(Comment.created_at.asc())
    )
    return [_comment_to_dict(c) for c in result.scalars().all()]


async def add_comment(session: AsyncSession, post_id_str: str, user, body: str) -> dict:
    post_id = _parse_uuid(post_id_str, "Invalid article ID")
    await get_visible_post(session, post_id, user)
    comment = Comment(post_id=post_id, author_id=user.id, body=body)
    session.add(comment)
    await session.commit()
    await session.refresh(comment)
    result = await session.execute(
        select(Comment).options(selectinload(Comment.author)).where(Comment.id == comment.id)
    )
    return _comment_to_dict(result.scalars().first())


async def delete_comment(session: AsyncSession, comment_id_str: str, user) -> dict:
    comment_id = _parse_uuid(comment_id_str, "Invalid comment ID")
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
