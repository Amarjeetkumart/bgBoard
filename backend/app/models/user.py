from sqlalchemy import Boolean, Column, Integer, String, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password = Column(String(255), nullable=False)
    department = Column(String(100))
    role = Column(String(20), default="employee")
    joined_at = Column(DateTime(timezone=True), server_default=func.now())
    is_active = Column(Boolean, default=True)

    sent_shoutouts = relationship("ShoutOut", back_populates="sender", foreign_keys="ShoutOut.sender_id")
    received_shoutouts = relationship("ShoutOutRecipient", back_populates="recipient")
    comments = relationship("Comment", back_populates="user")
    reactions = relationship("Reaction", back_populates="user")
    reports = relationship("Report", back_populates="reporter")
