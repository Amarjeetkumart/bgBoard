from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, aliased
from sqlalchemy import func
from typing import List, Optional
from app.database import get_db
from app.models.user import User
from app.models.shoutout import ShoutOut, ShoutOutRecipient
from app.models.reaction import Reaction
from app.models.comment import Comment
from app.schemas.shoutout import ShoutOut as ShoutOutSchema, ShoutOutCreate, ShoutOutUpdate
from app.middleware.auth import get_current_active_user

router = APIRouter(prefix="/api/shoutouts", tags=["shoutouts"])

def format_shoutout(shoutout, user_id, db):
    reaction_counts = (
        db.query(Reaction.type, func.count(Reaction.id))
        .filter(Reaction.shoutout_id == shoutout.id)
        .group_by(Reaction.type)
        .all()
    )
    
    user_reactions = (
        db.query(Reaction.type)
        .filter(Reaction.shoutout_id == shoutout.id, Reaction.user_id == user_id)
        .all()
    )
    
    comment_count = db.query(func.count(Comment.id)).filter(Comment.shoutout_id == shoutout.id).scalar()
    
    return {
        "id": shoutout.id,
        "sender_id": shoutout.sender_id,
        "message": shoutout.message,
        "created_at": shoutout.created_at,
        "updated_at": shoutout.updated_at,
        "sender": {
            "id": shoutout.sender.id,
            "name": shoutout.sender.name,
            "email": shoutout.sender.email,
            "department": shoutout.sender.department
        },
        "recipients": [
            {
                "id": r.recipient.id,
                "name": r.recipient.name,
                "email": r.recipient.email,
                "department": r.recipient.department
            }
            for r in shoutout.recipients
        ],
        "reaction_counts": {reaction_type: count for reaction_type, count in reaction_counts},
        "comment_count": comment_count,
        "user_reactions": [r[0] for r in user_reactions]
    }

@router.post("", response_model=ShoutOutSchema)
async def create_shoutout(
    shoutout_data: ShoutOutCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    new_shoutout = ShoutOut(
        sender_id=current_user.id,
        message=shoutout_data.message
    )
    
    db.add(new_shoutout)
    db.flush()
    
    for recipient_id in shoutout_data.recipient_ids:
        recipient = db.query(User).filter(User.id == recipient_id).first()
        if not recipient:
            raise HTTPException(status_code=404, detail=f"Recipient with id {recipient_id} not found")

        if recipient.id == current_user.id:
            raise HTTPException(
                status_code=400,
                detail="You cannot give a shoutout to yourself"
            )
        
        if recipient.department != current_user.department:
            raise HTTPException(
                status_code=403, 
                detail="Can only tag users from your own department"
            )
        
        shoutout_recipient = ShoutOutRecipient(
            shoutout_id=new_shoutout.id,
            recipient_id=recipient_id
        )
        db.add(shoutout_recipient)
    
    db.commit()
    db.refresh(new_shoutout)
    
    return format_shoutout(new_shoutout, current_user.id, db)

@router.get("", response_model=List[ShoutOutSchema])
async def get_shoutouts(
    skip: int = 0,
    limit: int = 20,
    department: Optional[str] = None,
    sender_id: Optional[int] = None,
    start_date: Optional[str] = None,  # YYYY-MM-DD
    end_date: Optional[str] = None,    # YYYY-MM-DD
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    # Base query: restrict to the current user's department by recipient membership
    shoutouts_query = (
        db.query(ShoutOut)
        .join(ShoutOutRecipient, ShoutOut.id == ShoutOutRecipient.shoutout_id)
        .join(User, ShoutOutRecipient.recipient_id == User.id)
        .filter(User.department == current_user.department)
        .distinct()
    )

    # Optional filters
    if department:
        # filter by sender department; due to business rules, sender and recipients share dept
        sender_user = aliased(User)
        shoutouts_query = shoutouts_query.join(
            sender_user, ShoutOut.sender_id == sender_user.id
        ).filter(sender_user.department == department)

    if sender_id:
        shoutouts_query = shoutouts_query.filter(ShoutOut.sender_id == sender_id)

    if start_date:
        # Compare by date portion to avoid TZ issues
        shoutouts_query = shoutouts_query.filter(func.date(ShoutOut.created_at) >= start_date)
    if end_date:
        shoutouts_query = shoutouts_query.filter(func.date(ShoutOut.created_at) <= end_date)

    shoutouts_query = shoutouts_query.order_by(ShoutOut.created_at.desc()).offset(skip).limit(limit)

    shoutouts = shoutouts_query.all()
    return [format_shoutout(s, current_user.id, db) for s in shoutouts]

@router.get("/{shoutout_id}", response_model=ShoutOutSchema)
async def get_shoutout(
    shoutout_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    shoutout = db.query(ShoutOut).filter(ShoutOut.id == shoutout_id).first()
    if not shoutout:
        raise HTTPException(status_code=404, detail="Shoutout not found")
    
    has_department_access = (
        db.query(ShoutOutRecipient)
        .join(User, ShoutOutRecipient.recipient_id == User.id)
        .filter(
            ShoutOutRecipient.shoutout_id == shoutout_id,
            User.department == current_user.department
        )
        .first()
    )
    
    if not has_department_access:
        raise HTTPException(
            status_code=403, 
            detail="Not authorized to view this shoutout"
        )
    
    return format_shoutout(shoutout, current_user.id, db)

@router.put("/{shoutout_id}", response_model=ShoutOutSchema)
async def update_shoutout(
    shoutout_id: int,
    shoutout_update: ShoutOutUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    shoutout = db.query(ShoutOut).filter(ShoutOut.id == shoutout_id).first()
    if not shoutout:
        raise HTTPException(status_code=404, detail="Shoutout not found")
    
    if shoutout.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to update this shoutout")

    if not shoutout_update.message or not shoutout_update.message.strip():
        raise HTTPException(status_code=400, detail="Shoutout message cannot be empty")
    
    shoutout.message = shoutout_update.message
    db.commit()
    db.refresh(shoutout)
    
    return format_shoutout(shoutout, current_user.id, db)

@router.delete("/{shoutout_id}")
async def delete_shoutout(
    shoutout_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    shoutout = db.query(ShoutOut).filter(ShoutOut.id == shoutout_id).first()
    if not shoutout:
        raise HTTPException(status_code=404, detail="Shoutout not found")
    
    if shoutout.sender_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to delete this shoutout")
    
    db.delete(shoutout)
    db.commit()
    
    return {"message": "Shoutout deleted successfully"}
