from typing import Annotated

from fastapi import APIRouter, Depends, Query, status, WebSocket, WebSocketDisconnect
from sqlmodel import Session

from app.core.deps import get_current_active_user, require_roles
from app.core.database import get_session
from app.core.rbac import ROLE_ADMIN, ROLE_STOCK
from app.core.websocket import manager
from app.modules.usuarios.schemas import CurrentUser
from app.modules.productos.schemas import (
    LiberarStockRequest,
    ProductoCreate,
    ProductoDisponibilidadUpdate,
    ProductoList,
    ProductoPublic,
    ProductoStockUpdate,
    ProductoUpdate,
    ReservarStockRequest,
)
from app.modules.productos.service import ProductoService

router = APIRouter()

# Router separado para el WebSocket: vive en la raíz (/ws/productos), NO bajo /api/v1.
ws_router = APIRouter()


def get_producto_service(session: Session = Depends(get_session)) -> ProductoService:
    return ProductoService(session)


@router.post("", response_model=ProductoPublic, status_code=status.HTTP_201_CREATED)
async def create_producto(
    data: ProductoCreate,
    _: CurrentUser = Depends(require_roles([ROLE_ADMIN])),
    svc: ProductoService = Depends(get_producto_service),
) -> ProductoPublic:
    return await svc.create(data)


@router.get("", response_model=ProductoList)
def list_productos(
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    include_deleted: bool = Query(default=False),
    categoria_id: int | None = Query(default=None, ge=1),
    disponible: bool | None = Query(default=None),
    q: str | None = Query(default=None, min_length=1),
    _: CurrentUser = Depends(get_current_active_user),
    svc: ProductoService = Depends(get_producto_service),
) -> ProductoList:
    return svc.get_all(
        offset=offset,
        limit=limit,
        include_deleted=include_deleted,
        categoria_id=categoria_id,
        disponible=disponible,
        q=q,
    )


@router.get("/public", response_model=ProductoList)
def list_productos_public(
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    categoria_id: int | None = Query(default=None, ge=1),
    q: str | None = Query(default=None, min_length=1),
    svc: ProductoService = Depends(get_producto_service),
) -> ProductoList:
    return svc.get_public(offset=offset, limit=limit, categoria_id=categoria_id, q=q)


@router.get("/public/{producto_id}", response_model=ProductoPublic)
def get_producto_public(
    producto_id: int,
    svc: ProductoService = Depends(get_producto_service),
) -> ProductoPublic:
    return svc.get_by_id(producto_id)


@router.get("/{producto_id}", response_model=ProductoPublic)
def get_producto(
    producto_id: int,
    _: CurrentUser = Depends(get_current_active_user),
    svc: ProductoService = Depends(get_producto_service),
) -> ProductoPublic:
    return svc.get_by_id(producto_id)


@router.patch("/{producto_id}", response_model=ProductoPublic)
async def update_producto(
    producto_id: int,
    data: ProductoUpdate,
    _: CurrentUser = Depends(require_roles([ROLE_ADMIN])),
    svc: ProductoService = Depends(get_producto_service),
) -> ProductoPublic:
    return await svc.update(producto_id, data)


@router.delete("/{producto_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_producto(
    producto_id: int,
    _: CurrentUser = Depends(require_roles([ROLE_ADMIN])),
    svc: ProductoService = Depends(get_producto_service),
) -> None:
    await svc.soft_delete(producto_id)


@router.patch("/{producto_id}/restore", response_model=ProductoPublic)
async def restore_producto(
    producto_id: int,
    _: CurrentUser = Depends(require_roles([ROLE_ADMIN])),
    svc: ProductoService = Depends(get_producto_service),
) -> ProductoPublic:
    return await svc.restore(producto_id)


@router.patch("/{producto_id}/disponibilidad", response_model=ProductoPublic)
async def update_disponibilidad_producto(
    producto_id: int,
    data: ProductoDisponibilidadUpdate,
    _: CurrentUser = Depends(require_roles([ROLE_ADMIN, ROLE_STOCK])),
    svc: ProductoService = Depends(get_producto_service),
) -> ProductoPublic:
    return await svc.update_disponibilidad(producto_id, data.disponible)


@router.patch("/{producto_id}/stock", response_model=ProductoPublic)
async def update_stock_producto(
    producto_id: int,
    data: ProductoStockUpdate,
    _: CurrentUser = Depends(require_roles([ROLE_ADMIN, ROLE_STOCK])),
    svc: ProductoService = Depends(get_producto_service),
) -> ProductoPublic:
    return await svc.update_stock_manual(producto_id, data.stock_cantidad)


@router.post("/{producto_id}/reservar-stock", response_model=ProductoPublic)
async def reservar_stock_producto(
    producto_id: int,
    data: ReservarStockRequest,
    svc: ProductoService = Depends(get_producto_service),
) -> ProductoPublic:
    return await svc.reservar_stock(producto_id, data.cantidad)


@router.post("/{producto_id}/liberar-stock", response_model=ProductoPublic)
async def liberar_stock_producto(
    producto_id: int,
    data: LiberarStockRequest,
    svc: ProductoService = Depends(get_producto_service),
) -> ProductoPublic:
    return await svc.liberar_stock(producto_id, data.cantidad)


@ws_router.websocket("/ws/productos")
async def productos_websocket(
    websocket: WebSocket,
    tab_id: str | None = Query(default=None, alias="tab_id"),
):
    await manager.connect(websocket, tab_id=tab_id or "")
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)
