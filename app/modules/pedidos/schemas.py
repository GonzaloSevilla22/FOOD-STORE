from typing import List, Optional
from datetime import datetime
from decimal import Decimal

from sqlmodel import Field, SQLModel


# ============================================================================
# ESTADO PEDIDO SCHEMAS
# ============================================================================

class EstadoPedidoCreate(SQLModel):
    codigo: str = Field(min_length=2, max_length=50)
    nombre: str = Field(min_length=2, max_length=100)
    descripcion: Optional[str] = None


class EstadoPedidoPublic(SQLModel):
    codigo: str
    nombre: str
    descripcion: Optional[str] = None


# ============================================================================
# DETALLE PEDIDO SCHEMAS
# ============================================================================

class DetallePedidoCreate(SQLModel):
    producto_id: int = Field(ge=1)
    cantidad: int = Field(ge=1)


class DetallePedidoPublic(SQLModel):
    id: int
    producto_id: int
    cantidad: int
    nombre_snapshot: str
    precio_snapshot: Decimal
    subtotal_snapshot: Decimal
    personalizacion: Optional[str] = None


class DetallePedidoDetail(DetallePedidoPublic):
    created_at: datetime
    updated_at: datetime


# ============================================================================
# PEDIDO SCHEMAS
# ============================================================================

class PedidoCreate(SQLModel):
    """
    Crear pedido con:
    - direccion_entrega_id: dirección de envío
    - detalles: lista de productos (producto_id, cantidad)
    - descuento: descuento aplicado (opcional)
    - notas: notas del cliente (opcional)
    """
    direccion_entrega_id: int = Field(ge=1)
    forma_pago_codigo: Optional[str] = Field(default=None, max_length=50)
    detalles: List[DetallePedidoCreate] = Field(min_length=1, max_length=100)
    descuento: Decimal = Field(default=0, ge=0, max_digits=10, decimal_places=2)
    notas: Optional[str] = Field(default=None, max_length=500)


class PedidoUpdate(SQLModel):
    """Solo permite actualizar notas (lógica de estado está en transiciones)"""
    notas: Optional[str] = Field(default=None, max_length=500)


class CambiarDireccionPedidoInput(SQLModel):
    """Input para cambiar la dirección de entrega de un pedido"""
    direccion_entrega_id: int = Field(ge=1)


class PedidoPublic(SQLModel):
    id: int
    usuario_id: int
    direccion_entrega_id: int
    forma_pago_codigo: Optional[str] = None
    estado_codigo: str
    subtotal: Decimal
    descuento: Decimal
    costo_envio: Decimal
    total: Decimal
    notas: Optional[str] = None
    created_at: Optional[datetime] = None
    pago_estado: Optional[str] = None
    pago_mp_status: Optional[str] = None
    motivo: Optional[str] = None


class PedidoDetail(PedidoPublic):
    created_at: datetime
    updated_at: datetime
    estado: EstadoPedidoPublic
    detalles: List[DetallePedidoPublic] = Field(default_factory=list)
    pago_estado: Optional[str] = None
    pago_mp_status: Optional[str] = None
    pago_mp_payment_id: Optional[int] = None


class PedidoList(SQLModel):
    data: List[PedidoPublic]
    total: int


# ============================================================================
# HISTORIAL ESTADO PEDIDO SCHEMAS
# ============================================================================

class HistorialEstadoPedidoPublic(SQLModel):
    id: int
    pedido_id: int
    estado_desde_codigo: str
    estado_hacia_codigo: str
    usuario_id: Optional[int] = None
    motivo: Optional[str] = None
    fecha: datetime


class HistorialEstadoPedidoList(SQLModel):
    data: List[HistorialEstadoPedidoPublic]


# ============================================================================
# PEDIDO OPERATIONS SCHEMAS
# ============================================================================

class CambiarEstadoPedidoRequest(SQLModel):
    """Request para cambiar estado de pedido"""
    estado_codigo: str = Field(min_length=2, max_length=50)
    motivo: Optional[str] = Field(default=None, max_length=500)


class ConfirmarPedidoInput(SQLModel):
    """Input para confirmar pedido"""
    forma_pago_codigo: Optional[str] = Field(default=None, max_length=50)


class ConfirmarPedidoResponse(SQLModel):
    """Response al confirmar pedido"""
    id: int
    estado_codigo: str
    total: Decimal
    detalles: List[DetallePedidoPublic]
    mensaje: str
