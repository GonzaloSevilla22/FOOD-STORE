"""Tests de integración del módulo estadísticas (solo ADMIN, KPIs de negocio)."""

from fastapi.testclient import TestClient

BASE = "/api/v1/estadisticas"


def _crear_pedido(client: TestClient, admin_headers: dict, cliente_headers: dict) -> int:
    me = client.get("/api/v1/auth/me", headers=cliente_headers)
    user_id = me.json()["id"]
    addr = client.post(
        f"/api/v1/usuarios/{user_id}/direcciones",
        headers=cliente_headers,
        json={"alias": "Casa", "linea1": "Calle 1", "ciudad": "BA", "provincia": "BA", "codigo_postal": "1000"},
    )
    addr_id = addr.json()["id"]
    prod = client.post(
        "/api/v1/productos",
        headers=admin_headers,
        json={"nombre": "Pizza", "precio_base": 10.0, "stock_manual": 50},
    )
    prod_id = prod.json()["id"]
    resp = client.post(
        "/api/v1/pedidos",
        headers=cliente_headers,
        json={"direccion_entrega_id": addr_id, "detalles": [{"producto_id": prod_id, "cantidad": 2}]},
    )
    return resp.json()["id"]


class TestEstadisticas:
    def test_resumen_requires_auth(self, client: TestClient):
        assert client.get(f"{BASE}/resumen").status_code == 401

    def test_resumen_forbidden_for_cliente(self, client: TestClient, cliente_auth_headers: dict):
        assert client.get(f"{BASE}/resumen", headers=cliente_auth_headers).status_code == 403

    def test_resumen_ok(self, client: TestClient, admin_auth_headers: dict):
        r = client.get(f"{BASE}/resumen", headers=admin_auth_headers)
        assert r.status_code == 200
        body = r.json()
        for key in [
            "total_pedidos", "pedidos_hoy", "ingresos_totales",
            "ingresos_hoy", "ticket_promedio", "productos_vendidos",
        ]:
            assert key in body

    def test_ventas_ok(self, client: TestClient, admin_auth_headers: dict):
        r = client.get(f"{BASE}/ventas", headers=admin_auth_headers)
        assert r.status_code == 200
        assert isinstance(r.json()["data"], list)

    def test_productos_top_ok(self, client: TestClient, admin_auth_headers: dict):
        r = client.get(f"{BASE}/productos-top", headers=admin_auth_headers)
        assert r.status_code == 200
        assert isinstance(r.json()["data"], list)

    def test_pedidos_por_estado_cuenta_pedido_creado(
        self, client: TestClient, admin_auth_headers: dict, cliente_auth_headers: dict
    ):
        _crear_pedido(client, admin_auth_headers, cliente_auth_headers)
        r = client.get(f"{BASE}/pedidos-por-estado", headers=admin_auth_headers)
        assert r.status_code == 200
        data = r.json()["data"]
        pendientes = [item for item in data if item["estado"] == "PENDIENTE"]
        assert pendientes and pendientes[0]["cantidad"] >= 1

    def test_ingresos_ok(self, client: TestClient, admin_auth_headers: dict):
        r = client.get(f"{BASE}/ingresos", headers=admin_auth_headers)
        assert r.status_code == 200
        body = r.json()
        for key in ["total_ingresos", "ingresos_mes_actual", "ingresos_mes_anterior"]:
            assert key in body
