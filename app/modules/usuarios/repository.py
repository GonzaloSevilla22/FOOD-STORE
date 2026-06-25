from sqlmodel import Session, func, select

from app.core.repository import BaseRepository
from app.modules.usuarios.models import Usuario


class UsuarioRepository(BaseRepository[Usuario]):
    """
    Repositorio específico para Usuario.
    Hereda CRUD genérico de BaseRepository[Usuario].
    Incluye queries personalizadas.
    """

    def __init__(self, session: Session):
        super().__init__(session, Usuario)

    def get_by_email(self, email: str) -> Usuario | None:
        """Obtener usuario por email."""
        statement = select(Usuario).where(Usuario.email == email)
        return self.session.exec(statement).first()

    def get_paginated(
        self,
        offset: int = 0,
        limit: int = 20,
        include_inactive: bool = False,
    ) -> list[Usuario]:
        """Obtener usuarios con paginación; opcionalmente incluir inactivos."""
        statement = select(Usuario).where(Usuario.deleted_at.is_(None))
        if not include_inactive:
            statement = statement.where(Usuario.activo.is_(True))

        statement = statement.offset(offset).limit(limit)
        return self.session.exec(statement).all()

    def count(self, include_inactive: bool = False) -> int:
        """Contar usuarios; opcionalmente incluir inactivos."""
        statement = select(func.count()).select_from(Usuario).where(
            Usuario.deleted_at.is_(None)
        )
        if not include_inactive:
            statement = statement.where(Usuario.activo.is_(True))

        return self.session.exec(statement).one()

    def get_by_login_identifier(self, identifier: str) -> Usuario | None:
        """Obtener usuario por identificador de login (email o celular).

        La UI envía habitualmente el email. También permitimos buscar por
        `celular` por si se decide usarlo como identificador.
        """
        identifier = (identifier or "").strip()
        if not identifier:
            return None

        # Buscar por email exacto o por número de celular
        statement = select(Usuario).where(
            (Usuario.email == identifier) | (Usuario.celular == identifier)
        )
        return self.session.exec(statement).first()
