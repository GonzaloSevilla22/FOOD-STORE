from fastapi import APIRouter, Depends, Query
from sqlmodel import Session

from app.core.database import get_session
from app.core.deps import get_current_active_user, require_roles
from app.modules.estadisticas.schemas import (
    IngresosResponse,
    PedidosPorEstadoResponse,
    ProductosTopResponse,
    ResumenResponse,
    VentasResponse,
)
from app.modules.estadisticas.service import EstadisticasService

router = APIRouter()


def get_stats_service(session: Session = Depends(get_session)) -> EstadisticasService:
    return EstadisticasService(session)


@router.get("/resumen", response_model=ResumenResponse)
def resumen(
    svc: EstadisticasService = Depends(get_stats_service),
    _=Depends(require_roles(["ADMIN"])),
):
    return svc.resumen()


@router.get("/ventas", response_model=VentasResponse)
def ventas(
    svc: EstadisticasService = Depends(get_stats_service),
    _=Depends(require_roles(["ADMIN", "PEDIDOS"])),
):
    return svc.ventas()


@router.get("/productos-top", response_model=ProductosTopResponse)
def productos_top(
    limit: int = Query(default=10, ge=1, le=50),
    svc: EstadisticasService = Depends(get_stats_service),
    _=Depends(require_roles(["ADMIN", "PEDIDOS"])),
):
    return svc.productos_top(limit)


@router.get("/pedidos-por-estado", response_model=PedidosPorEstadoResponse)
def pedidos_por_estado(
    svc: EstadisticasService = Depends(get_stats_service),
    _=Depends(require_roles(["ADMIN", "PEDIDOS"])),
):
    return svc.pedidos_por_estado()


@router.get("/ingresos", response_model=IngresosResponse)
def ingresos(
    svc: EstadisticasService = Depends(get_stats_service),
    _=Depends(require_roles(["ADMIN", "PEDIDOS"])),
):
    return svc.ingresos()
