from datetime import datetime
from typing import Optional
from pydantic import BaseModel

class ThemeBase(BaseModel):
    name: str
    url: str

class ThemeRead(ThemeBase):
    id: int
    is_active: bool
    created_at: Optional[datetime]

    class Config:
        from_attributes = True

class ThemeActiveResponse(BaseModel):
    url: Optional[str] = None
