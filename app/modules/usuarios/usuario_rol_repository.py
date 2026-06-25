"""Repositorio para la tabla intermedia UsuarioRol (asignación de roles).

Encapsula el acceso a la tabla N:N usuario↔rol para que el service no consulte
la base de datos directamente.
"""

from sqlmodel import Session, select

from app.modules.usuarios.models import UsuarioRol


class UsuarioRolRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def get(self, usuario_id: int, rol_codigo: str) -> UsuarioRol | None:
        """Obtener la asignación de un rol a un usuario (o None)."""
        statement = select(UsuarioRol).where(
            UsuarioRol.usuario_id == usuario_id,
            UsuarioRol.rol_codigo == rol_codigo,
        )
        return self.session.exec(statement).first()

    def add(self, usuario_id: int, rol_codigo: str) -> UsuarioRol:
        """Asignar un rol a un usuario. NO hace commit (lo maneja el UoW)."""
        usuario_rol = UsuarioRol(usuario_id=usuario_id, rol_codigo=rol_codigo)
        self.session.add(usuario_rol)
        self.session.flush()
        return usuario_rol

    def delete(self, usuario_id: int, rol_codigo: str) -> None:
        """Remover la asignación de un rol. NO hace commit (lo maneja el UoW)."""
        usuario_rol = self.get(usuario_id, rol_codigo)
        if usuario_rol is not None:
            self.session.delete(usuario_rol)
            self.session.flush()
