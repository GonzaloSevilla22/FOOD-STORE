"""Tests de flujo completo: Ingredientes -> Productos -> Venta -> Deduccion de Stock.

Prueba que al vender productos compuestos por ingredientes:
1. Se deduzcan los ingredientes del stock
2. El stock_disponible del producto se recalcule correctamente
3. La cancelacion restaure el stock
4. Stock insuficiente impida la confirmacion
"""

import pytest
from decimal import Decimal
from fastapi.testclient import TestClient
from sqlmodel import Session
from app.modules.ingredientes.models import Ingrediente


def _crear_unidad(engine_test, nombre="Gramo", simbolo="g", tipo="peso") -> int:
    from app.modules.ingredientes.models import UnidadMedida
    with Session(engine_test) as s:
        u = UnidadMedida(nombre=nombre, simbolo=simbolo, tipo=tipo)
        s.add(u)
        s.commit()
        s.refresh(u)
        return u.id


def _crear_direccion(client, headers, user_id) -> int:
    r = client.post(
        f"/api/v1/usuarios/{user_id}/direcciones",
        headers=headers,
        json={
            "alias": "Casa",
            "linea1": "Av. Siempre Viva 123",
            "ciudad": "Buenos Aires",
            "provincia": "BA",
            "codigo_postal": "1000",
        },
    )
    assert r.status_code == 201, r.text
    return r.json()["id"]


class TestStockDeductionFlow:
    """Flujo basico: ingrediente -> producto -> pedido -> confirmar -> verificar stock."""

    def test_full_flow_stock_deduction(self, client, admin_auth_headers, cliente_auth_headers, engine_test):
        unidad_id = _crear_unidad(engine_test)

        r = client.post(
            "/api/v1/ingredientes",
            headers=admin_auth_headers,
            json={
                "nombre": "Queso Mozzarella Test",
                "es_alergeno": False,
                "stock_actual": 1000.0,
                "stock_minimo": 50.0,
                "costo_unitario": "2.5000",
                "unidad_medida": "gramos",
            },
        )
        assert r.status_code in (200, 201), r.text
        ing_id = r.json()["id"]
        assert r.json()["stock_actual"] == 1000.0

        r = client.post(
            "/api/v1/productos",
            headers=admin_auth_headers,
            json={
                "nombre": "Pizza Mozzarella Test",
                "precio_base": "1500.00",
                "disponible": True,
                "usa_stock_manual": False,
                "ingredientes": [
                    {
                        "ingrediente_id": ing_id,
                        "cantidad": "200.000",
                        "unidad_medida_id": unidad_id,
                        "es_removible": False,
                        "es_opcional": False,
                    }
                ],
            },
        )
        assert r.status_code == 201, r.text
        prod_id = r.json()["id"]
        assert r.json()["usa_stock_manual"] is False
        assert r.json()["stock_disponible"] == 5

        me = client.get("/api/v1/auth/me", headers=cliente_auth_headers)
        user_id = me.json()["id"]
        addr_id = _crear_direccion(client, cliente_auth_headers, user_id)

        r = client.post(
            "/api/v1/pedidos",
            headers=cliente_auth_headers,
            json={
                "direccion_entrega_id": addr_id,
                "detalles": [{"producto_id": prod_id, "cantidad": 1}],
            },
        )
        assert r.status_code == 201, r.text
        pedido_id = r.json()["id"]
        assert r.json()["estado_codigo"] == "PENDIENTE"

        with Session(engine_test) as s:
            ing = s.get(Ingrediente, ing_id)
            assert ing.stock_actual == 1000.0

        r = client.patch(
            f"/api/v1/pedidos/{pedido_id}/confirmar",
            headers=cliente_auth_headers,
            json={},
        )
        assert r.status_code == 200, r.text
        assert r.json()["estado_codigo"] == "CONFIRMADO"
        assert "Stock descontado" in r.json()["mensaje"]

        with Session(engine_test) as s:
            ing = s.get(Ingrediente, ing_id)
            assert ing.stock_actual == 800.0, f"Esperaba 800.0, obtuvo {ing.stock_actual}"

        r = client.get(f"/api/v1/productos/{prod_id}", headers=admin_auth_headers)
        assert r.status_code == 200
        assert r.json()["stock_disponible"] == 4

    def test_multiple_units_deducts_proportionally(self, client, admin_auth_headers, cliente_auth_headers, engine_test):
        unidad_id = _crear_unidad(engine_test)

        r = client.post(
            "/api/v1/ingredientes",
            headers=admin_auth_headers,
            json={
                "nombre": "Queso Multi Test",
                "es_alergeno": False,
                "stock_actual": 1000.0,
                "stock_minimo": 50.0,
                "costo_unitario": "2.5000",
                "unidad_medida": "gramos",
            },
        )
        ing_id = r.json()["id"]

        r = client.post(
            "/api/v1/productos",
            headers=admin_auth_headers,
            json={
                "nombre": "Pizza Multi Test",
                "precio_base": "1500.00",
                "ingredientes": [
                    {
                        "ingrediente_id": ing_id,
                        "cantidad": "200.000",
                        "unidad_medida_id": unidad_id,
                        "es_removible": False,
                    }
                ],
            },
        )
        prod_id = r.json()["id"]
        assert r.json()["stock_disponible"] == 5

        me = client.get("/api/v1/auth/me", headers=cliente_auth_headers)
        user_id = me.json()["id"]
        addr_id = _crear_direccion(client, cliente_auth_headers, user_id)

        r = client.post(
            "/api/v1/pedidos",
            headers=cliente_auth_headers,
            json={
                "direccion_entrega_id": addr_id,
                "detalles": [{"producto_id": prod_id, "cantidad": 3}],
            },
        )
        pedido_id = r.json()["id"]

        r = client.patch(
            f"/api/v1/pedidos/{pedido_id}/confirmar",
            headers=cliente_auth_headers,
            json={},
        )
        assert r.status_code == 200

        with Session(engine_test) as s:
            ing = s.get(Ingrediente, ing_id)
            assert ing.stock_actual == 400.0, f"Esperaba 400.0, obtuvo {ing.stock_actual}"

    def test_cancel_restores_stock(self, client, admin_auth_headers, cliente_auth_headers, engine_test):
        unidad_id = _crear_unidad(engine_test)

        r = client.post(
            "/api/v1/ingredientes",
            headers=admin_auth_headers,
            json={
                "nombre": "Queso Cancel Test",
                "stock_actual": 500.0,
                "stock_minimo": 10.0,
                "costo_unitario": "2.5000",
                "unidad_medida": "gramos",
            },
        )
        ing_id = r.json()["id"]

        r = client.post(
            "/api/v1/productos",
            headers=admin_auth_headers,
            json={
                "nombre": "Pizza Cancel Test",
                "precio_base": "1500.00",
                "ingredientes": [
                    {
                        "ingrediente_id": ing_id,
                        "cantidad": "200.000",
                        "unidad_medida_id": unidad_id,
                        "es_removible": False,
                    }
                ],
            },
        )
        prod_id = r.json()["id"]

        me = client.get("/api/v1/auth/me", headers=cliente_auth_headers)
        user_id = me.json()["id"]
        addr_id = _crear_direccion(client, cliente_auth_headers, user_id)

        r = client.post(
            "/api/v1/pedidos",
            headers=cliente_auth_headers,
            json={
                "direccion_entrega_id": addr_id,
                "detalles": [{"producto_id": prod_id, "cantidad": 1}],
            },
        )
        pedido_id = r.json()["id"]

        r = client.patch(
            f"/api/v1/pedidos/{pedido_id}/confirmar",
            headers=cliente_auth_headers,
            json={},
        )
        assert r.status_code == 200

        with Session(engine_test) as s:
            ing = s.get(Ingrediente, ing_id)
            assert ing.stock_actual == 300.0

        r = client.patch(
            f"/api/v1/pedidos/{pedido_id}/cancelar",
            headers=admin_auth_headers,
            json={},
        )
        assert r.status_code == 200

        with Session(engine_test) as s:
            ing = s.get(Ingrediente, ing_id)
            assert ing.stock_actual == 500.0, f"Esperaba 500.0, obtuvo {ing.stock_actual}"

    def test_insufficient_ingredient_stock_rejects(self, client, admin_auth_headers, cliente_auth_headers, engine_test):
        unidad_id = _crear_unidad(engine_test)

        r = client.post(
            "/api/v1/ingredientes",
            headers=admin_auth_headers,
            json={
                "nombre": "Queso Insuficiente Test",
                "stock_actual": 100.0,
                "stock_minimo": 10.0,
                "costo_unitario": "2.5000",
                "unidad_medida": "gramos",
            },
        )
        ing_id = r.json()["id"]

        r = client.post(
            "/api/v1/productos",
            headers=admin_auth_headers,
            json={
                "nombre": "Pizza Insuficiente Test",
                "precio_base": "1500.00",
                "ingredientes": [
                    {
                        "ingrediente_id": ing_id,
                        "cantidad": "200.000",
                        "unidad_medida_id": unidad_id,
                        "es_removible": False,
                    }
                ],
            },
        )
        prod_id = r.json()["id"]
        assert r.json()["stock_disponible"] == 0

        me = client.get("/api/v1/auth/me", headers=cliente_auth_headers)
        user_id = me.json()["id"]
        addr_id = _crear_direccion(client, cliente_auth_headers, user_id)

        r = client.post(
            "/api/v1/pedidos",
            headers=cliente_auth_headers,
            json={
                "direccion_entrega_id": addr_id,
                "detalles": [{"producto_id": prod_id, "cantidad": 1}],
            },
        )
        assert r.status_code == 400, r.text
        assert "Stock insuficiente de Pizza Insuficiente Test ¡fijate si te gusta otra cosa en el menú!" in r.text

        with Session(engine_test) as s:
            ing = s.get(Ingrediente, ing_id)
            assert ing.stock_actual == 100.0

    def test_two_ingredients_deducted_simultaneously(self, client, admin_auth_headers, cliente_auth_headers, engine_test):
        unidad_g = _crear_unidad(engine_test, "Gramo Test", "g", "peso")
        unidad_l = _crear_unidad(engine_test, "Litro Test", "L", "volumen")

        r = client.post(
            "/api/v1/ingredientes",
            headers=admin_auth_headers,
            json={
                "nombre": "Harina Test",
                "stock_actual": 5000.0,
                "costo_unitario": "1.0000",
                "unidad_medida": "gramos",
            },
        )
        harina_id = r.json()["id"]

        r = client.post(
            "/api/v1/ingredientes",
            headers=admin_auth_headers,
            json={
                "nombre": "Aceite Test",
                "stock_actual": 10.0,
                "costo_unitario": "3.0000",
                "unidad_medida": "mililitros",
            },
        )
        aceite_id = r.json()["id"]

        r = client.post(
            "/api/v1/productos",
            headers=admin_auth_headers,
            json={
                "nombre": "Masa con Aceite Test",
                "precio_base": "2000.00",
                "ingredientes": [
                    {
                        "ingrediente_id": harina_id,
                        "cantidad": "500.000",
                        "unidad_medida_id": unidad_g,
                        "es_removible": False,
                    },
                    {
                        "ingrediente_id": aceite_id,
                        "cantidad": "0.100",
                        "unidad_medida_id": unidad_l,
                        "es_removible": False,
                    },
                ],
            },
        )
        assert r.status_code == 201, r.text
        prod_id = r.json()["id"]
        assert r.json()["stock_disponible"] == 10

        me = client.get("/api/v1/auth/me", headers=cliente_auth_headers)
        user_id = me.json()["id"]
        addr_id = _crear_direccion(client, cliente_auth_headers, user_id)

        r = client.post(
            "/api/v1/pedidos",
            headers=cliente_auth_headers,
            json={
                "direccion_entrega_id": addr_id,
                "detalles": [{"producto_id": prod_id, "cantidad": 2}],
            },
        )
        pedido_id = r.json()["id"]

        r = client.patch(
            f"/api/v1/pedidos/{pedido_id}/confirmar",
            headers=cliente_auth_headers,
            json={},
        )
        assert r.status_code == 200

        with Session(engine_test) as s:
            harina = s.get(Ingrediente, harina_id)
            aceite = s.get(Ingrediente, aceite_id)
            assert harina.stock_actual == 4000.0, f"Esperaba 4000.0, obtuvo {harina.stock_actual}"
            assert aceite.stock_actual == 9.8, f"Esperaba 9.8, obtuvo {aceite.stock_actual}"

    def test_stock_disponible_updates_after_confirmation(self, client, admin_auth_headers, cliente_auth_headers, engine_test):
        unidad_id = _crear_unidad(engine_test)

        r = client.post(
            "/api/v1/ingredientes",
            headers=admin_auth_headers,
            json={
                "nombre": "Tomate Test",
                "stock_actual": 1000.0,
                "costo_unitario": "1.5000",
                "unidad_medida": "gramos",
            },
        )
        ing_id = r.json()["id"]

        r = client.post(
            "/api/v1/productos",
            headers=admin_auth_headers,
            json={
                "nombre": "Pizza Tomate Test",
                "precio_base": "1600.00",
                "ingredientes": [
                    {
                        "ingrediente_id": ing_id,
                        "cantidad": "250.000",
                        "unidad_medida_id": unidad_id,
                        "es_removible": False,
                    }
                ],
            },
        )
        prod_id = r.json()["id"]
        assert r.json()["stock_disponible"] == 4

        me = client.get("/api/v1/auth/me", headers=cliente_auth_headers)
        user_id = me.json()["id"]
        addr_id = _crear_direccion(client, cliente_auth_headers, user_id)

        r = client.post(
            "/api/v1/pedidos",
            headers=cliente_auth_headers,
            json={
                "direccion_entrega_id": addr_id,
                "detalles": [{"producto_id": prod_id, "cantidad": 2}],
            },
        )
        pedido_id = r.json()["id"]

        r = client.get(f"/api/v1/productos/{prod_id}", headers=admin_auth_headers)
        assert r.json()["stock_disponible"] == 4

        r = client.patch(
            f"/api/v1/pedidos/{pedido_id}/confirmar",
            headers=cliente_auth_headers,
            json={},
        )
        assert r.status_code == 200

        r = client.get(f"/api/v1/productos/{prod_id}", headers=admin_auth_headers)
        assert r.json()["stock_disponible"] == 2
