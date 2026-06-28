"""
AuthService: Lógica de autenticación y autorización.
"""

from datetime import timedelta
from typing import Optional

from fastapi import HTTPException, status
from sqlmodel import Session

from app.core.rbac import ROLE_CLIENT, normalize_role
from app.core.security import (
    hash_password, verify_password,
    create_access_token, create_refresh_token,
    decode_access_token, decode_refresh_token,
)
from app.modules.usuarios.models import Usuario
from app.modules.usuarios.repository import UsuarioRepository
from app.modules.usuarios.unit_of_work import UsuarioUnitOfWork
from app.modules.usuarios.schemas import (
    UsuarioCreate,
    UsuarioPublic,
    LoginRequest,
    TokenResponse,
    CurrentUser,
)


class AuthService:
    """
    Servicio de autenticación.
    Maneja login, token generation, y token verification.
    """

    def __init__(self, session: Session):
        self._session = session
        self._usuario_repo = UsuarioRepository(session)

    def register(self, data: UsuarioCreate) -> UsuarioPublic:
        """
        Registrar nuevo usuario.
        
        Args:
            data: Datos para crear usuario
            
        Returns:
            Usuario creado
            
        Raises:
            HTTPException: Si email ya existe
        """
        with UsuarioUnitOfWork(self._session) as uow:
            existing = uow.usuarios.get_by_email(data.email)
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Email ya registrado",
                )

            usuario = Usuario(
                nombre=data.nombre,
                apellido=data.apellido,
                email=data.email,
                celular=data.celular,
                password_hash=hash_password(data.password),
                activo=True,
            )

            usuario = uow.usuarios.add(usuario)

            rol_cliente = uow.roles.get_by_codigo(ROLE_CLIENT)
            if rol_cliente:
                uow.usuarios_roles.add(usuario.id, rol_cliente.codigo)

            result = self._to_public(usuario)

        return result

    def login(self, data: LoginRequest) -> TokenResponse:
        """
        Autenticar usuario y generar token.
        
        Args:
            data: Email y contraseña
            
        Returns:
            Token JWT y información del usuario
            
        Raises:
            HTTPException: Si credenciales son inválidas
        """
        identifier = (data.email or data.username or "").strip()
        if not identifier:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email o usuario son obligatorios",
            )

        usuario = self._usuario_repo.get_by_login_identifier(identifier)
        if not usuario or not usuario.activo or usuario.deleted_at is not None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Credenciales inválidas",
            )
        
        # Verificar contraseña
        if not verify_password(data.password, usuario.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Credenciales inválidas",
            )
        
        # Obtener roles
        roles = [normalize_role(ur.rol.codigo) for ur in usuario.usuarios_roles]
        
        # Generar token
        token_data = {
            "sub": str(usuario.id),
            "email": usuario.email,
            "roles": roles,
        }
        
        token = create_access_token(
            token_data,
            expires_delta=timedelta(minutes=30),
        )
        refresh = create_refresh_token({"sub": str(usuario.id)})
        
        return TokenResponse(
            access_token=token,
            refresh_token=refresh,
            token_type="Bearer",
            expires_in=30 * 60,
            usuario=self._to_public(usuario),
            roles=roles,
        )

    def refresh(self, refresh_token: str) -> TokenResponse:
        payload = decode_refresh_token(refresh_token)
        if payload is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token inválido o expirado",
            )

        usuario_id = int(payload.get("sub", -1))
        if usuario_id < 0:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token inválido",
            )

        usuario = self._usuario_repo.get_by_id(usuario_id)
        if not usuario or not usuario.activo or usuario.deleted_at is not None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Usuario no válido",
            )

        roles = [normalize_role(ur.rol.codigo) for ur in usuario.usuarios_roles]
        token_data = {
            "sub": str(usuario.id),
            "email": usuario.email,
            "roles": roles,
        }
        token = create_access_token(token_data, expires_delta=timedelta(minutes=30))
        refresh = create_refresh_token({"sub": str(usuario.id)})

        return TokenResponse(
            access_token=token,
            refresh_token=refresh,
            token_type="Bearer",
            expires_in=30 * 60,
            usuario=self._to_public(usuario),
            roles=roles,
        )

    def verify_token(self, token: str) -> Optional[CurrentUser]:
        """
        Verificar token y retornar usuario actual.
        
        Args:
            token: JWT token
            
        Returns:
            CurrentUser si es válido, None si no
        """
        payload = decode_access_token(token)
        if not payload:
            return None
        
        usuario_id = int(payload.get("sub", -1))
        if usuario_id < 0:
            return None
        
        usuario = self._usuario_repo.get_by_id(usuario_id)
        if not usuario or not usuario.activo or usuario.deleted_at is not None:
            return None
        
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

    def _to_public(self, usuario: Usuario) -> UsuarioPublic:
        """Convertir Usuario a UsuarioPublic."""
        return UsuarioPublic(
            id=usuario.id,
            nombre=usuario.nombre,
            apellido=usuario.apellido,
            email=usuario.email,
            celular=usuario.celular,
            activo=usuario.activo,
        )
