from typing import List, Optional
from datetime import datetime

from sqlmodel import Field, SQLModel


class DireccionEntregaCreate(SQLModel):
    alias: str = Field(min_length=2, max_length=100)
    linea1: str = Field(min_length=5, max_length=255)
    linea2: Optional[str] = Field(default=None, max_length=255)
    ciudad: str = Field(min_length=2, max_length=100)
    provincia: str = Field(min_length=2, max_length=100)
    codigo_postal: str = Field(min_length=2, max_length=20)
    es_principal: bool = Field(default=False)


class DireccionEntregaUpdate(SQLModel):
    alias: Optional[str] = Field(default=None, min_length=2, max_length=100)
    linea1: Optional[str] = Field(default=None, min_length=5, max_length=255)
    linea2: Optional[str] = None
    ciudad: Optional[str] = Field(default=None, min_length=2, max_length=100)
    provincia: Optional[str] = Field(default=None, min_length=2, max_length=100)
    codigo_postal: Optional[str] = Field(default=None, min_length=2, max_length=20)
    es_principal: Optional[bool] = None


class DireccionEntregaPublic(SQLModel):
    id: int
    alias: str
    linea1: str
    linea2: Optional[str] = None
    ciudad: str
    provincia: str
    codigo_postal: str
    es_principal: bool
    activo: bool


class DireccionEntregaDetail(DireccionEntregaPublic):
    usuario_id: int
    created_at: datetime
    updated_at: datetime


class DireccionEntregaList(SQLModel):
    data: List[DireccionEntregaPublic]
    total: int
