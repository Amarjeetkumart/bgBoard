from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.user import User
from app.models.comment import Comment
from app.models.shoutout import ShoutOut
from app.schemas.comment import Comment as CommentSchema, CommentCreate, CommentUpdate
from app.middleware.auth import get_current_active_user
import re
from sqlalchemy.orm import joinedload


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

    # Handle mentions
    mentioned_users = []
    if comment_data.mentions:
        mentioned_users = db.query(User).filter(User.id.in_(comment_data.mentions)).all()
        new_comment.mentions.extend(mentioned_users)
    else:
        # Fallback: parse react-mentions style markup from content @[display](id)
        mention_pattern = re.compile(r"@\[(.+?)\]\((\d+)\)")
        raw_ids = set()
        for m in mention_pattern.finditer(comment_data.content or ""):
            raw_ids.add(int(m.group(2)))
        if raw_ids:
            mentioned_users = db.query(User).filter(User.id.in_(raw_ids)).all()
            new_comment.mentions.extend(mentioned_users)
    
    db.add(new_comment)
    db.commit()
    db.refresh(new_comment)
    return new_comment

@router.get("/{shoutout_id}/comments", response_model=List[CommentSchema])
async def get_comments(
    shoutout_id: int,
    db: Session = Depends(get_db)
):
    comments = (
        db.query(Comment)
        .options(joinedload(Comment.user), joinedload(Comment.mentions))
        .filter(Comment.shoutout_id == shoutout_id)
        .order_by(Comment.created_at.asc())
        .all()
    )
    return comments

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
    return comment

@router.delete("/comments/{comment_id}")
async def delete_comment(
    comment_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    comment = db.query(Comment).filter(Comment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    # Allow legacy admins with is_admin True
    if comment.user_id != current_user.id and not (current_user.role == "admin" or getattr(current_user, "is_admin", False)):
        raise HTTPException(status_code=403, detail="Not authorized to delete this comment")
    
    db.delete(comment)
    db.commit()
    
    return {"message": "Comment deleted successfully"}
