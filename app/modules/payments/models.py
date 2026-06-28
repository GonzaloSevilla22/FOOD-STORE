from decimal import Decimal
from typing import Optional

from sqlalchemy import BigInteger
from sqlmodel import Field

from app.core.base import BaseModel


class Pago(BaseModel, table=True):
    __tablename__ = "pagos"

    id: Optional[int] = Field(default=None, primary_key=True)
    pedido_id: int = Field(foreign_key="pedidos.id", nullable=False, index=True)
    monto: Decimal = Field(default=0, ge=0, max_digits=10, decimal_places=2, nullable=False)

    # Estado local: pendiente → aprobado | rechazado
    estado: str = Field(max_length=20, default="pendiente")

    # Datos de la preferencia (se crean al llamar a create-preference)
    mp_preference_id: Optional[str] = Field(default=None, max_length=255)
    mp_init_point: Optional[str] = Field(default=None, max_length=500)

    # Datos del pago real (llegan por webhook)
    mp_payment_id: Optional[int] = Field(default=None, sa_type=BigInteger)
    mp_merchant_order_id: Optional[int] = Field(default=None, sa_type=BigInteger)
    mp_status: Optional[str] = Field(default=None, max_length=50)
    mp_status_detail: Optional[str] = Field(default=None, max_length=100)

    # Control de idempotencia
    idempotency_key: str = Field(max_length=36, unique=True)

    # Campos adicionales de compatibilidad
    transaction_amount: Decimal = Field(default=0, ge=0, max_digits=10, decimal_places=2)
    payment_method_id: Optional[str] = Field(default=None, max_length=50)
    external_reference: Optional[str] = Field(default=None, max_length=255)
