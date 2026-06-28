from sqlmodel import Session

from app.core.unit_of_work import UnitOfWork
from app.modules.usuarios.repository import UsuarioRepository
from app.modules.usuarios.rol_repository import RolRepository
from app.modules.usuarios.usuario_rol_repository import UsuarioRolRepository


class UsuarioUnitOfWork(UnitOfWork):
    def __init__(self, session: Session):
        super().__init__(session)
        self.usuarios = UsuarioRepository(session)
        self.roles = RolRepository(session)
        self.usuarios_roles = UsuarioRolRepository(session)
