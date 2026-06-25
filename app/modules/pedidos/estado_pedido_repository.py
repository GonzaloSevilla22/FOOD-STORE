from sqlmodel import Session, select

from app.core.repository import BaseRepository
from app.modules.pedidos.models import EstadoPedido


class EstadoPedidoRepository(BaseRepository[EstadoPedido]):
    """
    Repositorio específico para EstadoPedido.
    Hereda CRUD genérico de BaseRepository[EstadoPedido].
    """

    def __init__(self, session: Session):
        super().__init__(session, EstadoPedido)

    def get_by_codigo(self, codigo: str) -> EstadoPedido | None:
        """Obtener estado por código."""
        return self.session.get(EstadoPedido, codigo)

    def get_by_nombre(self, nombre: str) -> EstadoPedido | None:
        """Obtener estado por nombre."""
        statement = select(EstadoPedido).where(EstadoPedido.nombre == nombre)
        return self.session.exec(statement).first()
