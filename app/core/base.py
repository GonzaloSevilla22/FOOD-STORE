from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


def now_utc() -> datetime:
    """Retorna hora UTC actual."""
    return datetime.now(timezone.utc)


class BaseModel(SQLModel):
    """
    Clase base para modelos con auditoría.
    Proporciona campos estándar: created_at, updated_at, deleted_at.
    """
    created_at: datetime = Field(default_factory=now_utc, nullable=False)
    updated_at: datetime = Field(default_factory=now_utc, nullable=False)
    deleted_at: Optional[datetime] = Field(default=None, nullable=True)
