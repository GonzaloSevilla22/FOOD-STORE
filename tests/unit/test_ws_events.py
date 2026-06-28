"""Tests del builder de eventos WebSocket (consigna §9.4)."""

from datetime import datetime, timezone

from app.modules.pedidos.events import (
    EVENT_ESTADO_CAMBIADO,
    EVENT_PAGO_CONFIRMADO,
    EVENT_PEDIDO_CANCELADO,
    build_pedido_event,
)


class TestBuildPedidoEvent:
    def test_event_has_exactly_the_94_fields(self):
        """El evento §9.4 tiene exactamente los 7 campos definidos."""
        evento = build_pedido_event(
            event=EVENT_ESTADO_CAMBIADO,
            pedido_id=7,
            estado_anterior="CONFIRMADO",
            estado_nuevo="EN_PREP",
            usuario_id=3,
        )
        assert set(evento.keys()) == {
            "event",
            "pedido_id",
            "estado_anterior",
            "estado_nuevo",
            "usuario_id",
            "motivo",
            "timestamp",
        }
        assert evento["event"] == "estado_cambiado"
        assert evento["pedido_id"] == 7
        assert evento["estado_anterior"] == "CONFIRMADO"
        assert evento["estado_nuevo"] == "EN_PREP"
        assert evento["usuario_id"] == 3
        assert evento["motivo"] is None
        assert evento["timestamp"].endswith("Z")

    def test_cancelado_keeps_motivo_and_system_user(self):
        """pedido_cancelado conserva el motivo (RN-05) y usuario_id null si fue el sistema."""
        evento = build_pedido_event(
            event=EVENT_PEDIDO_CANCELADO,
            pedido_id=10,
            estado_anterior="PENDIENTE",
            estado_nuevo="CANCELADO",
            usuario_id=None,
            motivo="Sin stock",
        )
        assert evento["event"] == "pedido_cancelado"
        assert evento["motivo"] == "Sin stock"
        assert evento["usuario_id"] is None

    def test_creation_has_null_estado_anterior(self):
        """En la creación inicial estado_anterior es null."""
        evento = build_pedido_event(
            event=EVENT_PAGO_CONFIRMADO,
            pedido_id=1,
            estado_anterior=None,
            estado_nuevo="CONFIRMADO",
            usuario_id=2,
        )
        assert evento["estado_anterior"] is None
        assert evento["estado_nuevo"] == "CONFIRMADO"

    def test_timestamp_is_iso8601_utc_with_z(self):
        """El timestamp es ISO 8601 UTC con sufijo Z (ej '2025-08-12T14:30:00Z')."""
        fixed = datetime(2025, 8, 12, 14, 30, 0, tzinfo=timezone.utc)
        evento = build_pedido_event(
            event=EVENT_ESTADO_CAMBIADO,
            pedido_id=1,
            estado_anterior="EN_PREP",
            estado_nuevo="ENTREGADO",
            usuario_id=1,
            timestamp=fixed,
        )
        assert evento["timestamp"] == "2025-08-12T14:30:00Z"
