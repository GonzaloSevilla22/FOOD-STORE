from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlmodel import SQLModel


class ResumenResponse(SQLModel):
    total_pedidos: int
    pedidos_hoy: int
    ingresos_totales: Decimal
    ingresos_hoy: Decimal
    ticket_promedio: Decimal
    productos_vendidos: int


class VentaItem(SQLModel):
    fecha: datetime
    total: Decimal
    pedidos: int


class VentasResponse(SQLModel):
    data: list[VentaItem]


class ProductoTopItem(SQLModel):
    producto_id: int
    nombre: str
    cantidad_vendida: int
    total_generado: Decimal


class ProductosTopResponse(SQLModel):
    data: list[ProductoTopItem]


class PedidosPorEstadoItem(SQLModel):
    estado: str
    cantidad: int
    porcentaje: float


class PedidosPorEstadoResponse(SQLModel):
    data: list[PedidosPorEstadoItem]


class IngresosResponse(SQLModel):
    total_ingresos: Decimal
    ingresos_mes_actual: Decimal
    ingresos_mes_anterior: Decimal
    variacion_porcentual: Optional[float] = None
