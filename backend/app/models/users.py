from fastapi_users import schemas
import uuid

class UserRead(schemas.BaseUser[uuid.UUID]):
    role: str

class UserCreate(schemas.BaseUserCreate):
    pass

class UserUpdate(schemas.BaseUserUpdate):
    pass