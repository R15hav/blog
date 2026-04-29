from pydantic import BaseModel

class ArticleBase(BaseModel):
    title: str
    content: str
    published: bool = True
    created_date: str
