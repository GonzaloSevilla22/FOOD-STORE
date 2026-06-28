from sqlmodel import Session, select

from app.core.repository import BaseRepository
from app.modules.pedidos.models import HistorialEstadoPedido


class HistorialEstadoPedidoRepository(BaseRepository[HistorialEstadoPedido]):
    """
    Repositorio específico para HistorialEstadoPedido.
    Hereda CRUD genérico de BaseRepository[HistorialEstadoPedido].
    """

    def __init__(self, session: Session):
        super().__init__(session, HistorialEstadoPedido)

    def get_by_pedido_id(self, pedido_id: int) -> list[HistorialEstadoPedido]:
        """Obtener historial de un pedido ordenado por fecha."""
        statement = (
            select(HistorialEstadoPedido)
            .where(HistorialEstadoPedido.pedido_id == pedido_id, HistorialEstadoPedido.deleted_at.is_(None))
            .order_by(HistorialEstadoPedido.fecha)
        )
        return self.session.exec(statement).all()

    def get_last_by_pedido(self, pedido_id: int) -> HistorialEstadoPedido | None:
        """Obtener el último cambio de estado de un pedido."""
        statement = (
            select(HistorialEstadoPedido)
            .where(HistorialEstadoPedido.pedido_id == pedido_id, HistorialEstadoPedido.deleted_at.is_(None))
            .order_by(HistorialEstadoPedido.fecha.desc())
            .limit(1)
        )
        return self.session.exec(statement).first()
