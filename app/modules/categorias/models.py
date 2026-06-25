from datetime import datetime
from typing import TYPE_CHECKING, List, Optional

from sqlmodel import Field, Relationship, SQLModel

from app.core.base import BaseModel, now_utc

if TYPE_CHECKING:
    from app.modules.productos.models import Producto


class ProductoCategoria(SQLModel, table=True):
    """
    Tabla intermedia N:M entre Producto y Categoria.
    PK compuesta, es_principal flag, Relationships bidireccionales.
    """

    __tablename__ = "productos_categorias"

    producto_id: int = Field(foreign_key="productos.id", primary_key=True, nullable=False)
    categoria_id: int = Field(foreign_key="categorias.id", primary_key=True, nullable=False)
    es_principal: bool = Field(default=False, nullable=False)
    created_at: datetime = Field(default_factory=now_utc, nullable=False)

    producto: "Producto" = Relationship(back_populates="productos_categorias")
    categoria: "Categoria" = Relationship(back_populates="productos_categorias")


class Categoria(BaseModel, table=True):
    """
    Categoría de productos con jerarquía (parent_id auto-referencia).
    Soporta N:M con Producto mediante ProductoCategoria.
    """

    __tablename__ = "categorias"

    id: Optional[int] = Field(default=None, primary_key=True)
    nombre: str = Field(max_length=100, unique=True, index=True, nullable=False)
    descripcion: Optional[str] = Field(default=None, nullable=True)
    orden_display: int = Field(default=0, nullable=False)
    activo: bool = Field(default=True, nullable=False)
    imagen_url: Optional[str] = Field(default=None, max_length=500)

    parent_id: Optional[int] = Field(default=None, foreign_key="categorias.id", nullable=True)
    parent: Optional["Categoria"] = Relationship(
        back_populates="subcategorias",
        sa_relationship_kwargs={"remote_side": "Categoria.id"},
    )
    subcategorias: List["Categoria"] = Relationship(back_populates="parent")

    # N:M hacia Productos
    productos_categorias: List[ProductoCategoria] = Relationship(back_populates="categoria")
