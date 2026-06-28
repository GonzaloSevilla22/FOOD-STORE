"""Tests de integración del WebSocket de pedidos/productos (consigna §9)."""

from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect


def _token(headers: dict) -> str:
    return headers["Authorization"].split(" ", 1)[1]


def _create_pedido(client: TestClient, admin_headers: dict, cliente_headers: dict) -> int:
    """Crea un pedido PENDIENTE como cliente y devuelve su id."""
    me = client.get("/api/v1/auth/me", headers=cliente_headers)
    user_id = me.json()["id"]
    addr = client.post(
        f"/api/v1/usuarios/{user_id}/direcciones",
        headers=cliente_headers,
        json={
            "alias": "Casa", "linea1": "Av. Siempre Viva 123",
            "ciudad": "BA", "provincia": "BA", "codigo_postal": "1000",
        },
    )
    assert addr.status_code == 201
    addr_id = addr.json()["id"]
    prod = client.post(
        "/api/v1/productos",
        headers=admin_headers,
        json={"nombre": "Pizza", "precio_base": 10.0, "stock_manual": 10},
    )
    assert prod.status_code == 201
    prod_id = prod.json()["id"]
    pedido = client.post(
        "/api/v1/pedidos",
        headers=cliente_headers,
        json={"direccion_entrega_id": addr_id, "detalles": [{"producto_id": prod_id, "cantidad": 1}]},
    )
    assert pedido.status_code == 201
    return pedido.json()["id"]


class TestWebSocketLegacy:
    def test_ws_productos_connects(self, client: TestClient):
        """El feed de productos no requiere auth: la conexión se acepta."""
        with client.websocket_connect("/ws/productos") as ws:
            ws.send_text("ping")  # el server lo recibe en su loop; no debe cerrar

    def test_ws_pedidos_rejects_without_token(self, client: TestClient):
        """Sin token, el server acepta y cierra con código de política (1008)."""
        with pytest.raises(WebSocketDisconnect):
            with client.websocket_connect("/ws/pedidos") as ws:
                ws.receive_text()

    def test_ws_pedidos_rejects_invalid_token(self, client: TestClient):
        with pytest.raises(WebSocketDisconnect):
            with client.websocket_connect("/ws/pedidos?token=token-invalido") as ws:
                ws.receive_text()

    def test_ws_pedidos_connects_with_valid_token(self, client: TestClient, admin_auth_headers: dict):
        token = _token(admin_auth_headers)
        with client.websocket_connect(f"/ws/pedidos?token={token}") as ws:
            ws.send_text("hola")  # conexión autenticada aceptada


class TestWebSocketAdminFeed:
    """Canal admin §9.2: /ws/admin/pedidos (JWT ADMIN/PEDIDOS)."""

    def test_admin_feed_rejects_without_token(self, client: TestClient):
        with pytest.raises(WebSocketDisconnect):
            with client.websocket_connect("/ws/admin/pedidos") as ws:
                ws.receive_text()

    def test_admin_feed_rejects_client_token(self, client: TestClient, cliente_auth_headers: dict):
        """Un CLIENT no puede suscribirse al feed admin."""
        token = _token(cliente_auth_headers)
        with pytest.raises(WebSocketDisconnect):
            with client.websocket_connect(f"/ws/admin/pedidos?token={token}") as ws:
                ws.receive_text()

    def test_admin_feed_connects_with_admin_token(self, client: TestClient, admin_auth_headers: dict):
        token = _token(admin_auth_headers)
        with client.websocket_connect(f"/ws/admin/pedidos?token={token}") as ws:
            ws.send_text("hola")


class TestWebSocketPedidoById:
    """Canal por pedido §9.2: /ws/pedidos/{id}."""

    def test_pedido_feed_connects_for_owner(
        self, client: TestClient, admin_auth_headers: dict, cliente_auth_headers: dict
    ):
        pedido_id = _create_pedido(client, admin_auth_headers, cliente_auth_headers)
        token = _token(cliente_auth_headers)
        with client.websocket_connect(f"/ws/pedidos/{pedido_id}?token={token}") as ws:
            ws.send_text("hola")

    def test_pedido_feed_rejects_non_owner_client(
        self, client: TestClient, admin_auth_headers: dict, cliente_auth_headers: dict
    ):
        """Un cliente que no es dueño del pedido no puede suscribirse a él."""
        pedido_id = _create_pedido(client, admin_auth_headers, cliente_auth_headers)
        # admin crea otro cliente y lo usa para intentar espiar el pedido ajeno
        client.post(
            "/api/v1/auth/register",
            json={"nombre": "Otro", "apellido": "Cliente", "email": "otro@test.com", "password": "otropass123"},
        )
        login = client.post("/api/v1/auth/login", json={"email": "otro@test.com", "password": "otropass123"})
        token = login.json()["access_token"]
        with pytest.raises(WebSocketDisconnect):
            with client.websocket_connect(f"/ws/pedidos/{pedido_id}?token={token}") as ws:
                ws.receive_text()


class TestWebSocketEventDelivery:
    """El cambio de estado emite el evento §9.4 por broadcast_pedido (post-commit)."""

    def test_state_change_broadcasts_94_event(
        self, client: TestClient, admin_auth_headers: dict, cliente_auth_headers: dict
    ):
        pedido_id = _create_pedido(client, admin_auth_headers, cliente_auth_headers)
        fake_manager = AsyncMock()
        with patch("app.modules.pedidos.service.manager", fake_manager):
            resp = client.patch(f"/api/v1/pedidos/{pedido_id}/confirmar", headers=cliente_auth_headers, json={})
            assert resp.status_code == 200

        fake_manager.broadcast_pedido.assert_awaited_once()
        args, _ = fake_manager.broadcast_pedido.call_args
        broadcast_pedido_id, evento = args
        assert broadcast_pedido_id == pedido_id
        assert set(evento.keys()) == {
            "event", "pedido_id", "estado_anterior", "estado_nuevo",
            "usuario_id", "motivo", "timestamp",
        }
        assert evento["event"] in {"estado_cambiado", "pedido_cancelado", "pago_confirmado"}
        assert evento["pedido_id"] == pedido_id
        assert evento["estado_anterior"] == "PENDIENTE"
        assert evento["estado_nuevo"] == "CONFIRMADO"

    def test_admin_feed_receives_event_live(
        self, client: TestClient, admin_auth_headers: dict, cliente_auth_headers: dict
    ):
        """E2E real: un admin suscripto al feed recibe el evento al cambiar el estado."""
        pedido_id = _create_pedido(client, admin_auth_headers, cliente_auth_headers)
        admin_token = _token(admin_auth_headers)
        with client.websocket_connect(f"/ws/admin/pedidos?token={admin_token}") as ws:
            resp = client.patch(
                f"/api/v1/pedidos/{pedido_id}/confirmar", headers=cliente_auth_headers, json={}
            )
            assert resp.status_code == 200
            evento = ws.receive_json()
        assert evento["pedido_id"] == pedido_id
        assert evento["estado_nuevo"] == "CONFIRMADO"
        assert evento["event"] in {"estado_cambiado", "pedido_cancelado", "pago_confirmado"}
