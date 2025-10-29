from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.reaction import Reaction
from app.models.shoutout import ShoutOut
from app.schemas.reaction import ReactionCreate
from app.middleware.auth import get_current_active_user

router = APIRouter(prefix="/api/shoutouts", tags=["reactions"])

@router.post("/{shoutout_id}/reactions")
async def add_reaction(
    shoutout_id: int,
    reaction_data: ReactionCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    shoutout = db.query(ShoutOut).filter(ShoutOut.id == shoutout_id).first()
    if not shoutout:
        raise HTTPException(status_code=404, detail="Shoutout not found")
    
    if reaction_data.type not in ["like", "clap", "star"]:
        raise HTTPException(status_code=400, detail="Invalid reaction type")
    
    existing_reaction = (
        db.query(Reaction)
        .filter(
            Reaction.shoutout_id == shoutout_id,
            Reaction.user_id == current_user.id,
            Reaction.type == reaction_data.type
        )
        .first()
    )
    
    if existing_reaction:
        return {"message": "Reaction already exists"}
    
    new_reaction = Reaction(
        shoutout_id=shoutout_id,
        user_id=current_user.id,
        type=reaction_data.type
    )
    
    db.add(new_reaction)
    db.commit()
    
    return {"message": "Reaction added successfully"}

@router.delete("/{shoutout_id}/reactions/{reaction_type}")
async def remove_reaction(
    shoutout_id: int,
    reaction_type: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    reaction = (
        db.query(Reaction)
        .filter(
            Reaction.shoutout_id == shoutout_id,
            Reaction.user_id == current_user.id,
            Reaction.type == reaction_type
        )
        .first()
    )
    
    if not reaction:
        raise HTTPException(status_code=404, detail="Reaction not found")
    
    db.delete(reaction)
    db.commit()
    
    return {"message": "Reaction removed successfully"}
