from datetime import datetime, timezone
from decimal import Decimal

from sqlmodel import Session

from app.modules.estadisticas.repository import EstadisticasRepository
from app.modules.estadisticas.schemas import (
    IngresosResponse,
    PedidosPorEstadoItem,
    PedidosPorEstadoResponse,
    ProductoTopItem,
    ProductosTopResponse,
    ResumenResponse,
    VentaItem,
    VentasResponse,
)


class EstadisticasService:
    def __init__(self, session: Session) -> None:
        self._repo = EstadisticasRepository(session)

    def resumen(self) -> ResumenResponse:
        hoy = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

        total_pedidos = self._repo.contar_pedidos()
        pedidos_hoy = self._repo.contar_pedidos(desde=hoy)
        ingresos_totales = self._repo.sumar_pagos_aprobados()
        ingresos_hoy = self._repo.sumar_pagos_aprobados(desde=hoy)
        pedidos_pagados = self._repo.contar_pedidos_pagados()

        ticket_promedio = (
            ingresos_totales / Decimal(pedidos_pagados) if pedidos_pagados > 0 else Decimal("0")
        )
        productos_vendidos = self._repo.sumar_cantidad_vendida()

        return ResumenResponse(
            total_pedidos=total_pedidos,
            pedidos_hoy=pedidos_hoy,
            ingresos_totales=ingresos_totales,
            ingresos_hoy=ingresos_hoy,
            ticket_promedio=ticket_promedio,
            productos_vendidos=productos_vendidos,
        )

    def ventas(self) -> VentasResponse:
        rows = self._repo.ventas_por_dia()
        items = [
            VentaItem(fecha=row[0], total=Decimal(str(row[1])), pedidos=row[2])
            for row in rows
        ]
        return VentasResponse(data=items)

    def productos_top(self, limit: int = 10) -> ProductosTopResponse:
        rows = self._repo.productos_mas_vendidos(limit)
        items = [
            ProductoTopItem(
                producto_id=row[0],
                nombre=row[1],
                cantidad_vendida=int(row[2]),
                total_generado=Decimal(str(row[3])),
            )
            for row in rows
        ]
        return ProductosTopResponse(data=items)

    def pedidos_por_estado(self) -> PedidosPorEstadoResponse:
        total = self._repo.contar_pedidos()
        rows = self._repo.conteo_por_estado()

        total_f = float(total)
        items = [
            PedidosPorEstadoItem(
                estado=row[0],
                cantidad=row[1],
                porcentaje=round((row[1] / total_f * 100), 2) if total_f > 0 else 0,
            )
            for row in rows
        ]
        return PedidosPorEstadoResponse(data=items)

    def ingresos(self) -> IngresosResponse:
        total_ingresos = self._repo.sumar_pagos_aprobados()

        now = datetime.now(timezone.utc)
        inicio_mes = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        if inicio_mes.month == 1:
            inicio_mes_anterior = inicio_mes.replace(year=inicio_mes.year - 1, month=12)
        else:
            inicio_mes_anterior = inicio_mes.replace(month=inicio_mes.month - 1)

        ingresos_mes = self._repo.sumar_pagos_aprobados(desde=inicio_mes)
        ingresos_anterior = self._repo.sumar_pagos_aprobados(
            desde=inicio_mes_anterior, hasta=inicio_mes
        )

        variacion = None
        if ingresos_anterior > 0:
            variacion = round(
                float((ingresos_mes - ingresos_anterior) / ingresos_anterior * 100),
                2,
            )

        return IngresosResponse(
            total_ingresos=total_ingresos,
            ingresos_mes_actual=ingresos_mes,
            ingresos_mes_anterior=ingresos_anterior,
            variacion_porcentual=variacion,
        )
