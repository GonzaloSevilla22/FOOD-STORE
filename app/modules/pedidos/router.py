"""Pedidos Router: gestión de pedidos y updates en vivo por websocket."""

import asyncio
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, status
from fastapi.responses import StreamingResponse
from sqlmodel import Session

from app.core.config import settings
from app.core.deps import get_current_active_user, require_roles
from app.core.database import get_session
from app.core.rbac import ROLE_ADMIN, ROLE_CLIENT, ROLE_PEDIDOS, normalize_role
from app.core.security import decode_access_token
from app.core.sse import sse_manager
from app.core.websocket import ADMIN_CHANNEL, manager, pedido_channel, role_channel
from app.modules.pedidos.pedido_repository import PedidoRepository
from app.modules.pedidos.service import PedidoService
from app.modules.pedidos.schemas import (
    CambiarDireccionPedidoInput,
    PedidoCreate,
    PedidoPublic,
    PedidoDetail,
    PedidoList,
    ConfirmarPedidoInput,
    ConfirmarPedidoResponse,
    HistorialEstadoPedidoList,
    CambiarEstadoPedidoRequest,
)
from app.modules.usuarios.repository import UsuarioRepository
from app.modules.usuarios.schemas import CurrentUser

router = APIRouter()

# Router separado para el WebSocket: vive en la raíz (/ws/pedidos), NO bajo /api/v1
# (consigna §6: "Los endpoints WebSocket se documentan por separado" — §9.1).
ws_router = APIRouter()


def get_pedido_service(session: Session = Depends(get_session)) -> PedidoService:
    """Dependency para obtener el PedidoService."""
    return PedidoService(session)


# ============================================================================
# CREAR PEDIDO
# ============================================================================

@router.post("", response_model=ConfirmarPedidoResponse, status_code=status.HTTP_201_CREATED)
async def crear_pedido(
    data: PedidoCreate,
    current_user: CurrentUser = Depends(require_roles([ROLE_CLIENT, ROLE_ADMIN])),
    svc: PedidoService = Depends(get_pedido_service),
) -> ConfirmarPedidoResponse:
    """
    Crear nuevo pedido.
    
    Requiere token JWT válido (usuario autenticado).
    
    Parámetros:
    - **direccion_entrega_id**: ID de la dirección de envío
    - **detalles**: Lista de productos con cantidad
      - **producto_id**: ID del producto
      - **cantidad**: Cantidad a pedir (mínimo 1)
    - **descuento**: Descuento a aplicar (opcional, default: 0)
    - **notas**: Notas especiales del cliente (opcional)
    
    El pedido se crea en estado PENDIENTE.
    Se validarán:
    - Stock disponible
    - Disponibilidad del producto
    - Dirección válida del usuario
    """
    return await svc.crear_pedido(current_user.id, data)


# ============================================================================
# OBTENER PEDIDOS
# ============================================================================

@router.get("", response_model=PedidoList)
def list_pedidos(
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    estado: Optional[str] = Query(default=None, description="Filtrar por estado (PENDIENTE, PAGADO, EN_PREPARACION, TERMINADO, ENTREGADO, CANCELADO)"),
    forma_pago: Optional[str] = Query(default=None, alias="forma_pago", description="Filtrar por forma de pago (EFECTIVO, MERCADOPAGO, TRANSFERENCIA)"),
    fecha_desde: Optional[datetime] = Query(default=None, alias="fecha_desde", description="Filtrar desde fecha (ISO 8601)"),
    fecha_hasta: Optional[datetime] = Query(default=None, alias="fecha_hasta", description="Filtrar hasta fecha (ISO 8601)"),
    current_user: CurrentUser = Depends(get_current_active_user),
    svc: PedidoService = Depends(get_pedido_service),
) -> PedidoList:
    """
    Listar pedidos.

    - ADMIN/PEDIDOS: devuelve todos los pedidos (con filtros opcionales).
    - CLIENT: devuelve solo los del usuario autenticado (filtros ignorados).

    Filtros (solo ADMIN/PEDIDOS):
    - **estado**: filtrar por estado del pedido
    - **forma_pago**: filtrar por forma de pago
    - **fecha_desde**: filtrar desde fecha (ISO 8601)
    - **fecha_hasta**: filtrar hasta fecha (ISO 8601)
    """
    return svc.list_pedidos(
        current_user.id,
        offset=offset,
        limit=limit,
        roles=current_user.roles,
        estado=estado,
        forma_pago=forma_pago,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
    )


@router.get("/{pedido_id}", response_model=PedidoDetail)
def get_pedido(
    pedido_id: int,
    current_user: CurrentUser = Depends(get_current_active_user),
    svc: PedidoService = Depends(get_pedido_service),
) -> PedidoDetail:
    """
    Obtener detalle completo del pedido.
    
    Requiere token JWT válido.
    Solo el propietario del pedido puede verlo.
    
    Parámetros:
    - **pedido_id**: ID del pedido
    
    Retorna:
    - Estado actual del pedido
    - Detalles de productos (con snapshots)
    - Cálculos de subtotal, descuento, envío y total
    - Información de envío
    """
    return svc.get_pedido(current_user.id, pedido_id, current_user.roles)


# ============================================================================
# CAMBIAR DIRECCIÓN DE ENTREGA
# ============================================================================

@router.patch("/{pedido_id}/direccion", response_model=PedidoDetail)
def cambiar_direccion_pedido(
    pedido_id: int,
    data: CambiarDireccionPedidoInput,
    current_user: CurrentUser = Depends(require_roles([ROLE_CLIENT, ROLE_ADMIN])),
    svc: PedidoService = Depends(get_pedido_service),
) -> PedidoDetail:
    """
    Cambiar la dirección de entrega de un pedido pendiente.
    
    Solo se puede cambiar si el pedido está en estado PENDIENTE.
    La dirección debe pertenecer al usuario.
    """
    return svc.cambiar_direccion(current_user.id, pedido_id, data.direccion_entrega_id)


@router.patch("/{pedido_id}/items", response_model=PedidoDetail)
async def actualizar_items_pedido(
    pedido_id: int,
    data: PedidoCreate,
    current_user: CurrentUser = Depends(require_roles([ROLE_CLIENT])),
    svc: PedidoService = Depends(get_pedido_service),
) -> PedidoDetail:
    """
    Actualizar items de un pedido pendiente.

    Reemplaza todos los detalles del pedido con los nuevos items.
    El pedido debe estar en estado PENDIENTE y pertenecer al usuario.
    """
    return await svc.actualizar_items_pedido(current_user.id, pedido_id, data)


# ============================================================================
# OPERACIONES EN PEDIDOS
# ============================================================================

@router.patch("/{pedido_id}/confirmar", response_model=ConfirmarPedidoResponse)
async def confirmar_pedido(
    pedido_id: int,
    data: ConfirmarPedidoInput,
    current_user: CurrentUser = Depends(require_roles([ROLE_ADMIN, ROLE_PEDIDOS, ROLE_CLIENT])),
    svc: PedidoService = Depends(get_pedido_service),
) -> ConfirmarPedidoResponse:
    """
    Confirmar pedido (transición: PENDIENTE → PAGADO).
    
    Requiere token JWT válido.
    
    Lógica:
    - Valida que el pedido está en estado PENDIENTE
    - Descuenta stock de cada producto
    - Cambia estado a PAGADO
    - Registra transición en historial
    
    Parámetros:
    - **pedido_id**: ID del pedido
    """
    return await svc.confirmar_pedido(current_user.id, pedido_id, data.forma_pago_codigo)


@router.patch("/{pedido_id}/cancelar", response_model=PedidoDetail)
async def cancelar_pedido(
    pedido_id: int,
    motivo: str | None = Query(default=None, max_length=500),
    current_user: CurrentUser = Depends(require_roles([ROLE_CLIENT, ROLE_ADMIN, ROLE_PEDIDOS])),
    svc: PedidoService = Depends(get_pedido_service),
) -> PedidoDetail:
    """
    Cancelar pedido.
    
    Requiere token JWT válido.
    
    Lógica:
    - Valida que el pedido está en estado PENDIENTE o PAGADO
    - Si estaba confirmado, restaura stock de cada producto
    - Cambia estado a CANCELADO
    - Registra transición en historial
    
    Parámetros:
    - **pedido_id**: ID del pedido
    - **motivo**: Razón de cancelación (opcional)
    """
    return await svc.cancelar_pedido(current_user.id, pedido_id, current_user.roles, motivo)


@router.patch("/{pedido_id}/recibir", response_model=PedidoDetail)
async def recibir_pedido(
    pedido_id: int,
    current_user: CurrentUser = Depends(require_roles([ROLE_CLIENT])),
    svc: PedidoService = Depends(get_pedido_service),
) -> PedidoDetail:
    """
    Marcar pedido como recibido por el cliente.
    
    Requiere token JWT (CLIENT).
    Solo el dueño del pedido puede marcarlo como recibido.
    El pedido debe estar en estado CONFIRMADO o EN_PREP.
    """
    return await svc.recibir_pedido(current_user.id, pedido_id)


# ============================================================================
# CAMBIO DE ESTADO (ADMIN)
# ============================================================================

@router.patch("/{pedido_id}/estado", response_model=PedidoDetail)
async def cambiar_estado_pedido(
    pedido_id: int,
    data: CambiarEstadoPedidoRequest,
    current_user: CurrentUser = Depends(require_roles([ROLE_ADMIN, ROLE_PEDIDOS])),
    svc: PedidoService = Depends(get_pedido_service),
) -> PedidoDetail:
    """
    Cambiar estado del pedido (operación administrativa).
    
    Requiere token JWT válido (idealmente con rol ADMIN).
    
    Transiciones permitidas:
    - PENDIENTE → PAGADO, CANCELADO
    - PAGADO → EN_PREPARACION, CANCELADO
    - EN_PREPARACION → TERMINADO, CANCELADO
    - TERMINADO → ENTREGADO
    - ENTREGADO → (ninguno)
    - CANCELADO → (ninguno)
    
    Parámetros:
    - **pedido_id**: ID del pedido
    - **estado_codigo**: Nuevo estado (e.g., PAGADO, EN_PREPARACION, TERMINADO, ENTREGADO)
    - **motivo**: Razón del cambio (opcional)
    """
    return await svc.cambiar_estado(current_user.id, pedido_id, data, current_user.roles)


# ============================================================================
# HISTORIAL
# ============================================================================

@router.get("/{pedido_id}/historial", response_model=HistorialEstadoPedidoList)
def get_historial_pedido(
    pedido_id: int,
    current_user: CurrentUser = Depends(get_current_active_user),
    svc: PedidoService = Depends(get_pedido_service),
) -> HistorialEstadoPedidoList:
    """
    Obtener historial de cambios de estado del pedido.
    
    Requiere token JWT válido.
    Solo el propietario del pedido puede ver su historial.
    
    Parámetros:
    - **pedido_id**: ID del pedido
    
    Retorna:
    - Lista de transiciones de estado en orden cronológico
    - Usuario que realizó el cambio
    - Motivo del cambio
    - Fecha y hora de cada transición
    """
    return svc.get_historial(current_user.id, pedido_id, current_user.roles)


# ============================================================================
# SSE — Server-Sent Events (canal alternativo en tiempo real)
# ============================================================================

@router.get("/events")
async def pedidos_events(token: str = Query(...)):
    payload = decode_access_token(token)
    if payload is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")

    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")

    client = sse_manager.subscribe()

    async def event_generator():
        try:
            while True:
                try:
                    data = await asyncio.wait_for(client.queue.get(), timeout=30)
                    yield data
                except asyncio.TimeoutError:
                    yield "data: {\"event\": \"ping\"}\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            sse_manager.unsubscribe(client)

    return StreamingResponse(event_generator(), media_type="text/event-stream")


# ============================================================================
# WEBSOCKET — Notificaciones en tiempo real (consigna §9.2)
# ============================================================================

def _resolve_ws_token(websocket: WebSocket, token: str | None) -> str | None:
    """Resuelve el token: query param ?token= (consigna §9.1), cookie o header."""
    if not token:
        token = websocket.cookies.get(settings.COOKIE_NAME)
    if not token:
        auth_header = websocket.headers.get("Authorization")
        if auth_header and auth_header.lower().startswith("bearer "):
            token = auth_header.split(" ", 1)[1]
    return token


async def _reject_ws(websocket: WebSocket, reason: str, code: int = 1008) -> None:
    """Acepta y cierra el handshake con un código de política (rechazo)."""
    await websocket.accept()
    await websocket.close(code=code, reason=reason)


async def _authenticate_ws(websocket: WebSocket, token: str | None, session: Session):
    """
    Autentica el handshake del WebSocket.

    Devuelve (usuario, roles) si el token es válido y el usuario está activo.
    Si no, acepta y cierra con código 1008 y devuelve (None, []).
    """
    token = _resolve_ws_token(websocket, token)
    payload = decode_access_token(token or "") if token else None
    user_id = payload.get("sub") if payload else None
    if user_id is None:
        await _reject_ws(websocket, "Token inválido")
        return None, []

    usuario = UsuarioRepository(session).get_by_id(int(user_id))
    if usuario is None or not usuario.activo or usuario.deleted_at is not None:
        await _reject_ws(websocket, "Usuario inválido")
        return None, []

    roles = [normalize_role(ur.rol.codigo) for ur in usuario.usuarios_roles]
    return usuario, roles


def _is_staff(roles: list[str]) -> bool:
    return ROLE_ADMIN in roles or ROLE_PEDIDOS in roles


async def _serve_ws(websocket: WebSocket) -> None:
    """Loop de recepción: mantiene la conexión viva hasta que el cliente la cierra."""
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)


@ws_router.websocket("/ws/pedidos")
async def pedidos_websocket(
    websocket: WebSocket,
    token: str | None = Query(default=None),
    tab_id: str | None = Query(default=None, alias="tab_id"),
    session: Session = Depends(get_session),
):
    """Feed de todos los pedidos para usuarios autenticados (canal admin)."""
    usuario, _roles = await _authenticate_ws(websocket, token, session)
    if usuario is None:
        return
    await manager.connect(websocket, ADMIN_CHANNEL, tab_id=tab_id or "")
    await _serve_ws(websocket)


@ws_router.websocket("/ws/admin/pedidos")
async def admin_pedidos_websocket(
    websocket: WebSocket,
    token: str | None = Query(default=None),
    tab_id: str | None = Query(default=None, alias="tab_id"),
    session: Session = Depends(get_session),
):
    """Feed admin de todos los pedidos (consigna §9.2: JWT ADMIN/PEDIDOS)."""
    usuario, roles = await _authenticate_ws(websocket, token, session)
    if usuario is None:
        return
    if not _is_staff(roles):
        await _reject_ws(websocket, "Permisos insuficientes")
        return
    await manager.connect(websocket, ADMIN_CHANNEL, tab_id=tab_id or "")
    for rol in roles:
        manager.add_channel(websocket, role_channel(rol))
    await _serve_ws(websocket)


@ws_router.websocket("/ws/pedidos/{pedido_id}")
async def pedido_por_id_websocket(
    websocket: WebSocket,
    pedido_id: int,
    token: str | None = Query(default=None),
    tab_id: str | None = Query(default=None, alias="tab_id"),
    session: Session = Depends(get_session),
):
    """Feed de un pedido puntual (consigna §9.2). Solo el dueño o el staff."""
    usuario, roles = await _authenticate_ws(websocket, token, session)
    if usuario is None:
        return
    pedido = PedidoRepository(session).get_by_id_no_deleted(pedido_id)
    if pedido is None:
        await _reject_ws(websocket, "Pedido no encontrado")
        return
    if not _is_staff(roles) and pedido.usuario_id != usuario.id:
        await _reject_ws(websocket, "No autorizado")
        return
    await manager.connect(websocket, pedido_channel(pedido_id), tab_id=tab_id or "")
    await _serve_ws(websocket)
