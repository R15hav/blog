from pydantic import BaseModel
from fastapi_users import schemas
import uuid

class PostBase(BaseModel):
    title: str
    content: str
    published: bool = True
    created_date: str

class UserRead(schemas.BaseUser[uuid.UUID]):
    pass

class UserCreate(schemas.BaseUserCreate):
    pass

class UserUpdate(schemas.BaseUserUpdate):
    pass