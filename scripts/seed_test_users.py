"""Script para crear usuarios de prueba con roles STOCK y PEDIDOS."""

import sys
from pathlib import Path

# Agregar raíz del proyecto al path para poder importar app
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlmodel import Session, select, SQLModel, create_engine

from app.core.config import settings
from app.core.rbac import ROLE_STOCK, ROLE_PEDIDOS
from app.core.security import hash_password
from app.modules.usuarios.models import Usuario, UsuarioRol, Rol


def seed_users():
    engine = create_engine(settings.DATABASE_URL, echo=False)
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        # Crear usuario STOCK
        stock = session.exec(
            select(Usuario).where(Usuario.email == "stock@test.com")
        ).first()
        if not stock:
            stock = Usuario(
                nombre="Stock",
                apellido="Test",
                email="stock@test.com",
                celular="1111111111",
                password_hash=hash_password("stock123"),
                activo=True,
            )
            session.add(stock)
            session.flush()

        stock_rol = session.exec(
            select(UsuarioRol).where(
                UsuarioRol.usuario_id == stock.id,
                UsuarioRol.rol_codigo == ROLE_STOCK,
            )
        ).first()
        if not stock_rol:
            session.add(UsuarioRol(usuario_id=stock.id, rol_codigo=ROLE_STOCK))

        # Crear usuario PEDIDOS
        pedidos = session.exec(
            select(Usuario).where(Usuario.email == "pedidos@test.com")
        ).first()
        if not pedidos:
            pedidos = Usuario(
                nombre="Pedidos",
                apellido="Test",
                email="pedidos@test.com",
                celular="2222222222",
                password_hash=hash_password("pedidos123"),
                activo=True,
            )
            session.add(pedidos)
            session.flush()

        pedidos_rol = session.exec(
            select(UsuarioRol).where(
                UsuarioRol.usuario_id == pedidos.id,
                UsuarioRol.rol_codigo == ROLE_PEDIDOS,
            )
        ).first()
        if not pedidos_rol:
            session.add(UsuarioRol(usuario_id=pedidos.id, rol_codigo=ROLE_PEDIDOS))

        session.commit()
        print("✅ Usuarios stock@test.com / stock123 y pedidos@test.com / pedidos123 creados correctamente.")


if __name__ == "__main__":
    seed_users()
