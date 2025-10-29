from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class CommentCreate(BaseModel):
    content: str

class CommentUpdate(BaseModel):
    content: str

class Comment(BaseModel):
    id: int
    shoutout_id: int
    user_id: int
    content: str
    created_at: datetime
    updated_at: datetime
    user: dict

    class Config:
        from_attributes = True
