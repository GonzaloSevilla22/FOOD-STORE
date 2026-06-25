from decimal import Decimal
from typing import List, Optional
from datetime import datetime

from sqlmodel import Field, SQLModel

from app.modules.productos.models import UnidadEnum


class IngredienteCreate(SQLModel):
    nombre: str = Field(min_length=2, max_length=100)
    descripcion: Optional[str] = None
    es_alergeno: bool = False
    stock_actual: float = Field(default=0, ge=0)
    stock_minimo: float = Field(default=0, ge=0)
    costo_unitario: Decimal = Field(default=Decimal("0"), ge=0, max_digits=10, decimal_places=4)
    unidad_medida: UnidadEnum = Field(default=UnidadEnum.GRAMOS)


class IngredienteUpdate(SQLModel):
    nombre: Optional[str] = Field(default=None, min_length=2, max_length=100)
    descripcion: Optional[str] = None
    es_alergeno: Optional[bool] = None
    stock_actual: Optional[float] = Field(default=None, ge=0)
    stock_minimo: Optional[float] = Field(default=None, ge=0)
    costo_unitario: Optional[Decimal] = Field(default=None, ge=0, max_digits=10, decimal_places=4)
    unidad_medida: Optional[UnidadEnum] = None


class IngredientePublic(SQLModel):
    id: int
    nombre: str
    descripcion: Optional[str] = None
    es_alergeno: bool
    stock_actual: float
    stock_minimo: float
    costo_unitario: Decimal
    unidad_medida: UnidadEnum
    activo: bool
    deleted_at: Optional[datetime] = None


class IngredienteProductoUso(SQLModel):
    producto_id: int
    producto_nombre: str
    cantidad: Decimal
    unidad_medida_id: int
    unidad_simbolo: Optional[str] = None


class IngredienteDetail(IngredientePublic):
    productos_relacionados: List[IngredienteProductoUso] = Field(default_factory=list)


class IngredienteList(SQLModel):
    data: List[IngredientePublic]
    total: int


class UnidadMedidaPublic(SQLModel):
    id: int
    nombre: str
    simbolo: str
    tipo: str
