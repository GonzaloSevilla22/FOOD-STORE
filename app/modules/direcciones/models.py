from typing import TYPE_CHECKING, Optional

from sqlmodel import Field, Relationship

from app.core.base import BaseModel

if TYPE_CHECKING:
    from app.modules.usuarios.models import Usuario
    from app.modules.pedidos.models import Pedido


class DireccionEntrega(BaseModel, table=True):
    """
    Dirección de entrega asociada a un usuario.
    Relaciones:
    - N:1 con Usuario
    - 1:N con Pedido (opcionales)
    Soft delete vía activo=False
    """

    __tablename__ = "direcciones_entrega"

    id: Optional[int] = Field(default=None, primary_key=True)
    usuario_id: int = Field(foreign_key="usuarios.id", nullable=False, index=True)
    alias: str = Field(max_length=100, nullable=False)
    linea1: str = Field(max_length=255, nullable=False)
    linea2: Optional[str] = Field(default=None, max_length=255, nullable=True)
    ciudad: str = Field(max_length=100, nullable=False)
    provincia: str = Field(max_length=100, nullable=False)
    codigo_postal: str = Field(max_length=20, nullable=False)
    es_principal: bool = Field(default=False, nullable=False)
    activo: bool = Field(default=True, nullable=False)

    # Relaciones
    usuario: "Usuario" = Relationship(back_populates="direcciones")
    pedidos: list["Pedido"] = Relationship(back_populates="direccion_entrega")

    def __repr__(self) -> str:
        return f"DireccionEntrega(id={self.id}, alias={self.alias}, ciudad={self.ciudad})"
