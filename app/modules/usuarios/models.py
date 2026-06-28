from datetime import datetime
from typing import TYPE_CHECKING, List, Optional

from sqlmodel import Field, Relationship, SQLModel

from app.core.base import BaseModel

if TYPE_CHECKING:
    from app.modules.direcciones.models import DireccionEntrega
    from app.modules.pedidos.models import HistorialEstadoPedido, Pedido


class Usuario(BaseModel, table=True):
    """
    Usuario del sistema.
    Relaciones:
    - N:N con Rol (via UsuarioRol)
    - 1:N con DireccionEntrega
    - 1:N con Pedido
    Soft delete via activo=False (heredado de BaseModel con deleted_at)
    """

    __tablename__ = "usuarios"

    id: Optional[int] = Field(default=None, primary_key=True)
    nombre: str = Field(max_length=100, nullable=False)
    apellido: str = Field(max_length=100, nullable=False)
    email: str = Field(max_length=255, nullable=False, unique=True, index=True)
    celular: Optional[str] = Field(default=None, max_length=20, nullable=True)
    password_hash: str = Field(max_length=255, nullable=False)
    activo: bool = Field(default=True, nullable=False)

    # Relaciones
    usuarios_roles: List["UsuarioRol"] = Relationship(
        back_populates="usuario",
        cascade_delete=True,
        sa_relationship_kwargs={"foreign_keys": "UsuarioRol.usuario_id"},
    )
    direcciones: List["DireccionEntrega"] = Relationship(back_populates="usuario", cascade_delete=True)
    pedidos: List["Pedido"] = Relationship(back_populates="usuario", cascade_delete=True)
    historiales: List["HistorialEstadoPedido"] = Relationship(back_populates="usuario")

    def __repr__(self) -> str:
        return f"Usuario(id={self.id}, email={self.email}, nombre={self.nombre} {self.apellido})"


class Rol(BaseModel, table=True):
    """
    Rol del sistema.
    PK: codigo (e.g., ADMIN, CLIENTE)
    """

    __tablename__ = "roles"

    codigo: str = Field(primary_key=True, max_length=50, nullable=False)
    nombre: str = Field(max_length=100, nullable=False, unique=True)
    descripcion: Optional[str] = Field(default=None, nullable=True)

    # Relación N:N con Usuario
    usuarios_roles: List["UsuarioRol"] = Relationship(back_populates="rol", cascade_delete=True)

    def __repr__(self) -> str:
        return f"Rol(codigo={self.codigo}, nombre={self.nombre})"


class UsuarioRol(SQLModel, table=True):
    """
    Tabla intermedia N:N entre Usuario y Rol.
    PK compuesta: usuario_id + rol_codigo
    """

    __tablename__ = "usuarios_roles"

    usuario_id: int = Field(foreign_key="usuarios.id", primary_key=True, nullable=False)
    rol_codigo: str = Field(foreign_key="roles.codigo", primary_key=True, max_length=50, nullable=False)
    asignado_por_id: Optional[int] = Field(default=None, foreign_key="usuarios.id")
    expires_at: Optional[datetime] = Field(default=None)

    usuario: "Usuario" = Relationship(
        back_populates="usuarios_roles",
        sa_relationship_kwargs={"foreign_keys": "UsuarioRol.usuario_id"},
    )
    rol: "Rol" = Relationship(back_populates="usuarios_roles")
