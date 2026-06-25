from sqlmodel import Session, select

from app.core.repository import BaseRepository
from app.modules.usuarios.models import Rol


class RolRepository(BaseRepository[Rol]):
    """
    Repositorio específico para Rol.
    Hereda CRUD genérico de BaseRepository[Rol].
    """

    def __init__(self, session: Session):
        super().__init__(session, Rol)

    def get_by_codigo(self, codigo: str) -> Rol | None:
        """Obtener rol por código."""
        return self.session.get(Rol, codigo)

    def get_by_nombre(self, nombre: str) -> Rol | None:
        """Obtener rol por nombre."""
        statement = select(Rol).where(Rol.nombre == nombre)
        return self.session.exec(statement).first()
