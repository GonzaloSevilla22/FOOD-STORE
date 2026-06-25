from sqlmodel import Session
from app.core.unit_of_work import UnitOfWork
from app.modules.payments.repository import PagoRepository
from app.modules.pedidos.pedido_repository import PedidoRepository


class PagoUnitOfWork(UnitOfWork):
    def __init__(self, session: Session) -> None:
        super().__init__(session)
        self.pagos = PagoRepository(session)
        self.pedidos = PedidoRepository(session)
