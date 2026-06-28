"""Tests del ConnectionManager con pool por canales (consigna §9.3)."""

import asyncio

from app.core.websocket import (
    ADMIN_CHANNEL,
    PRODUCTOS_CHANNEL,
    ConnectionManager,
    pedido_channel,
    role_channel,
)


class FakeWS:
    """Doble de WebSocket: registra accept/send_json/close sin red real."""

    def __init__(self, fail_on_send: bool = False) -> None:
        self.accepted = False
        self.sent: list[dict] = []
        self.closed: tuple[int, str] | None = None
        self._fail_on_send = fail_on_send

    async def accept(self) -> None:
        self.accepted = True

    async def send_json(self, data: dict) -> None:
        if self._fail_on_send:
            raise RuntimeError("conexión caída")
        self.sent.append(data)

    async def close(self, code: int = 1000, reason: str = "") -> None:
        self.closed = (code, reason)


def run(coro):
    return asyncio.run(coro)


class TestConnectionManagerChannels:
    def test_broadcast_pedido_reaches_owner_channel_and_admin(self):
        """broadcast_pedido llega al canal del pedido y al canal admin, no a otros."""
        mgr = ConnectionManager()
        ws_owner = FakeWS()
        ws_admin = FakeWS()
        ws_other = FakeWS()
        run(mgr.connect(ws_owner, pedido_channel(5)))
        run(mgr.connect(ws_admin, ADMIN_CHANNEL))
        run(mgr.connect(ws_other, pedido_channel(99)))

        evento = {"event": "estado_cambiado", "pedido_id": 5}
        run(mgr.broadcast_pedido(5, evento))

        assert ws_owner.sent == [evento]
        assert ws_admin.sent == [evento]
        assert ws_other.sent == []

    def test_broadcast_pedido_does_not_duplicate_when_ws_in_both(self):
        """Una conexión en el canal del pedido Y en admin recibe el evento una sola vez."""
        mgr = ConnectionManager()
        ws = FakeWS()
        run(mgr.connect(ws, pedido_channel(5)))
        run(mgr.connect(ws, ADMIN_CHANNEL))

        run(mgr.broadcast_pedido(5, {"event": "estado_cambiado", "pedido_id": 5}))

        assert len(ws.sent) == 1

    def test_broadcast_to_role_only_targets_that_room(self):
        """broadcast_to_role solo llega a la room del rol indicado."""
        mgr = ConnectionManager()
        ws_admin = FakeWS()
        ws_client = FakeWS()
        run(mgr.connect(ws_admin, role_channel("ADMIN")))
        run(mgr.connect(ws_client, role_channel("CLIENT")))

        run(mgr.broadcast_to_role("admin", {"event": "estado_cambiado"}))

        assert len(ws_admin.sent) == 1
        assert ws_client.sent == []

    def test_disconnect_removes_from_pool(self):
        """Tras disconnect la conexión deja de recibir broadcasts."""
        mgr = ConnectionManager()
        ws = FakeWS()
        run(mgr.connect(ws, pedido_channel(5)))
        mgr.disconnect(ws, pedido_channel(5))

        run(mgr.broadcast_pedido(5, {"event": "estado_cambiado"}))

        assert ws.sent == []

    def test_legacy_broadcast_goes_to_productos_channel(self):
        """El broadcast legacy (productos/ingredientes) usa el canal productos con {event,data}."""
        mgr = ConnectionManager()
        ws_prod = FakeWS()
        ws_admin = FakeWS()
        run(mgr.connect(ws_prod, PRODUCTOS_CHANNEL))
        run(mgr.connect(ws_admin, ADMIN_CHANNEL))

        run(mgr.broadcast("PRODUCTO_ACTUALIZADO", {"id": 1}))

        assert ws_prod.sent == [{"event": "PRODUCTO_ACTUALIZADO", "data": {"id": 1}}]
        assert ws_admin.sent == []

    def test_broadcast_discards_dead_connection(self):
        """Una conexión que falla al enviar se descarta y no rompe el resto."""
        mgr = ConnectionManager()
        ws_dead = FakeWS(fail_on_send=True)
        ws_ok = FakeWS()
        run(mgr.connect(ws_dead, ADMIN_CHANNEL))
        run(mgr.connect(ws_ok, ADMIN_CHANNEL))

        run(mgr.broadcast_pedido(1, {"event": "estado_cambiado"}))
        # la conexión caída quedó descartada: un segundo broadcast no la reintenta
        run(mgr.broadcast_pedido(1, {"event": "estado_cambiado"}))

        assert len(ws_ok.sent) == 2
