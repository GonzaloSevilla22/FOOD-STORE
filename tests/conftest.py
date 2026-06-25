import os
from contextlib import asynccontextmanager
from collections.abc import AsyncIterator
from typing import Any, Mapping

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlalchemy.pool import StaticPool

os.environ.setdefault("DEBUG", "True")
os.environ["SKIP_RATE_LIMIT"] = "1"


@asynccontextmanager
async def noop_lifespan(app: FastAPI) -> AsyncIterator[Mapping[str, Any] | None]:
    yield


@pytest.fixture(name="engine_test", scope="session")
def engine_test_fixture():
    url = "sqlite:///:memory:"
    engine = create_engine(
        url,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        echo=False,
    )
    yield engine
    engine.dispose()


@pytest.fixture(name="app", scope="function")
def app_fixture(engine_test):
    from main import app as real_app
    from app.core.database import get_session

    SQLModel.metadata.create_all(engine_test)

    def get_session_override():
        with Session(engine_test) as session:
            yield session

    real_app.dependency_overrides[get_session] = get_session_override
    real_app.router.lifespan_context = noop_lifespan

    session = Session(engine_test)
    _seed_test_data(session)
    session.close()

    yield real_app

    real_app.dependency_overrides.clear()
    SQLModel.metadata.drop_all(engine_test)


def _seed_test_data(session: Session) -> None:
    from app.core.rbac import ROLE_ADMIN, ROLE_CLIENT
    from app.core.rbac import STATE_PENDIENTE, STATE_CONFIRMADO, STATE_EN_PREP, STATE_ENTREGADO, STATE_CANCELADO
    from app.core.security import hash_password
    from app.modules.usuarios.models import Rol, Usuario, UsuarioRol
    from app.modules.pedidos.models import EstadoPedido, FormaPago
    from sqlmodel import select

    for codigo, nombre, descripcion in [
        (ROLE_ADMIN, "Administrador", "Acceso total al sistema"),
        (ROLE_CLIENT, "Cliente", "Usuario cliente de la tienda"),
    ]:
        existing = session.get(Rol, codigo)
        if not existing:
            session.add(Rol(codigo=codigo, nombre=nombre, descripcion=descripcion))

    for codigo, nombre, es_terminal in [
        (STATE_PENDIENTE, "Pendiente", False),
        (STATE_CONFIRMADO, "Confirmado", False),
        (STATE_EN_PREP, "En Preparación", False),
        (STATE_ENTREGADO, "Entregado", True),
        (STATE_CANCELADO, "Cancelado", True),
    ]:
        existing = session.get(EstadoPedido, codigo)
        if not existing:
            session.add(EstadoPedido(codigo=codigo, nombre=nombre, descripcion="", es_terminal=es_terminal))

    for codigo, nombre, descripcion in [
        ("EFECTIVO", "Efectivo", ""),
        ("TARJETA", "Tarjeta", ""),
        ("TRANSFERENCIA", "Transferencia", ""),
    ]:
        existing = session.get(FormaPago, codigo)
        if not existing:
            session.add(FormaPago(codigo=codigo, nombre=nombre, descripcion=descripcion))

    existing = session.exec(
        select(Usuario).where(Usuario.email == "admin@test.com")
    ).first()
    if not existing:
        admin = Usuario(
            nombre="Admin",
            apellido="Test",
            email="admin@test.com",
            password_hash=hash_password("admin123"),
            activo=True,
        )
        session.add(admin)
        session.flush()
        session.add(UsuarioRol(usuario_id=admin.id, rol_codigo=ROLE_ADMIN))

    existing = session.exec(
        select(Usuario).where(Usuario.email == "cliente@test.com")
    ).first()
    if not existing:
        cliente = Usuario(
            nombre="Cliente",
            apellido="Test",
            email="cliente@test.com",
            password_hash=hash_password("cliente123"),
            activo=True,
        )
        session.add(cliente)
        session.flush()
        session.add(UsuarioRol(usuario_id=cliente.id, rol_codigo=ROLE_CLIENT))

    session.commit()


@pytest.fixture(name="client", scope="function")
def client_fixture(app: FastAPI):
    with TestClient(app, follow_redirects=False) as client:
        yield client


@pytest.fixture(name="admin_auth_headers")
def admin_auth_headers_fixture(client: TestClient) -> dict:
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@test.com", "password": "admin123"},
    )
    assert response.status_code == 200
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(name="cliente_auth_headers")
def cliente_auth_headers_fixture(client: TestClient) -> dict:
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "cliente@test.com", "password": "cliente123"},
    )
    assert response.status_code == 200
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(name="cliente_data")
def cliente_data_fixture() -> dict:
    return {
        "nombre": "Cliente",
        "apellido": "Nuevo",
        "email": "nuevo@test.com",
        "password": "testpass123",
    }
