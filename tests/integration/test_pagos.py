import os
import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from fastapi.testclient import TestClient


def _create_pedido(client, admin_auth_headers, cliente_auth_headers):
    me = client.get("/api/v1/auth/me", headers=cliente_auth_headers)
    user_id = me.json()["id"]
    addr = client.post(f"/api/v1/usuarios/{user_id}/direcciones", headers=cliente_auth_headers, json={
        "alias": "Casa", "linea1": "Av. Siempre Viva 123", "ciudad": "BA", "provincia": "BA", "codigo_postal": "1000",
    })
    addr_id = addr.json()["id"]
    prod = client.post("/api/v1/productos", headers=admin_auth_headers, json={
        "nombre": "Pizza", "precio_base": 10.0, "stock_manual": 10,
    })
    prod_id = prod.json()["id"]
    pedido = client.post("/api/v1/pedidos", headers=cliente_auth_headers, json={
        "direccion_entrega_id": addr_id,
        "detalles": [{"producto_id": prod_id, "cantidad": 1}],
    })
    return pedido.json()["id"]


class TestPagosFlow:
    def test_create_preference_without_mp_configured(
        self, client: TestClient, admin_auth_headers: dict, cliente_auth_headers: dict
    ):
        pedido_id = _create_pedido(client, admin_auth_headers, cliente_auth_headers)
        from app.modules.payments.service import PaymentService
        with patch.object(PaymentService, "_get_mp_access_token", return_value=None):
            response = client.post(
                "/api/v1/pagos/create-preference",
                headers=cliente_auth_headers,
                json={"pedido_id": pedido_id},
            )
        assert response.status_code == 400
        assert "MercadoPago no configurado" in response.text

    def test_create_preference_success(
        self, client: TestClient, admin_auth_headers: dict, cliente_auth_headers: dict
    ):
        pedido_id = _create_pedido(client, admin_auth_headers, cliente_auth_headers)
        from app.modules.payments.service import PaymentService
        with patch.object(PaymentService, "_crear_preferencia_mp", new=AsyncMock(return_value={
            "preference_id": "pref_123",
            "init_point": "https://mercadopago.com/checkout/123",
        })):
            with patch.object(PaymentService, "_get_mp_access_token", return_value="test_token"):
                response = client.post(
                    "/api/v1/pagos/create-preference",
                    headers=cliente_auth_headers,
                    json={"pedido_id": pedido_id},
                )
        assert response.status_code == 200
        data = response.json()
        assert data["preference_id"] == "pref_123"
        assert "init_point" in data

    def test_create_preference_mp_sdk_error(
        self, client: TestClient, admin_auth_headers: dict, cliente_auth_headers: dict
    ):
        pedido_id = _create_pedido(client, admin_auth_headers, cliente_auth_headers)
        from app.modules.payments.service import PaymentService
        with patch.object(PaymentService, "_crear_preferencia_mp", new=AsyncMock(side_effect=RuntimeError("MP error"))):
            with patch.object(PaymentService, "_get_mp_access_token", return_value="test_token"):
                response = client.post(
                    "/api/v1/pagos/create-preference",
                    headers=cliente_auth_headers,
                    json={"pedido_id": pedido_id},
                )
        assert response.status_code == 400

    def test_create_preference_wrong_owner(
        self, client: TestClient, admin_auth_headers: dict, cliente_auth_headers: dict
    ):
        pedido_id = _create_pedido(client, admin_auth_headers, cliente_auth_headers)
        response = client.post(
            "/api/v1/pagos/create-preference",
            headers=admin_auth_headers,
            json={"pedido_id": pedido_id},
        )
        assert response.status_code == 403
        assert "No puedes pagar un pedido que no te pertenece" in response.text

    def test_webhook_ignores_non_payment_topic(self, client: TestClient):
        response = client.post(
            "/api/v1/pagos/webhook",
            json={"topic": "test", "id": 123},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ignored"

    def test_webhook_ignores_no_id(self, client: TestClient):
        response = client.post(
            "/api/v1/pagos/webhook",
            json={},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ignored"
        assert data["reason"] == "No payment ID"

    def test_webhook_approved_updates_pedido(
        self, client: TestClient, admin_auth_headers: dict, cliente_auth_headers: dict
    ):
        pedido_id = _create_pedido(client, admin_auth_headers, cliente_auth_headers)
        desde = client.get(f"/api/v1/pedidos/{pedido_id}", headers=cliente_auth_headers)
        assert desde.json()["estado_codigo"] == "PENDIENTE"

        from app.modules.payments.service import PaymentService
        with patch.object(PaymentService, "_crear_preferencia_mp", new=AsyncMock(return_value={
            "preference_id": "pref_abc",
            "init_point": "https://mp.com/abc",
        })):
            with patch.object(PaymentService, "_get_mp_access_token", return_value="test_token"):
                client.post(
                    "/api/v1/pagos/create-preference",
                    headers=cliente_auth_headers,
                    json={"pedido_id": pedido_id},
                )

        from app.modules.payments.service import PaymentService
        with patch.object(PaymentService, "_consultar_pago_mp", new=AsyncMock(return_value={
            "mp_payment_id": 5000,
            "mp_status": "approved",
            "mp_status_detail": "accredited",
            "mp_merchant_order_id": 9000,
        })):
            with patch.object(PaymentService, "_get_mp_access_token", return_value="test_token"):
                response = client.post(
                    "/api/v1/pagos/webhook",
                    json={"type": "payment", "data": {"id": "5000"}},
                )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ignored"
        assert "Pago not found" in data["reason"]

    def test_redirect_after_pago_returns_redirect(self, client: TestClient):
        response = client.get("/api/v1/pagos/redirect/1/success")
        assert response.status_code == 307
        # El endpoint redirige al frontend con: /pedido/{pedido_id}?status={status}
        assert "/pedido/1?status=success" in response.headers.get("location", "")

    def test_confirm_payment_pedido_not_found(
        self, client: TestClient, admin_auth_headers: dict
    ):
        response = client.post(
            "/api/v1/pagos/confirm",
            headers=admin_auth_headers,
            json={"pedido_id": 999999},
        )
        assert response.status_code == 404

    def test_confirm_payment_without_payment_id_returns_estado_null(
        self, client: TestClient, admin_auth_headers: dict
    ):
        pedido_id = _create_pedido(client, admin_auth_headers, admin_auth_headers)
        response = client.post(
            "/api/v1/pagos/confirm",
            headers=admin_auth_headers,
            json={"pedido_id": pedido_id},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["pedido_id"] == pedido_id

    def test_confirm_payment_with_payment_id_and_mock(
        self, client: TestClient, admin_auth_headers: dict
    ):
        pedido_id = _create_pedido(client, admin_auth_headers, admin_auth_headers)
        from app.modules.payments.service import PaymentService
        with patch.object(PaymentService, "_consultar_pago_mp", new=AsyncMock(return_value={
            "mp_payment_id": 5001,
            "mp_status": "approved",
            "mp_status_detail": "accredited",
            "mp_merchant_order_id": 9001,
        })):
            response = client.post(
                "/api/v1/pagos/confirm",
                headers=admin_auth_headers,
                json={"pedido_id": pedido_id, "payment_id": 5001},
            )
        assert response.status_code == 200
        data = response.json()
        assert data["pedido_id"] == pedido_id


class TestPagosWebSocketCE09:
    """CE-09: el pago notifica vía WS (consigna §9.4, §289, §655).

    El pago aprobado emite 'pago_confirmado' (pedido → CONFIRMADO) y el
    rechazado emite 'pago_rechazado' (el pedido NO avanza). La emisión es
    post-commit, vía manager.broadcast_pedido, y no se duplica en reintentos.
    """

    def _crear_pago_pendiente(self, client, admin_auth_headers, cliente_auth_headers) -> int:
        pedido_id = _create_pedido(client, admin_auth_headers, cliente_auth_headers)
        from app.modules.payments.service import PaymentService
        with patch.object(PaymentService, "_crear_preferencia_mp", new=AsyncMock(return_value={
            "preference_id": "pref_ws",
            "init_point": "https://mp.com/ws",
        })):
            with patch.object(PaymentService, "_get_mp_access_token", return_value="test_token"):
                client.post(
                    "/api/v1/pagos/create-preference",
                    headers=cliente_auth_headers,
                    json={"pedido_id": pedido_id},
                )
        return pedido_id

    def test_webhook_approved_broadcasts_pago_confirmado(
        self, client: TestClient, admin_auth_headers: dict, cliente_auth_headers: dict
    ):
        pedido_id = self._crear_pago_pendiente(client, admin_auth_headers, cliente_auth_headers)
        from app.modules.payments.service import PaymentService
        fake_manager = AsyncMock()
        with patch.object(PaymentService, "_consultar_pago_mp", new=AsyncMock(return_value={
            "mp_payment_id": 5000,
            "mp_status": "approved",
            "mp_status_detail": "accredited",
            "mp_merchant_order_id": 9000,
            "external_reference": str(pedido_id),
        })):
            with patch.object(PaymentService, "_get_mp_access_token", return_value="test_token"):
                with patch("app.modules.payments.service.manager", fake_manager):
                    resp = client.post(
                        "/api/v1/pagos/webhook",
                        json={"type": "payment", "data": {"id": "5000"}},
                    )
        assert resp.status_code == 200
        assert resp.json()["status"] == "processed"

        fake_manager.broadcast_pedido.assert_awaited_once()
        args, _ = fake_manager.broadcast_pedido.call_args
        broadcast_pedido_id, evento = args
        assert broadcast_pedido_id == pedido_id
        assert set(evento.keys()) == {
            "event", "pedido_id", "estado_anterior", "estado_nuevo",
            "usuario_id", "motivo", "timestamp",
        }
        assert evento["event"] == "pago_confirmado"
        assert evento["pedido_id"] == pedido_id
        assert evento["estado_anterior"] == "PENDIENTE"
        assert evento["estado_nuevo"] == "CONFIRMADO"
        # El webhook lo dispara "el sistema" (§9.4): usuario_id null.
        assert evento["usuario_id"] is None

    def test_webhook_rejected_broadcasts_pago_rechazado(
        self, client: TestClient, admin_auth_headers: dict, cliente_auth_headers: dict
    ):
        pedido_id = self._crear_pago_pendiente(client, admin_auth_headers, cliente_auth_headers)
        from app.modules.payments.service import PaymentService
        fake_manager = AsyncMock()
        with patch.object(PaymentService, "_consultar_pago_mp", new=AsyncMock(return_value={
            "mp_payment_id": 5001,
            "mp_status": "rejected",
            "mp_status_detail": "cc_rejected_other_reason",
            "mp_merchant_order_id": 9001,
            "external_reference": str(pedido_id),
        })):
            with patch.object(PaymentService, "_get_mp_access_token", return_value="test_token"):
                with patch("app.modules.payments.service.manager", fake_manager):
                    resp = client.post(
                        "/api/v1/pagos/webhook",
                        json={"type": "payment", "data": {"id": "5001"}},
                    )
        assert resp.status_code == 200

        fake_manager.broadcast_pedido.assert_awaited_once()
        args, _ = fake_manager.broadcast_pedido.call_args
        broadcast_pedido_id, evento = args
        assert broadcast_pedido_id == pedido_id
        assert evento["event"] == "pago_rechazado"
        assert evento["pedido_id"] == pedido_id
        # Un pago rechazado NO avanza el pedido: sigue PENDIENTE.
        assert evento["estado_nuevo"] == "PENDIENTE"

    def test_webhook_already_approved_does_not_rebroadcast(
        self, client: TestClient, admin_auth_headers: dict, cliente_auth_headers: dict
    ):
        pedido_id = self._crear_pago_pendiente(client, admin_auth_headers, cliente_auth_headers)
        from app.modules.payments.service import PaymentService
        approved = AsyncMock(return_value={
            "mp_payment_id": 5002,
            "mp_status": "approved",
            "mp_status_detail": "accredited",
            "mp_merchant_order_id": 9002,
            "external_reference": str(pedido_id),
        })
        with patch.object(PaymentService, "_consultar_pago_mp", new=approved):
            with patch.object(PaymentService, "_get_mp_access_token", return_value="test_token"):
                # 1er webhook: procesa y emite (manager real, no-op sin conexiones).
                client.post("/api/v1/pagos/webhook", json={"type": "payment", "data": {"id": "5002"}})
                # 2do webhook: ya aprobado → no debe re-emitir (sin doble notificación).
                fake_manager = AsyncMock()
                with patch("app.modules.payments.service.manager", fake_manager):
                    resp = client.post("/api/v1/pagos/webhook", json={"type": "payment", "data": {"id": "5002"}})
        assert resp.status_code == 200
        assert resp.json()["status"] == "already_processed"
        fake_manager.broadcast_pedido.assert_not_awaited()

    def test_confirm_payment_approved_broadcasts(
        self, client: TestClient, admin_auth_headers: dict, cliente_auth_headers: dict
    ):
        """Triangulación: el endpoint confirm/verify también notifica al aprobar."""
        pedido_id = self._crear_pago_pendiente(client, admin_auth_headers, cliente_auth_headers)
        from app.modules.payments.service import PaymentService
        fake_manager = AsyncMock()
        with patch.object(PaymentService, "_consultar_pago_mp", new=AsyncMock(return_value={
            "mp_payment_id": 7000,
            "mp_status": "approved",
            "mp_status_detail": "accredited",
            "mp_merchant_order_id": 9100,
            "external_reference": str(pedido_id),
        })):
            with patch.object(PaymentService, "_get_mp_access_token", return_value="test_token"):
                with patch("app.modules.payments.service.manager", fake_manager):
                    resp = client.post(
                        "/api/v1/pagos/confirm",
                        headers=cliente_auth_headers,
                        json={"pedido_id": pedido_id, "payment_id": 7000},
                    )
        assert resp.status_code == 200
        fake_manager.broadcast_pedido.assert_awaited_once()
        args, _ = fake_manager.broadcast_pedido.call_args
        broadcast_pedido_id, evento = args
        assert broadcast_pedido_id == pedido_id
        assert evento["event"] == "pago_confirmado"
        assert evento["estado_nuevo"] == "CONFIRMADO"
