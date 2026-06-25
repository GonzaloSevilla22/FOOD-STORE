"""Repositorio de estadísticas.

Toda consulta a la base de datos para los reportes vive aquí. El service solo
orquesta y arma los DTOs de respuesta; no habla directamente con la sesión.
"""

from datetime import datetime
from decimal import Decimal
from typing import Optional, Sequence

from sqlmodel import Session, func, select, text

from app.modules.payments.models import Pago
from app.modules.pedidos.models import DetallePedido, Pedido


class EstadisticasRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    # ------------------------------------------------------------------
    # Conteos / sumas (ORM)
    # ------------------------------------------------------------------
    def contar_pedidos(self, *, desde: Optional[datetime] = None) -> int:
        """Cantidad de pedidos no eliminados, opcionalmente desde una fecha."""
        statement = select(func.count(Pedido.id)).where(Pedido.deleted_at.is_(None))
        if desde is not None:
            statement = statement.where(Pedido.created_at >= desde)
        return self.session.exec(statement).one()

    def sumar_pagos_aprobados(
        self,
        *,
        desde: Optional[datetime] = None,
        hasta: Optional[datetime] = None,
    ) -> Decimal:
        """Suma de montos de pagos aprobados en un rango de fechas opcional."""
        statement = select(func.coalesce(func.sum(Pago.monto), 0)).where(
            Pago.estado == "aprobado"
        )
        if desde is not None:
            statement = statement.where(Pago.created_at >= desde)
        if hasta is not None:
            statement = statement.where(Pago.created_at < hasta)
        return Decimal(str(self.session.exec(statement).one()))

    def contar_pedidos_pagados(self) -> int:
        """Cantidad de pedidos con al menos un pago aprobado."""
        statement = (
            select(func.count(Pedido.id))
            .select_from(Pedido)
            .join(Pago, Pago.pedido_id == Pedido.id)
            .where(
                Pedido.deleted_at.is_(None),
                Pago.estado == "aprobado",
            )
        )
        return self.session.exec(statement).one()

    def sumar_cantidad_vendida(self) -> int:
        """Total de unidades vendidas (suma de cantidades en detalles)."""
        statement = (
            select(func.coalesce(func.sum(DetallePedido.cantidad), 0))
            .select_from(DetallePedido)
            .join(Pedido, DetallePedido.pedido_id == Pedido.id)
            .where(Pedido.deleted_at.is_(None))
        )
        return int(self.session.exec(statement).one())

    # ------------------------------------------------------------------
    # Reportes agregados (SQL crudo)
    # ------------------------------------------------------------------
    def ventas_por_dia(self, limit: int = 30) -> Sequence:
        """Ventas agrupadas por día (últimos `limit` días con ventas)."""
        return self.session.exec(
            text(
                """
                SELECT DATE(p.created_at) as fecha,
                       SUM(p.monto) as total,
                       COUNT(p.id) as pedidos
                FROM pagos p
                WHERE p.estado = 'aprobado'
                GROUP BY DATE(p.created_at)
                ORDER BY fecha DESC
                LIMIT :limit
                """
            ).bindparams(limit=limit),
        ).all()

    def productos_mas_vendidos(self, limit: int = 10) -> Sequence:
        """Productos ordenados por cantidad vendida (excluye cancelados)."""
        return self.session.exec(
            text(
                """
                SELECT d.producto_id,
                       d.nombre_snapshot,
                       SUM(d.cantidad) as total_cant,
                       SUM(d.subtotal_snapshot) as total_gen
                FROM detalles_pedido d
                JOIN pedidos p ON p.id = d.pedido_id
                WHERE p.deleted_at IS NULL
                  AND p.estado_codigo != 'CANCELADO'
                GROUP BY d.producto_id, d.nombre_snapshot
                ORDER BY total_cant DESC
                LIMIT :limit
                """
            ).bindparams(limit=limit),
        ).all()

    def conteo_por_estado(self) -> Sequence:
        """Cantidad de pedidos no eliminados agrupados por estado."""
        return self.session.exec(
            text(
                """
                SELECT estado_codigo, COUNT(*) as cantidad
                FROM pedidos
                WHERE deleted_at IS NULL
                GROUP BY estado_codigo
                ORDER BY cantidad DESC
                """
            ),
        ).all()
