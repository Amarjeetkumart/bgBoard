from pydantic import BaseModel
from datetime import datetime

class ReactionCreate(BaseModel):
    type: str

class Reaction(BaseModel):
    id: int
    shoutout_id: int
    user_id: int
    type: str
    created_at: datetime

    class Config:
        from_attributes = True
