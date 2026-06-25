from typing import List, Optional
from datetime import datetime

from sqlmodel import Field, SQLModel


class CategoriaCreate(SQLModel):
    nombre: str = Field(min_length=2, max_length=100)
    descripcion: Optional[str] = None
    orden_display: int = Field(default=0, ge=0)
    parent_id: Optional[int] = None


class CategoriaUpdate(SQLModel):
    nombre: Optional[str] = Field(default=None, min_length=2, max_length=100)
    descripcion: Optional[str] = None
    orden_display: Optional[int] = Field(default=None, ge=0)
    parent_id: Optional[int] = None


class CategoriaPublic(SQLModel):
    id: int
    nombre: str
    descripcion: Optional[str] = None
    orden_display: int
    parent_id: Optional[int] = None
    activo: bool
    deleted_at: Optional[datetime] = None


class CategoriaMini(SQLModel):
    id: int
    nombre: str
    activo: bool


class CategoriaProductoInfo(SQLModel):
    producto_id: int
    producto_nombre: str
    activo: bool


class CategoriaDetail(CategoriaPublic):
    parent: Optional[CategoriaMini] = None
    subcategorias: List[CategoriaMini] = Field(default_factory=list)
    productos_asociados: List[CategoriaProductoInfo] = Field(default_factory=list)


class CategoriaList(SQLModel):
    data: List[CategoriaPublic]
    total: int
