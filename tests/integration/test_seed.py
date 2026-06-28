"""Tests del seed obligatorio (consigna §14.2, criterio CE-05).

`python -m app.db.seed` debe cargar: roles, estados (con es_terminal),
formas de pago, unidades de medida y el usuario admin de la consigna.
"""

import pytest
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine, select

from app.db.seed import seed_required_data
from app.core.security import verify_password
from app.modules.usuarios.models import Rol, Usuario, UsuarioRol
from app.modules.pedidos.models import EstadoPedido, FormaPago
from app.modules.ingredientes.models import UnidadMedida


@pytest.fixture(name="seed_session")
def seed_session_fixture():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session
    engine.dispose()


class TestSeedRequiredData:
    def test_crea_los_cuatro_roles(self, seed_session: Session):
        seed_required_data(seed_session)
        codigos = {r.codigo for r in seed_session.exec(select(Rol)).all()}
        assert {"ADMIN", "STOCK", "PEDIDOS", "CLIENT"} <= codigos

    def test_crea_cinco_estados_con_es_terminal(self, seed_session: Session):
        seed_required_data(seed_session)
        estados = {e.codigo: e.es_terminal for e in seed_session.exec(select(EstadoPedido)).all()}
        assert set(estados) == {"PENDIENTE", "CONFIRMADO", "EN_PREP", "A_ENTREGAR", "ESPERANDO_CLIENTE", "ENTREGADO", "CANCELADO"}
        # Solo ENTREGADO y CANCELADO son terminales
        assert estados["ENTREGADO"] is True
        assert estados["CANCELADO"] is True
        assert estados["PENDIENTE"] is False
        assert estados["CONFIRMADO"] is False
        assert estados["EN_PREP"] is False
        assert estados["A_ENTREGAR"] is False
        assert estados["ESPERANDO_CLIENTE"] is False

    def test_crea_las_tres_formas_de_pago(self, seed_session: Session):
        seed_required_data(seed_session)
        codigos = {f.codigo for f in seed_session.exec(select(FormaPago)).all()}
        assert {"MERCADOPAGO", "EFECTIVO", "TRANSFERENCIA"} <= codigos

    def test_crea_las_seis_unidades_de_medida(self, seed_session: Session):
        seed_required_data(seed_session)
        simbolos = {u.simbolo for u in seed_session.exec(select(UnidadMedida)).all()}
        assert {"kg", "g", "L", "ml", "ud", "porciones"} == simbolos

    def test_crea_admin_de_la_consigna(self, seed_session: Session):
        seed_required_data(seed_session)
        admin = seed_session.exec(
            select(Usuario).where(Usuario.email == "admin@foodstore.com")
        ).first()
        assert admin is not None
        assert verify_password("Admin1234!", admin.password_hash)
        roles = seed_session.exec(
            select(UsuarioRol).where(UsuarioRol.usuario_id == admin.id)
        ).all()
        assert "ADMIN" in {r.rol_codigo for r in roles}

    def test_es_idempotente(self, seed_session: Session):
        seed_required_data(seed_session)
        seed_required_data(seed_session)  # segunda corrida no debe duplicar
        assert len(seed_session.exec(select(UnidadMedida)).all()) == 6
        assert len(seed_session.exec(select(EstadoPedido)).all()) == 7
        admins = seed_session.exec(
            select(Usuario).where(Usuario.email == "admin@foodstore.com")
        ).all()
        assert len(admins) == 1
