from decimal import Decimal
from enum import Enum
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import Column
from sqlmodel import JSON, Field, Relationship, SQLModel

from app.core.base import BaseModel
from app.modules.categorias.models import ProductoCategoria

if TYPE_CHECKING:
    from app.modules.ingredientes.models import Ingrediente, UnidadMedida


class UnidadEnum(str, Enum):
    """Unidades de medida para ingredientes."""
    GRAMOS = "gramos"
    MILILITROS = "mililitros"
    KILOS = "kilos"
    LITROS = "litros"
    UNIDADES = "unidades"
    PORCIONES = "porciones"


class ProductoIngrediente(SQLModel, table=True):
    """
    Tabla intermedia N:M entre Producto e Ingrediente.
    Incluye cantidad (DECIMAL 10,3) y la unidad de medida por FK (consigna ERD v7 §5).
    PK compuesta.

    Ejemplo: Pizza (id=1) + Queso (id=5) = 500.000 g (unidad_medida_id → UnidadMedida).
    """

    __tablename__ = "productos_ingredientes"

    producto_id: int = Field(foreign_key="productos.id", primary_key=True, nullable=False)
    ingrediente_id: int = Field(foreign_key="ingredientes.id", primary_key=True, nullable=False)
    cantidad: Decimal = Field(gt=0, max_digits=10, decimal_places=3, nullable=False)
    unidad_medida_id: int = Field(foreign_key="unidades_medida.id", nullable=False)
    es_removible: bool = Field(default=False, nullable=False)
    es_opcional: bool = Field(default=False, nullable=False)

    producto: "Producto" = Relationship(back_populates="productos_ingredientes")
    ingrediente: "Ingrediente" = Relationship(back_populates="productos_ingredientes")
    unidad_medida: "UnidadMedida" = Relationship()


class Producto(BaseModel, table=True):
    """
    Producto del catálogo.
    Relaciones N:M: con Categoria (via ProductoCategoria) e Ingrediente (via ProductoIngrediente).
    SIN FK directo a Categoria.
    """

    __tablename__ = "productos"

    id: Optional[int] = Field(default=None, primary_key=True)
    nombre: str = Field(max_length=150, index=True, nullable=False)
    descripcion: Optional[str] = Field(default=None, nullable=True)
    precio_base: Decimal = Field(default=0, ge=0, max_digits=10, decimal_places=2, nullable=False)
    imagenes_url: Optional[List[str]] = Field(default=None, sa_column=Column(JSON))
    tiempo_prep_min: Optional[int] = Field(default=None, ge=0, nullable=True)
    disponible: bool = Field(default=True, nullable=False)
    stock_cantidad: Optional[int] = Field(default=None, ge=0, nullable=True)
    unidad_venta_id: Optional[int] = Field(default=None, foreign_key="unidades_medida.id")
    usa_stock_manual: bool = Field(default=False, nullable=False)
    stock_manual: Optional[int] = Field(default=None, ge=0, nullable=True)
    costo_compra_manual: Optional[Decimal] = Field(
        default=None,
        ge=0,
        max_digits=10,
        decimal_places=4,
        nullable=True,
    )
    activo: bool = Field(default=True, nullable=False)

    # N:M hacia Categorias
    productos_categorias: List[ProductoCategoria] = Relationship(
        back_populates="producto", cascade_delete=True
    )

    # N:M hacia Ingredientes
    productos_ingredientes: List[ProductoIngrediente] = Relationship(
        back_populates="producto", cascade_delete=True
    )
