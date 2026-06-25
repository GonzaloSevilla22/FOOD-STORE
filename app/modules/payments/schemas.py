from typing import Optional
from decimal import Decimal
from sqlmodel import SQLModel, Field


class CrearPagoRequest(SQLModel):
    pedido_id: int = Field(..., description="ID del pedido a pagar")


class ConfirmarPagoRequest(SQLModel):
    pedido_id: int = Field(..., description="ID del pedido")
    payment_id: Optional[int] = Field(default=None, description="ID del pago en MP")


class PagoCrearResponse(SQLModel):
    pago_id: int
    preference_id: str
    init_point: Optional[str] = None
    public_key: Optional[str] = None


class PagoEstadoResponse(SQLModel):
    estado: Optional[str] = None
    pedido_id: int


class ManualAprobarRequest(SQLModel):
    pedido_id: int = Field(..., description="ID del pedido")
    mp_payment_id: Optional[int] = Field(default=None, description="ID del pago en MP (opcional, para consultar)")


class PagoPublic(SQLModel):
    id: int
    pedido_id: int
    monto: Decimal
    estado: str
    mp_preference_id: Optional[str] = None
    mp_init_point: Optional[str] = None
    mp_payment_id: Optional[int] = None
    mp_merchant_order_id: Optional[int] = None
    mp_status: Optional[str] = None
    mp_status_detail: Optional[str] = None
    created_at: Optional[str] = None
