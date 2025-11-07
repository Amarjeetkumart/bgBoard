from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.reaction import Reaction
from app.models.shoutout import ShoutOut, ShoutOutRecipient
from sqlalchemy import func
from app.schemas.reaction import ReactionCreate, ReactionSummary, ReactionUser
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


@router.get("/{shoutout_id}/reactions", response_model=ReactionSummary)
async def list_reactions(
    shoutout_id: int,
    reaction_type: str | None = Query(default=None, pattern="^(like|clap|star)$"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    # Ensure shoutout exists
    shoutout = db.query(ShoutOut).filter(ShoutOut.id == shoutout_id).first()
    if not shoutout:
        raise HTTPException(status_code=404, detail="Shoutout not found")

    # Department-based access: user must be in same department as at least one recipient
    has_department_access = (
        db.query(ShoutOutRecipient)
        .join(User, ShoutOutRecipient.recipient_id == User.id)
        .filter(
            ShoutOutRecipient.shoutout_id == shoutout_id,
            User.department == current_user.department,
        )
        .first()
    )
    if not has_department_access:
        raise HTTPException(status_code=403, detail="Not authorized to view this shoutout's reactions")

    # Counts for each type
    counts_rows = (
        db.query(Reaction.type, func.count(Reaction.id))
        .filter(Reaction.shoutout_id == shoutout_id)
        .group_by(Reaction.type)
        .all()
    )
    counts = {t: c for t, c in counts_rows}

    # Build users map
    types_to_fetch = [reaction_type] if reaction_type else ["like", "clap", "star"]
    users_map: dict[str, list[ReactionUser]] = {t: [] for t in types_to_fetch}

    for t in types_to_fetch:
        rows = (
            db.query(User)
            .join(Reaction, Reaction.user_id == User.id)
            .filter(Reaction.shoutout_id == shoutout_id, Reaction.type == t)
            .order_by(User.name.asc())
            .all()
        )
        users_map[t] = [ReactionUser(id=u.id, name=u.name, email=u.email, department=u.department) for u in rows]

    # If a specific type was requested, include only that in users but keep counts for all
    if reaction_type is None:
        users = users_map
    else:
        users = {reaction_type: users_map.get(reaction_type, [])}

    return ReactionSummary(
        shoutout_id=shoutout_id,
        counts=counts,
        users=users,
    )
