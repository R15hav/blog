from pydantic import BaseModel
import uuid

class ArticleBase(BaseModel):
    owner_id: uuid.UUID
    content: str
    published: bool = True
    created_date: str