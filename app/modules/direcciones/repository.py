from sqlmodel import Session, select

from app.core.repository import BaseRepository
from app.modules.direcciones.models import DireccionEntrega


class DireccionEntregaRepository(BaseRepository[DireccionEntrega]):
    def __init__(self, session: Session):
        super().__init__(session, DireccionEntrega)

    def get_by_usuario_id(self, usuario_id: int, offset: int = 0, limit: int = 20) -> list[DireccionEntrega]:
        statement = (
            select(DireccionEntrega)
            .where(
                DireccionEntrega.usuario_id == usuario_id,
                DireccionEntrega.activo.is_(True),
                DireccionEntrega.deleted_at.is_(None),
            )
            .order_by(DireccionEntrega.es_principal.desc(), DireccionEntrega.id)
            .offset(offset)
            .limit(limit)
        )
        return self.session.exec(statement).all()

    def get_by_id_and_usuario(self, direccion_id: int, usuario_id: int) -> DireccionEntrega | None:
        statement = (
            select(DireccionEntrega)
            .where(
                DireccionEntrega.id == direccion_id,
                DireccionEntrega.usuario_id == usuario_id,
                DireccionEntrega.activo.is_(True),
                DireccionEntrega.deleted_at.is_(None),
            )
        )
        return self.session.exec(statement).first()

    def get_principal_by_usuario(self, usuario_id: int) -> DireccionEntrega | None:
        statement = (
            select(DireccionEntrega)
            .where(
                DireccionEntrega.usuario_id == usuario_id,
                DireccionEntrega.es_principal.is_(True),
                DireccionEntrega.activo.is_(True),
                DireccionEntrega.deleted_at.is_(None),
            )
        )
        return self.session.exec(statement).first()
