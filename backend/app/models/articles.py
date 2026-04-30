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
    id: str
    author_email: str
    body: str
    created_at: datetime
