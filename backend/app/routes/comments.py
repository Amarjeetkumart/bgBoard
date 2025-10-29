from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.user import User
from app.models.comment import Comment
from app.models.shoutout import ShoutOut
from app.schemas.comment import Comment as CommentSchema, CommentCreate, CommentUpdate
from app.middleware.auth import get_current_active_user

router = APIRouter(prefix="/api/shoutouts", tags=["comments"])

@router.post("/{shoutout_id}/comments", response_model=CommentSchema)
async def create_comment(
    shoutout_id: int,
    comment_data: CommentCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    shoutout = db.query(ShoutOut).filter(ShoutOut.id == shoutout_id).first()
    if not shoutout:
        raise HTTPException(status_code=404, detail="Shoutout not found")

    if not comment_data.content or not comment_data.content.strip():
        raise HTTPException(status_code=400, detail="Comment content cannot be empty")
    
    new_comment = Comment(
        shoutout_id=shoutout_id,
        user_id=current_user.id,
        content=comment_data.content
    )
    
    db.add(new_comment)
    db.commit()
    db.refresh(new_comment)
    
    return {
        "id": new_comment.id,
        "shoutout_id": new_comment.shoutout_id,
        "user_id": new_comment.user_id,
        "content": new_comment.content,
        "created_at": new_comment.created_at,
        "updated_at": new_comment.updated_at,
        "user": {
            "id": current_user.id,
            "name": current_user.name,
            "email": current_user.email,
            "department": current_user.department
        }
    }

@router.get("/{shoutout_id}/comments", response_model=List[CommentSchema])
async def get_comments(
    shoutout_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    comments = (
        db.query(Comment)
        .filter(Comment.shoutout_id == shoutout_id)
        .order_by(Comment.created_at.asc())
        .all()
    )
    
    return [
        {
            "id": c.id,
            "shoutout_id": c.shoutout_id,
            "user_id": c.user_id,
            "content": c.content,
            "created_at": c.created_at,
            "updated_at": c.updated_at,
            "user": {
                "id": c.user.id,
                "name": c.user.name,
                "email": c.user.email,
                "department": c.user.department
            }
        }
        for c in comments
    ]

@router.put("/comments/{comment_id}", response_model=CommentSchema)
async def update_comment(
    comment_id: int,
    comment_update: CommentUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    comment = db.query(Comment).filter(Comment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    if comment.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to update this comment")

    if not comment_update.content or not comment_update.content.strip():
        raise HTTPException(status_code=400, detail="Comment content cannot be empty")
    
    comment.content = comment_update.content
    db.commit()
    db.refresh(comment)
    
    return {
        "id": comment.id,
        "shoutout_id": comment.shoutout_id,
        "user_id": comment.user_id,
        "content": comment.content,
        "created_at": comment.created_at,
        "updated_at": comment.updated_at,
        "user": {
            "id": current_user.id,
            "name": current_user.name,
            "email": current_user.email,
            "department": current_user.department
        }
    }

@router.delete("/comments/{comment_id}")
async def delete_comment(
    comment_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    comment = db.query(Comment).filter(Comment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    if comment.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to delete this comment")
    
    db.delete(comment)
    db.commit()
    
    return {"message": "Comment deleted successfully"}
