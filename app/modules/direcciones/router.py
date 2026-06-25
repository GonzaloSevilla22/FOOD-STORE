from fastapi import APIRouter, Depends, Query, status
from sqlmodel import Session

from app.core.database import get_session
from app.core.deps import get_current_active_user
from app.modules.direcciones.schemas import (
    DireccionEntregaCreate,
    DireccionEntregaUpdate,
    DireccionEntregaPublic,
    DireccionEntregaList,
)
from app.modules.direcciones.service import DireccionService
from app.modules.usuarios.schemas import CurrentUser

router = APIRouter(prefix="/usuarios/{usuario_id}/direcciones", tags=["direcciones"])


def get_direccion_service(session: Session = Depends(get_session)) -> DireccionService:
    return DireccionService(session)


def _ensure_self_or_admin(current_user: CurrentUser, usuario_id: int) -> None:
    if current_user.id != usuario_id and "ADMIN" not in (current_user.roles or []):
        from fastapi import HTTPException
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para acceder a este recurso",
        )


@router.post("", response_model=DireccionEntregaPublic, status_code=status.HTTP_201_CREATED)
def crear_direccion(
    usuario_id: int,
    data: DireccionEntregaCreate,
    current_user: CurrentUser = Depends(get_current_active_user),
    svc: DireccionService = Depends(get_direccion_service),
) -> DireccionEntregaPublic:
    _ensure_self_or_admin(current_user, usuario_id)
    return svc.crear_direccion(usuario_id, data)


@router.get("", response_model=DireccionEntregaList)
def list_direcciones(
    usuario_id: int,
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    current_user: CurrentUser = Depends(get_current_active_user),
    svc: DireccionService = Depends(get_direccion_service),
) -> DireccionEntregaList:
    _ensure_self_or_admin(current_user, usuario_id)
    return svc.list_direcciones(usuario_id, offset=offset, limit=limit)


@router.get("/{direccion_id}", response_model=DireccionEntregaPublic)
def get_direccion(
    usuario_id: int,
    direccion_id: int,
    current_user: CurrentUser = Depends(get_current_active_user),
    svc: DireccionService = Depends(get_direccion_service),
) -> DireccionEntregaPublic:
    _ensure_self_or_admin(current_user, usuario_id)
    return svc.get_direccion(usuario_id, direccion_id)


@router.put("/{direccion_id}", response_model=DireccionEntregaPublic)
def update_direccion(
    usuario_id: int,
    direccion_id: int,
    data: DireccionEntregaUpdate,
    current_user: CurrentUser = Depends(get_current_active_user),
    svc: DireccionService = Depends(get_direccion_service),
) -> DireccionEntregaPublic:
    _ensure_self_or_admin(current_user, usuario_id)
    return svc.update_direccion(usuario_id, direccion_id, data)


@router.patch("/{direccion_id}/principal", response_model=DireccionEntregaPublic)
def set_direccion_principal(
    usuario_id: int,
    direccion_id: int,
    current_user: CurrentUser = Depends(get_current_active_user),
    svc: DireccionService = Depends(get_direccion_service),
) -> DireccionEntregaPublic:
    _ensure_self_or_admin(current_user, usuario_id)
    return svc.set_direccion_principal(usuario_id, direccion_id)


@router.delete("/{direccion_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_direccion(
    usuario_id: int,
    direccion_id: int,
    current_user: CurrentUser = Depends(get_current_active_user),
    svc: DireccionService = Depends(get_direccion_service),
) -> None:
    _ensure_self_or_admin(current_user, usuario_id)
    svc.delete_direccion(usuario_id, direccion_id)
