from decimal import Decimal
from datetime import datetime
from typing import List, Optional

from sqlmodel import Field, SQLModel


class ProductoIngredienteSchema(SQLModel):
    """Schema para ingrediente dentro de un producto.

    `unidad_medida_id` es FK → UnidadMedida (consigna ERD v7). `unidad_simbolo`
    es de solo-lectura: se completa en las respuestas para mostrar en el front.
    """
    ingrediente_id: int
    cantidad: Decimal = Field(gt=0, max_digits=10, decimal_places=3)
    unidad_medida_id: int
    unidad_simbolo: Optional[str] = None
    es_removible: bool = True
    es_opcional: bool = False


class ProductoCreate(SQLModel):
    nombre: str = Field(min_length=2, max_length=150)
    descripcion: Optional[str] = None
    precio_base: Decimal = Field(default=0, ge=0, max_digits=10, decimal_places=2)
    imagenes_url: Optional[List[str]] = None
    tiempo_prep_min: Optional[int] = Field(default=None, ge=0)
    disponible: bool = True
    usa_stock_manual: bool = False
    stock_manual: Optional[int] = Field(default=None, ge=0)
    costo_compra_manual: Optional[Decimal] = Field(default=None, ge=0, max_digits=10, decimal_places=4)
    categoria_id: Optional[int] = None
    ingredientes: List[ProductoIngredienteSchema] = Field(default_factory=list)


class ProductoUpdate(SQLModel):
    nombre: Optional[str] = Field(default=None, min_length=2, max_length=150)
    descripcion: Optional[str] = None
    precio_base: Optional[Decimal] = Field(default=None, ge=0, max_digits=10, decimal_places=2)
    imagenes_url: Optional[List[str]] = None
    tiempo_prep_min: Optional[int] = Field(default=None, ge=0)
    disponible: Optional[bool] = None
    usa_stock_manual: Optional[bool] = None
    stock_manual: Optional[int] = Field(default=None, ge=0)
    costo_compra_manual: Optional[Decimal] = Field(default=None, ge=0, max_digits=10, decimal_places=4)
    categoria_id: Optional[int] = None
    ingredientes: Optional[List[ProductoIngredienteSchema]] = None


class ProductoPublic(SQLModel):
    id: int
    nombre: str
    descripcion: Optional[str] = None
    precio_base: Decimal
    imagenes_url: Optional[List[str]] = None
    tiempo_prep_min: Optional[int] = None
    disponible: bool
    usa_stock_manual: bool
    stock_manual: Optional[int] = None
    costo_compra_manual: Optional[Decimal] = None
    categoria_id: Optional[int] = None
    categoria_nombre: Optional[str] = None
    ingredientes: List[ProductoIngredienteSchema] = Field(default_factory=list)
    stock_disponible: Optional[int] = None
    costo_total_ingredientes: Decimal = Field(default=Decimal("0"), max_digits=12, decimal_places=4)
    precio_sugerido: Decimal = Field(default=Decimal("0"), max_digits=12, decimal_places=4)
    margen_estimado: Decimal = Field(default=Decimal("0"), max_digits=12, decimal_places=4)
    activo: bool
    deleted_at: Optional[datetime] = None


class ProductoList(SQLModel):
    data: List[ProductoPublic]
    total: int


class ProductoDisponibilidadUpdate(SQLModel):
    disponible: bool


class ProductoStockUpdate(SQLModel):
    stock_cantidad: int = Field(ge=0)


class ReservarStockRequest(SQLModel):
    cantidad: int = Field(default=1, ge=1)


class LiberarStockRequest(SQLModel):
    cantidad: int = Field(default=1, ge=1)
