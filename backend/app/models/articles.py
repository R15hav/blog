from datetime import datetime
from pydantic import BaseModel

class ArticleBase(BaseModel):
    title: str
    content: str
    published: bool = True
    created_date: str

class CommentCreate(BaseModel):
    body: str

class CommentRead(BaseModel):
    # Public shape: commenters are identified by ID and display name, never email.
    id: str
    author_id: str
    author_name: str | None
    body: str
    created_at: datetime
