import pytest
from fastapi.testclient import TestClient


class TestPedidosFlow:
    def test_create_pedido_and_check_state(self, client: TestClient, admin_auth_headers: dict, cliente_auth_headers: dict):
        me = client.get("/api/v1/auth/me", headers=cliente_auth_headers)
        user_id = me.json()["id"]
        addr = client.post(f"/api/v1/usuarios/{user_id}/direcciones", headers=cliente_auth_headers, json={
            "alias": "Casa", "linea1": "Av. Siempre Viva 123", "ciudad": "BA", "provincia": "BA", "codigo_postal": "1000",
        })
        assert addr.status_code == 201
        addr_id = addr.json()["id"]
        prod = client.post("/api/v1/productos", headers=admin_auth_headers, json={
            "nombre": "Pizza", "precio_base": 10.0, "stock_manual": 10,
        })
        assert prod.status_code == 201
        prod_id = prod.json()["id"]
        response = client.post("/api/v1/pedidos", headers=cliente_auth_headers, json={
            "direccion_entrega_id": addr_id,
            "detalles": [{"producto_id": prod_id, "cantidad": 1}],
        })
        assert response.status_code == 201
        data = response.json()
        assert data["estado_codigo"] == "PENDIENTE"

    def test_create_pedido_without_auth_returns_401(self, client: TestClient):
        response = client.post("/api/v1/pedidos", json={
            "direccion_entrega_id": 1,
            "detalles": [{"producto_id": 1, "cantidad": 1}],
        })
        assert response.status_code == 401

    def test_create_pedido_with_direccion_and_productos(
        self, client: TestClient, admin_auth_headers: dict, cliente_auth_headers: dict
    ):
        me = client.get("/api/v1/auth/me", headers=cliente_auth_headers)
        user_id = me.json()["id"]
        addr = client.post(f"/api/v1/usuarios/{user_id}/direcciones", headers=cliente_auth_headers, json={
            "alias": "Casa", "linea1": "Av. Siempre Viva 123", "ciudad": "BA", "provincia": "BA", "codigo_postal": "1000",
        })
        assert addr.status_code == 201
        addr_id = addr.json()["id"]
        prod = client.post("/api/v1/productos", headers=admin_auth_headers, json={
            "nombre": "Pizza", "precio_base": 10.0, "stock_manual": 10,
        })
        assert prod.status_code == 201
        prod_id = prod.json()["id"]
        response = client.post("/api/v1/pedidos", headers=cliente_auth_headers, json={
            "direccion_entrega_id": addr_id,
            "detalles": [{"producto_id": prod_id, "cantidad": 2}],
        })
        assert response.status_code == 201
        data = response.json()
        assert data["estado_codigo"] == "PENDIENTE"
        assert float(data["total"]) > 0
