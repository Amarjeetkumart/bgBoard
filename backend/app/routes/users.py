from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.user import User
from app.schemas.user import User as UserSchema, UserUpdate
from app.middleware.auth import get_current_active_user

router = APIRouter(prefix="/api/users", tags=["users"])

@router.get("/me", response_model=UserSchema)
async def get_current_user_profile(
    current_user: User = Depends(get_current_active_user)
):
    return current_user

@router.put("/me", response_model=UserSchema)
async def update_current_user(
    user_update: UserUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    if user_update.name is not None:
        if not user_update.name or not user_update.name.strip():
            raise HTTPException(status_code=400, detail="User name cannot be empty")
        current_user.name = user_update.name
    if user_update.department is not None:
        if not user_update.department or not user_update.department.strip():
            raise HTTPException(status_code=400, detail="Department cannot be empty")
        current_user.department = user_update.department
    
    db.commit()
    db.refresh(current_user)
    return current_user

@router.get("", response_model=List[UserSchema])
async def get_users(
    department: str = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    query = db.query(User).filter(User.is_active == True)
    
    if department:
        query = query.filter(User.department == department)
    
    users = query.all()
    return users

@router.get("/{user_id}", response_model=UserSchema)
async def get_user(
    user_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user
