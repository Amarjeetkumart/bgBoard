from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from app.database import get_db
from app.models.user import User
from app.models.shoutout import ShoutOut, ShoutOutRecipient
from app.models.report import Report
from app.models.admin_log import AdminLog
from app.schemas.report import Report as ReportSchema, ReportCreate
from app.schemas.user import User as UserSchema
from app.middleware.auth import get_current_active_user, require_admin

router = APIRouter(prefix="/api/admin", tags=["admin"])

@router.get("/users", response_model=List[UserSchema])
async def get_all_users(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    users = db.query(User).all()
    return users

@router.get("/analytics")
async def get_analytics(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    total_users = db.query(func.count(User.id)).scalar()
    total_shoutouts = db.query(func.count(ShoutOut.id)).scalar()
    
    top_contributors = (
        db.query(User.id, User.name, User.department, func.count(ShoutOut.id).label("count"))
        .join(ShoutOut, ShoutOut.sender_id == User.id)
        .group_by(User.id)
        .order_by(func.count(ShoutOut.id).desc())
        .limit(10)
        .all()
    )
    
    most_tagged = (
        db.query(User.id, User.name, User.department, func.count(ShoutOutRecipient.id).label("count"))
        .join(ShoutOutRecipient, ShoutOutRecipient.recipient_id == User.id)
        .group_by(User.id)
        .order_by(func.count(ShoutOutRecipient.id).desc())
        .limit(10)
        .all()
    )
    
    department_stats = (
        db.query(User.department, func.count(ShoutOut.id).label("count"))
        .join(ShoutOut, ShoutOut.sender_id == User.id)
        .group_by(User.department)
        .all()
    )
    
    return {
        "total_users": total_users,
        "total_shoutouts": total_shoutouts,
        "top_contributors": [
            {"id": u.id, "name": u.name, "department": u.department, "shoutouts_sent": u.count}
            for u in top_contributors
        ],
        "most_tagged": [
            {"id": u.id, "name": u.name, "department": u.department, "times_tagged": u.count}
            for u in most_tagged
        ],
        "department_stats": [
            {"department": d.department, "shoutout_count": d.count}
            for d in department_stats
        ]
    }

@router.post("/shoutouts/{shoutout_id}/report", response_model=ReportSchema)
async def report_shoutout(
    shoutout_id: int,
    report_data: ReportCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    shoutout = db.query(ShoutOut).filter(ShoutOut.id == shoutout_id).first()
    if not shoutout:
        raise HTTPException(status_code=404, detail="Shoutout not found")

    if not report_data.reason or not report_data.reason.strip():
        raise HTTPException(status_code=400, detail="Report reason cannot be empty")
    
    new_report = Report(
        shoutout_id=shoutout_id,
        reported_by=current_user.id,
        reason=report_data.reason,
        status="pending"
    )
    
    db.add(new_report)
    db.commit()
    db.refresh(new_report)
    
    return new_report

@router.get("/reports", response_model=List[ReportSchema])
async def get_reports(
    status: str = None,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    query = db.query(Report)
    
    if status:
        query = query.filter(Report.status == status)
    
    reports = query.order_by(Report.created_at.desc()).all()
    return reports

@router.post("/reports/{report_id}/resolve")
async def resolve_report(
    report_id: int,
    action: str,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    if action not in ["approved", "rejected"]:
        raise HTTPException(status_code=400, detail="Invalid action")
    
    report.status = action
    
    admin_log = AdminLog(
        admin_id=admin.id,
        action=f"Resolved report #{report_id} with action: {action}",
        target_id=report_id,
        target_type="report"
    )
    db.add(admin_log)
    
    db.commit()
    
    return {"message": f"Report {action} successfully"}

@router.delete("/shoutouts/{shoutout_id}")
async def admin_delete_shoutout(
    shoutout_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    shoutout = db.query(ShoutOut).filter(ShoutOut.id == shoutout_id).first()
    if not shoutout:
        raise HTTPException(status_code=404, detail="Shoutout not found")
    
    admin_log = AdminLog(
        admin_id=admin.id,
        action=f"Deleted shoutout #{shoutout_id}",
        target_id=shoutout_id,
        target_type="shoutout"
    )
    db.add(admin_log)
    
    db.delete(shoutout)
    db.commit()
    
    return {"message": "Shoutout deleted successfully"}

@router.get("/leaderboard")
async def get_leaderboard(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    top_senders = (
        db.query(User.id, User.name, User.department, func.count(ShoutOut.id).label("sent"))
        .join(ShoutOut, ShoutOut.sender_id == User.id)
        .group_by(User.id)
        .order_by(func.count(ShoutOut.id).desc())
        .limit(10)
        .all()
    )
    
    top_receivers = (
        db.query(User.id, User.name, User.department, func.count(ShoutOutRecipient.id).label("received"))
        .join(ShoutOutRecipient, ShoutOutRecipient.recipient_id == User.id)
        .group_by(User.id)
        .order_by(func.count(ShoutOutRecipient.id).desc())
        .limit(10)
        .all()
    )
    
    return {
        "top_senders": [
            {"id": u.id, "name": u.name, "department": u.department, "shoutouts_sent": u.sent}
            for u in top_senders
        ],
        "top_receivers": [
            {"id": u.id, "name": u.name, "department": u.department, "shoutouts_received": u.received}
            for u in top_receivers
        ]
    }
