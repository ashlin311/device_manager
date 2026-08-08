from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import get_db
from models import AuditLog, User
from schemas import AuditLogResponse
from auth.router import get_current_user

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("/logs", response_model=list[AuditLogResponse])
async def get_audit_logs(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Admin fetches all audit log entries, most recent first."""
    result = await db.execute(
        select(AuditLog).order_by(AuditLog.created_at.desc())
    )
    logs = result.scalars().all()
    return logs
