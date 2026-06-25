from typing import Annotated

from fastapi import Cookie, Depends, Header, HTTPException, status
from sqlmodel import Session

from app.core.database import get_session
from app.core.config import settings
from app.core.rbac import normalize_role
from app.core.security import decode_access_token
from app.modules.usuarios.repository import UsuarioRepository
from app.modules.usuarios.schemas import CurrentUser


def _extract_token(authorization: str | None, cookie_token: str | None) -> str | None:
    if authorization:
        parts = authorization.split(" ")
        if len(parts) == 2 and parts[0].lower() == "bearer":
            return parts[1]

    if cookie_token:
        return cookie_token

    return None


def get_current_user(
    authorization: str | None = Header(default=None),
    access_token: str | None = Cookie(default=None, alias=settings.COOKIE_NAME),
    session: Session = Depends(get_session),
) -> CurrentUser:
    token = _extract_token(authorization, access_token)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No autenticado",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_access_token(token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido",
            headers={"WWW-Authenticate": "Bearer"},
        )

    usuario = UsuarioRepository(session).get_by_id(int(user_id))
    if usuario is None or usuario.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario no válido",
            headers={"WWW-Authenticate": "Bearer"},
        )

    roles = [normalize_role(ur.rol.codigo) for ur in usuario.usuarios_roles]

    return CurrentUser(
        id=usuario.id,
        nombre=usuario.nombre,
        apellido=usuario.apellido,
        email=usuario.email,
        celular=usuario.celular,
        activo=usuario.activo,
        roles=roles,
    )


def get_current_active_user(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> CurrentUser:
    if not current_user.activo:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuario inactivo",
        )
    return current_user


def require_roles(allowed_roles: list[str]):
    normalized_allowed = {normalize_role(role) for role in allowed_roles}

    def checker(
        current_user: Annotated[CurrentUser, Depends(get_current_active_user)],
    ) -> CurrentUser:
        user_roles = {normalize_role(role) for role in current_user.roles}
        if user_roles.isdisjoint(normalized_allowed):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"Permisos insuficientes. Requerido: {sorted(normalized_allowed)}. "
                    f"Actual: {sorted(user_roles)}"
                ),
            )
        return current_user

    return checker
