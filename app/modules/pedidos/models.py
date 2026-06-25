from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING, List, Optional

from sqlmodel import Field, Relationship

from app.core.base import BaseModel, now_utc

if TYPE_CHECKING:
    from app.modules.usuarios.models import Usuario
    from app.modules.direcciones.models import DireccionEntrega
    from app.modules.productos.models import Producto


class EstadoPedido(BaseModel, table=True):
    """
    Estado del pedido (PENDIENTE, PAGADO, EN_PREPARACION, TERMINADO, ENTREGADO, CANCELADO).
    PK: codigo (e.g., PENDIENTE)
    """

    __tablename__ = "estados_pedido"

    codigo: str = Field(primary_key=True, max_length=50, nullable=False)
    nombre: str = Field(max_length=100, nullable=False, unique=True)
    descripcion: Optional[str] = Field(default=None, nullable=True)
    # true = estado terminal, no admite transiciones salientes (RN-01)
    es_terminal: bool = Field(default=False, nullable=False)

    # Relaciones
    pedidos: List["Pedido"] = Relationship(back_populates="estado")
    historiales: List["HistorialEstadoPedido"] = Relationship(
        back_populates="estado_desde",
        cascade_delete=True,
        sa_relationship_kwargs={"foreign_keys": "HistorialEstadoPedido.estado_desde_codigo"},
    )
    historiales_hacia: List["HistorialEstadoPedido"] = Relationship(
        back_populates="estado_hacia",
        cascade_delete=True,
        sa_relationship_kwargs={"foreign_keys": "HistorialEstadoPedido.estado_hacia_codigo"},
    )

    def __repr__(self) -> str:
        return f"EstadoPedido(codigo={self.codigo}, nombre={self.nombre})"


class FormaPago(BaseModel, table=True):
    __tablename__ = "formas_pago"

    codigo: str = Field(primary_key=True, max_length=50, nullable=False)
    nombre: str = Field(max_length=100, nullable=False, unique=True)
    descripcion: Optional[str] = Field(default=None, nullable=True)


class Pedido(BaseModel, table=True):
    """
    Pedido del cliente.
    Relaciones:
    - N:1 Usuario
    - N:1 DireccionEntrega
    - N:1 EstadoPedido
    - 1:N DetallePedido
    - 1:N HistorialEstadoPedido
    Soft delete vía deleted_at
    """

    __tablename__ = "pedidos"

    id: Optional[int] = Field(default=None, primary_key=True)
    usuario_id: int = Field(foreign_key="usuarios.id", nullable=False, index=True)
    direccion_entrega_id: int = Field(foreign_key="direcciones_entrega.id", nullable=False)
    estado_codigo: str = Field(foreign_key="estados_pedido.codigo", max_length=50, nullable=False)
    subtotal: Decimal = Field(default=0, ge=0, max_digits=10, decimal_places=2, nullable=False)
    forma_pago_codigo: Optional[str] = Field(default=None, foreign_key="formas_pago.codigo", max_length=50, nullable=True)
    descuento: Decimal = Field(default=0, ge=0, max_digits=10, decimal_places=2, nullable=False)
    costo_envio: Decimal = Field(default=0, ge=0, max_digits=10, decimal_places=2, nullable=False)
    total: Decimal = Field(default=0, ge=0, max_digits=10, decimal_places=2, nullable=False)
    notas: Optional[str] = Field(default=None, nullable=True)

    # Relaciones
    usuario: "Usuario" = Relationship(back_populates="pedidos")
    direccion_entrega: "DireccionEntrega" = Relationship(back_populates="pedidos")
    estado: "EstadoPedido" = Relationship(back_populates="pedidos")
    forma_pago: Optional["FormaPago"] = Relationship()
    detalles: List["DetallePedido"] = Relationship(back_populates="pedido", cascade_delete=True)
    historiales: List["HistorialEstadoPedido"] = Relationship(back_populates="pedido", cascade_delete=True)

    def __repr__(self) -> str:
        return f"Pedido(id={self.id}, usuario_id={self.usuario_id}, estado={self.estado_codigo}, total={self.total})"


class DetallePedido(BaseModel, table=True):
    """
    Detalle de un pedido.
    Incluye snapshots del producto en el momento de la compra.
    Relaciones:
    - N:1 Pedido
    - N:1 Producto (referencial)
    Soft delete vía deleted_at
    """

    __tablename__ = "detalles_pedido"

    id: Optional[int] = Field(default=None, primary_key=True)
    pedido_id: int = Field(foreign_key="pedidos.id", nullable=False, index=True)
    producto_id: int = Field(foreign_key="productos.id", nullable=False)
    cantidad: int = Field(ge=1, nullable=False)

    # Snapshots del producto al momento de la compra
    nombre_snapshot: str = Field(max_length=150, nullable=False)
    precio_snapshot: Decimal = Field(ge=0, max_digits=10, decimal_places=2, nullable=False)
    subtotal_snapshot: Decimal = Field(ge=0, max_digits=10, decimal_places=2, nullable=False)
    personalizacion: Optional[str] = Field(default=None, max_length=500)

    # Relaciones
    pedido: "Pedido" = Relationship(back_populates="detalles")
    # No mantenemos Relationship con Producto porque es solo referencial

    def __repr__(self) -> str:
        return f"DetallePedido(id={self.id}, pedido_id={self.pedido_id}, cantidad={self.cantidad})"


class HistorialEstadoPedido(BaseModel, table=True):
    """
    Historial de cambios de estado del pedido.
    Registra transiciones de estado y quién las realizó.
    Relaciones:
    - N:1 Pedido
    - N:1 EstadoPedido (estado_desde)
    - N:1 EstadoPedido (estado_hacia)
    - N:1 Usuario (quién realizó el cambio)
    """

    __tablename__ = "historiales_estado_pedido"

    id: Optional[int] = Field(default=None, primary_key=True)
    pedido_id: int = Field(foreign_key="pedidos.id", nullable=False, index=True)
    estado_desde_codigo: str = Field(foreign_key="estados_pedido.codigo", max_length=50, nullable=False)
    estado_hacia_codigo: str = Field(foreign_key="estados_pedido.codigo", max_length=50, nullable=False)
    usuario_id: Optional[int] = Field(foreign_key="usuarios.id", nullable=True)
    motivo: Optional[str] = Field(default=None, nullable=True)
    fecha: datetime = Field(default_factory=now_utc, nullable=False, index=True)

    # Relaciones
    pedido: "Pedido" = Relationship(back_populates="historiales")
    estado_desde: Optional["EstadoPedido"] = Relationship(
        back_populates="historiales",
        sa_relationship_kwargs={"foreign_keys": "HistorialEstadoPedido.estado_desde_codigo"}
    )
    estado_hacia: Optional["EstadoPedido"] = Relationship(
        back_populates="historiales_hacia",
        sa_relationship_kwargs={"foreign_keys": "HistorialEstadoPedido.estado_hacia_codigo"}
    )
    usuario: Optional["Usuario"] = Relationship(back_populates="historiales")

    def __repr__(self) -> str:
        return f"HistorialEstadoPedido(pedido_id={self.pedido_id}, {self.estado_desde_codigo} → {self.estado_hacia_codigo})"
