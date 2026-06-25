from sqlmodel import Session, select

from app.core.repository import BaseRepository
from app.modules.pedidos.models import DetallePedido


class DetallePedidoRepository(BaseRepository[DetallePedido]):
    """
    Repositorio específico para DetallePedido.
    Hereda CRUD genérico de BaseRepository[DetallePedido].
    """

    def __init__(self, session: Session):
        super().__init__(session, DetallePedido)

    def get_by_pedido_id(self, pedido_id: int) -> list[DetallePedido]:
        """Obtener detalles de un pedido."""
        statement = (
            select(DetallePedido)
            .where(DetallePedido.pedido_id == pedido_id, DetallePedido.deleted_at.is_(None))
            .order_by(DetallePedido.created_at)
        )
        return self.session.exec(statement).all()

    def delete_by_pedido_id(self, pedido_id: int) -> None:
        """Eliminar todos los detalles de un pedido (soft delete)."""
        detalles = self.get_by_pedido_id(pedido_id)
        for detalle in detalles:
            self.delete(detalle)
