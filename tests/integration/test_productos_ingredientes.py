"""Tests de ProductoIngrediente con unidad_medida_id (FK) y cantidad DECIMAL(10,3).

Consigna ERD v7 (§5):
- ProductoIngrediente.cantidad  → DECIMAL(10,3), NN, CHECK > 0
- ProductoIngrediente.unidad_medida_id → FK → UnidadMedida.id, NN
"""

from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.modules.ingredientes.models import UnidadMedida


def _crear_unidad(engine_test, nombre: str, simbolo: str, tipo: str = "peso") -> int:
    with Session(engine_test) as s:
        u = UnidadMedida(nombre=nombre, simbolo=simbolo, tipo=tipo)
        s.add(u)
        s.commit()
        s.refresh(u)
        return u.id


def _crear_ingrediente(client: TestClient, headers: dict, nombre: str) -> int:
    r = client.post(
        "/api/v1/ingredientes",
        headers=headers,
        json={"nombre": nombre, "es_alergeno": False, "unidad_medida": "gramos"},
    )
    assert r.status_code in (200, 201), r.text
    return r.json()["id"]


class TestProductoIngredienteFK:
    def test_crear_producto_con_unidad_medida_id_y_cantidad_decimal(
        self, client: TestClient, admin_auth_headers: dict, engine_test
    ):
        unidad_id = _crear_unidad(engine_test, "Gramo PI", "g")
        ing_id = _crear_ingrediente(client, admin_auth_headers, "Queso PI 1")

        r = client.post(
            "/api/v1/productos",
            headers=admin_auth_headers,
            json={
                "nombre": "Pizza PI Test",
                "precio_base": "1000.00",
                "ingredientes": [
                    {
                        "ingrediente_id": ing_id,
                        "cantidad": "200.500",
                        "unidad_medida_id": unidad_id,
                        "es_removible": False,
                    }
                ],
            },
        )
        assert r.status_code == 201, r.text
        body = r.json()
        assert len(body["ingredientes"]) == 1
        pi = body["ingredientes"][0]
        assert pi["unidad_medida_id"] == unidad_id
        # cantidad con 3 decimales
        assert Decimal(str(pi["cantidad"])) == Decimal("200.500")
        # ya no se expone el enum viejo
        assert "unidad" not in pi or pi.get("unidad") is None

    def test_respuesta_incluye_simbolo_de_unidad(
        self, client: TestClient, admin_auth_headers: dict, engine_test
    ):
        unidad_id = _crear_unidad(engine_test, "Litro PI", "L", "volumen")
        ing_id = _crear_ingrediente(client, admin_auth_headers, "Aceite PI")

        r = client.post(
            "/api/v1/productos",
            headers=admin_auth_headers,
            json={
                "nombre": "Producto Simbolo PI",
                "precio_base": "500.00",
                "ingredientes": [
                    {
                        "ingrediente_id": ing_id,
                        "cantidad": "0.050",
                        "unidad_medida_id": unidad_id,
                        "es_removible": True,
                    }
                ],
            },
        )
        assert r.status_code == 201, r.text
        pi = r.json()["ingredientes"][0]
        assert pi["unidad_simbolo"] == "L"

    def test_lista_unidades_medida_endpoint(
        self, client: TestClient, admin_auth_headers: dict, engine_test
    ):
        _crear_unidad(engine_test, "Kilo EP", "kgx", "peso")
        r = client.get("/api/v1/unidades-medida", headers=admin_auth_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert any(u["simbolo"] == "kgx" for u in data)
        item = next(u for u in data if u["simbolo"] == "kgx")
        assert set(item) >= {"id", "nombre", "simbolo", "tipo"}

    def test_unidad_medida_id_inexistente_es_rechazado(
        self, client: TestClient, admin_auth_headers: dict
    ):
        ing_id = _crear_ingrediente(client, admin_auth_headers, "Queso PI 2")
        r = client.post(
            "/api/v1/productos",
            headers=admin_auth_headers,
            json={
                "nombre": "Pizza PI Bad",
                "precio_base": "1000.00",
                "ingredientes": [
                    {
                        "ingrediente_id": ing_id,
                        "cantidad": "10.000",
                        "unidad_medida_id": 999999,
                        "es_removible": False,
                    }
                ],
            },
        )
        assert r.status_code == 422, r.text
