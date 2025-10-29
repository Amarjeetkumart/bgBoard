from pydantic import BaseModel
from datetime import datetime

class ReportCreate(BaseModel):
    reason: str

class Report(BaseModel):
    id: int
    shoutout_id: int
    reported_by: int
    reason: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True
