"""
Usuarios Router: Endpoints para gestión de usuarios y roles.
"""

from fastapi import APIRouter, Depends, Query, status, HTTPException
from sqlmodel import Session

from app.core.deps import get_current_active_user, require_roles
from app.core.database import get_session
from app.core.rbac import ROLE_ADMIN
from app.modules.usuarios.service import UsuarioService
from app.modules.usuarios.schemas import (
    UsuarioPublic,
    UsuarioUpdate,
    UsuarioDetail,
    UsuarioList,
    CurrentUser,
)

router = APIRouter()


def get_usuario_service(session: Session = Depends(get_session)) -> UsuarioService:
    """Dependency para obtener el UsuarioService."""
    return UsuarioService(session)


def _ensure_self_or_admin(current_user: CurrentUser, usuario_id: int) -> None:
    if current_user.id != usuario_id and ROLE_ADMIN not in current_user.roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permisos insuficientes")


# ============================================================================
# USUARIOS - CRUD
# ============================================================================

@router.get("", response_model=UsuarioList)
def list_usuarios(
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    include_inactive: bool = Query(default=False),
    _: CurrentUser = Depends(require_roles([ROLE_ADMIN])),
    svc: UsuarioService = Depends(get_usuario_service),
) -> UsuarioList:
    """
    Listar usuarios activos con paginación.
    
    Parámetros:
    - **offset**: Número de registros a saltar (default: 0)
    - **limit**: Número máximo de registros (default: 20, max: 100)
    - **include_inactive**: Incluir usuarios inactivos (default: false)
    """
    return svc.list_usuarios(
        offset=offset,
        limit=limit,
        include_inactive=include_inactive,
    )


@router.get("/{usuario_id}", response_model=UsuarioDetail)
def get_usuario(
    usuario_id: int,
    current_user: CurrentUser = Depends(get_current_active_user),
    svc: UsuarioService = Depends(get_usuario_service),
) -> UsuarioDetail:
    """
    Obtener detalle de usuario con roles y direcciones.
    
    Parámetros:
    - **usuario_id**: ID del usuario
    """
    _ensure_self_or_admin(current_user, usuario_id)
    return svc.get_usuario(usuario_id)


@router.put("/{usuario_id}", response_model=UsuarioDetail)
def update_usuario(
    usuario_id: int,
    data: UsuarioUpdate,
    current_user: CurrentUser = Depends(get_current_active_user),
    svc: UsuarioService = Depends(get_usuario_service),
) -> UsuarioDetail:
    """
    Actualizar datos del usuario.
    
    Parámetros:
    - **usuario_id**: ID del usuario
    - **nombre**: Nuevo nombre (opcional)
    - **apellido**: Nuevo apellido (opcional)
    - **celular**: Nuevo teléfono (opcional)
    - **activo**: Activar/desactivar usuario (opcional)
    """
    _ensure_self_or_admin(current_user, usuario_id)
    return svc.update_usuario(usuario_id, data)


@router.delete("/{usuario_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_usuario(
    usuario_id: int,
    _: CurrentUser = Depends(require_roles([ROLE_ADMIN])),
    svc: UsuarioService = Depends(get_usuario_service),
) -> None:
    """
    Soft-delete de usuario (marcado como inactivo).
    
    Parámetros:
    - **usuario_id**: ID del usuario
    """
    svc.delete_usuario(usuario_id)


# ============================================================================
# ROLES
# ============================================================================

@router.post("/{usuario_id}/roles/{rol_codigo}", response_model=UsuarioDetail, status_code=status.HTTP_201_CREATED)
def asignar_rol(
    usuario_id: int,
    rol_codigo: str,
    _: CurrentUser = Depends(require_roles([ROLE_ADMIN])),
    svc: UsuarioService = Depends(get_usuario_service),
) -> UsuarioDetail:
    """
    Asignar rol a usuario (si no lo tiene ya).
    
    Parámetros:
    - **usuario_id**: ID del usuario
    - **rol_codigo**: Código del rol (e.g., ADMIN, CLIENTE)
    """
    return svc.asignar_rol(usuario_id, rol_codigo)


@router.delete("/{usuario_id}/roles/{rol_codigo}", response_model=UsuarioDetail)
def remover_rol(
    usuario_id: int,
    rol_codigo: str,
    _: CurrentUser = Depends(require_roles([ROLE_ADMIN])),
    svc: UsuarioService = Depends(get_usuario_service),
) -> UsuarioDetail:
    """
    Remover rol de usuario.
    
    Parámetros:
    - **usuario_id**: ID del usuario
    - **rol_codigo**: Código del rol
    """
    return svc.remover_rol(usuario_id, rol_codigo)



