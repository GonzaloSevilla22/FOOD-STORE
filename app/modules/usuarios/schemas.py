from typing import List, Optional
from datetime import datetime

from sqlmodel import Field, SQLModel


# ============================================================================
# ROL SCHEMAS
# ============================================================================

class RolCreate(SQLModel):
    codigo: str = Field(min_length=2, max_length=50)
    nombre: str = Field(min_length=2, max_length=100)
    descripcion: Optional[str] = None


class RolUpdate(SQLModel):
    nombre: Optional[str] = Field(default=None, min_length=2, max_length=100)
    descripcion: Optional[str] = None


class RolPublic(SQLModel):
    codigo: str
    nombre: str
    descripcion: Optional[str] = None


# Direccion schemas re-exportados desde el módulo dedicado
from app.modules.direcciones.schemas import (  # noqa: F401
    DireccionEntregaCreate,
    DireccionEntregaUpdate,
    DireccionEntregaPublic,
    DireccionEntregaDetail,
    DireccionEntregaList,
)


# ============================================================================
# USUARIO SCHEMAS
# ============================================================================

class UsuarioCreate(SQLModel):
    nombre: str = Field(min_length=2, max_length=100)
    apellido: str = Field(min_length=2, max_length=100)
    email: str = Field(max_length=255)
    celular: Optional[str] = Field(default=None, max_length=20)
    password: str = Field(min_length=8, max_length=255)


class UsuarioUpdate(SQLModel):
    nombre: Optional[str] = Field(default=None, min_length=2, max_length=100)
    apellido: Optional[str] = Field(default=None, min_length=2, max_length=100)
    celular: Optional[str] = None
    activo: Optional[bool] = None


class UsuarioPublic(SQLModel):
    id: int
    nombre: str
    apellido: str
    email: str
    celular: Optional[str] = None
    activo: bool


class UsuarioDetail(UsuarioPublic):
    created_at: datetime
    updated_at: datetime
    roles: List[RolPublic] = Field(default_factory=list)
    direcciones: List[DireccionEntregaPublic] = Field(default_factory=list)


class UsuarioList(SQLModel):
    data: List[UsuarioPublic]
    total: int


# ============================================================================
# AUTH SCHEMAS
# ============================================================================

class LoginRequest(SQLModel):
    email: str = Field(min_length=5, max_length=255)
    password: str = Field(min_length=1)


class TokenResponse(SQLModel):
    access_token: str
    refresh_token: str
    token_type: str
    expires_in: int = 1800  # segundos hasta expirar el access_token (consigna §6.1)
    usuario: UsuarioPublic
    roles: List[str] = Field(default_factory=list)  # códigos de rol


class RefreshRequest(SQLModel):
    refresh_token: str = Field(min_length=10)


class CurrentUser(UsuarioPublic):
    """Usuario obtenido del token JWT"""
    roles: List[str] = Field(default_factory=list)  # códigos de rol
