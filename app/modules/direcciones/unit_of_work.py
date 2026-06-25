from sqlmodel import Session

from app.core.unit_of_work import UnitOfWork
from app.modules.direcciones.repository import DireccionEntregaRepository


class DireccionUnitOfWork(UnitOfWork):
    def __init__(self, session: Session):
        super().__init__(session)
        self.direcciones = DireccionEntregaRepository(session)
