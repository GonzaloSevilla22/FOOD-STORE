import uuid
import asyncio
import logging
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

import httpx
from fastapi import HTTPException, status
from sqlmodel import Session

from app.core.config import settings
from app.core.rbac import STATE_CONFIRMADO, STATE_PENDIENTE, normalize_role, ROLE_ADMIN, ROLE_PEDIDOS
from app.core.sse import sse_manager
from app.modules.pedidos.service import PedidoService
from app.core.websocket import manager
from app.modules.payments.models import Pago
from app.modules.pedidos.models import Pedido
from app.modules.pedidos.events import (
    EVENT_PAGO_CONFIRMADO,
    EVENT_PAGO_RECHAZADO,
    build_pedido_event,
)
from app.modules.payments.schemas import (
    PagoCrearResponse,
    PagoEstadoResponse,
    PagoPublic,
    ManualAprobarRequest,
)
from app.modules.payments.unit_of_work import PagoUnitOfWork
from app.modules.pedidos.pedido_repository import PedidoRepository
from app.modules.usuarios.schemas import CurrentUser

MP_API_BASE = "https://api.mercadopago.com"
logger = logging.getLogger(__name__)


def _schedule_avance_en_prep(pedido_id: int) -> None:
    """Programa avance automático CONFIRMADO → EN_PREP a los 3 s."""
    PedidoService._schedule_avance_en_prep(pedido_id)


class PaymentService:
    def __init__(self, session: Session) -> None:
        self._session = session

    def _get_mp_access_token(self) -> Optional[str]:
        return settings.MP_ACCESS_TOKEN or settings.MERCADOPAGO_ACCESS_TOKEN or None

    def _get_mp_public_key(self) -> Optional[str]:
        return settings.MP_PUBLIC_KEY or settings.MERCADOPAGO_PUBLIC_KEY or None

    def _can_manage_payments(self, roles: list[str]) -> bool:
        normalized = {normalize_role(role) for role in roles}
        return ROLE_ADMIN in normalized or ROLE_PEDIDOS in normalized

    def _check_ownership(self, pedido: Pedido, current_user: CurrentUser) -> None:
        """Verificar que el usuario sea dueño del pedido o tenga rol admin/pedidos."""
        if self._can_manage_payments(current_user.roles):
            return
        if pedido.usuario_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permiso para gestionar este pago",
            )

    async def _broadcast_pago(
        self,
        *,
        event: str,
        pedido_id: int,
        estado_anterior: Optional[str],
        estado_nuevo: Optional[str],
        usuario_id: Optional[int] = None,
        motivo: Optional[str] = None,
    ) -> None:
        """Emite el evento §9.4 del pago al canal del pedido y admin (post-commit, CE-09).

        Defensivo: una falla de WebSocket nunca debe romper el procesamiento del
        pago (el broadcast va fuera de la transacción, igual que en pedidos).
        """
        try:
            evento = build_pedido_event(
                event=event,
                pedido_id=pedido_id,
                estado_anterior=estado_anterior,
                estado_nuevo=estado_nuevo,
                usuario_id=usuario_id,
                motivo=motivo,
            )
            await manager.broadcast_pedido(pedido_id, evento)
            await sse_manager.broadcast(event, evento)
        except Exception:
            logger.exception("Error emitiendo evento WS/SSE de pago (pedido_id=%s)", pedido_id)

    async def _broadcast_stock_changes(self, pedido_id: int) -> None:
        """Broadcast PRODUCTO_UPDATED al canal productos cuando cambia stock por pago."""
        from app.modules.pedidos.detalle_pedido_repository import DetallePedidoRepository
        try:
            detalle_repo = DetallePedidoRepository(self._session)
            detalles = detalle_repo.get_by_pedido_id(pedido_id)
            producto_ids = {d.producto_id for d in detalles}
            for pid in producto_ids:
                await manager.broadcast("PRODUCTO_UPDATED", {"producto_id": pid})
        except Exception:
            logger.exception("Error broadcasting stock changes for pedido %s", pedido_id)

    async def _crear_preferencia_mp(
        self, monto: Decimal, titulo: str, pedido_id: int, back_urls: dict, frontend_url: str = ""
    ) -> dict:
        access_token = self._get_mp_access_token()
        if not access_token:
            raise RuntimeError("MercadoPago no está configurado. Configure MP_ACCESS_TOKEN")

        notification_url = settings.MP_WEBHOOK_URL
        if not notification_url:
            notification_url = f"{settings.VITE_API_URL}/api/v1/pagos/webhook"
            if "localhost" in notification_url or "127.0.0.1" in notification_url:
                logger.warning(
                    "MP_WEBHOOK_URL no está configurada y VITE_API_URL apunta a localhost (%s). "
                    "MercadoPago no podrá enviar notificaciones de pago. "
                    "Configurá MP_WEBHOOK_URL con una URL pública (ej: ngrok).",
                    notification_url,
                )

        preference_data = {
            "items": [{
                "title": titulo,
                "quantity": 1,
                "unit_price": float(monto),
                "currency_id": "ARS",
            }],
            "external_reference": str(pedido_id),
            "back_urls": back_urls,
            "notification_url": notification_url,
        }

        # auto_return solo con URLs públicas (HTTPS requerido por MP)
        if frontend_url and "localhost" not in frontend_url and "127.0.0.1" not in frontend_url:
            preference_data["auto_return"] = "approved"

        logger.info(
            "Creando preferencia MP: pedido_id=%s notification_url=%s auto_return=%s back_urls=%s",
            pedido_id,
            notification_url,
            preference_data.get("auto_return"),
            back_urls,
        )

        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
            "X-Idempotency-Key": str(uuid.uuid4()),
        }

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.post(
                    f"{MP_API_BASE}/checkout/preferences",
                    headers=headers,
                    json=preference_data,
                )
        except httpx.RequestError as e:
            logger.exception("Error de conexión con MP al crear preferencia")
            raise RuntimeError(f"Error de conexión con MercadoPago: {e}")

        if response.status_code not in (200, 201):
            logger.error("Error creando preferencia MP: status=%s body=%s", response.status_code, response.text)
            raise RuntimeError(
                f"Error al crear preferencia: {response.json().get('message', 'desconocido')}"
            )

        result = response.json()
        return {
            "preference_id": result.get("id"),
            "init_point": result.get("init_point") or result.get("sandbox_init_point"),
        }

    async def _consultar_pago_mp(self, payment_id: int) -> dict:
        access_token = self._get_mp_access_token()
        if not access_token:
            raise RuntimeError("MP no configurado")

        headers = {"Authorization": f"Bearer {access_token}"}

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.get(
                    f"{MP_API_BASE}/v1/payments/{payment_id}",
                    headers=headers,
                )
        except httpx.RequestError as e:
            logger.exception("Error consultando pago MP %s", payment_id)
            raise RuntimeError(f"Error de conexión con MP: {e}")

        if response.status_code != 200:
            logger.error("Error consultando pago MP %s: status=%s body=%s", payment_id, response.status_code, response.text)
            raise RuntimeError(f"Error al consultar pago {payment_id}")

        data = response.json()
        logger.debug("Respuesta MP consulta pago %s: %s", payment_id, data)
        return {
            "mp_payment_id": data.get("id"),
            "mp_status": data.get("status"),
            "mp_status_detail": data.get("status_detail"),
            "mp_merchant_order_id": data.get("merchant_order_id"),
            "external_reference": data.get("external_reference"),
        }

    async def _buscar_pago_mp_por_referencia(self, pedido_id: int) -> Optional[int]:
        access_token = self._get_mp_access_token()
        if not access_token:
            return None

        headers = {"Authorization": f"Bearer {access_token}"}
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.get(
                    f"{MP_API_BASE}/v1/payments/search",
                    headers=headers,
                    params={
                        "external_reference": str(pedido_id),
                        "sort": "date_created",
                        "criteria": "desc",
                        "limit": 1,
                    },
                )
        except httpx.RequestError:
            return None

        if response.status_code != 200:
            return None

        results = response.json().get("results", [])
        if results:
            return results[0].get("id")
        return None

    async def crear_pago(self, pedido_id: int, current_user_id: int) -> PagoCrearResponse:
        pedido = PedidoRepository(self._session).get_by_id(pedido_id)
        if not pedido:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Pedido no encontrado",
            )

        if pedido.usuario_id != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No puedes pagar un pedido que no te pertenece",
            )

        if not self._get_mp_access_token():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="MercadoPago no configurado. Configure MP_ACCESS_TOKEN",
            )

        base_redirect = settings.NGROK_URL or settings.VITE_FRONTEND_URL or "http://localhost:5500"
        back_urls = {
            "success": f"{base_redirect}/api/v1/pagos/orders/{pedido_id}/success",
            "failure": f"{base_redirect}/api/v1/pagos/orders/{pedido_id}/failure",
            "pending": f"{base_redirect}/api/v1/pagos/orders/{pedido_id}/pending",
        }
        frontend_url = base_redirect

        try:
            mp_data = await self._crear_preferencia_mp(
                monto=pedido.total,
                titulo=f"Pedido #{pedido_id} - FoodStore",
                pedido_id=pedido_id,
                back_urls=back_urls,
                frontend_url=frontend_url,
            )
        except RuntimeError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e),
            )

        with PagoUnitOfWork(self._session) as uow:
            pago = Pago(
                pedido_id=pedido_id,
                monto=pedido.total,
                estado="pendiente",
                mp_preference_id=mp_data["preference_id"],
                mp_init_point=mp_data.get("init_point"),
                idempotency_key=str(uuid.uuid4()),
            )
            uow.pagos.add(pago)

            pedido.forma_pago_codigo = "MERCADOPAGO"
            uow.pedidos.add(pedido)

            return PagoCrearResponse(
                pago_id=pago.id,
                preference_id=mp_data["preference_id"],
                init_point=mp_data.get("init_point"),
                public_key=self._get_mp_public_key(),
            )

    def obtener_pago_por_pedido(self, pedido_id: int) -> PagoPublic:
        with PagoUnitOfWork(self._session) as uow:
            pago = uow.pagos.get_ultimo_by_pedido(pedido_id)
            if not pago:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Pago no encontrado para este pedido",
                )
            return PagoPublic(
                id=pago.id,
                pedido_id=pago.pedido_id,
                monto=pago.monto,
                estado=pago.estado,
                mp_preference_id=pago.mp_preference_id,
                mp_init_point=pago.mp_init_point,
                mp_payment_id=pago.mp_payment_id,
                mp_merchant_order_id=pago.mp_merchant_order_id,
                mp_status=pago.mp_status,
                mp_status_detail=pago.mp_status_detail,
                created_at=pago.created_at.isoformat() if pago.created_at else None,
            )

    async def procesar_webhook(
        self, data: dict, query_params: Optional[dict] = None
    ) -> dict:
        logger.info("Webhook recibido: data=%s qs=%s", data, query_params or {})

        if not data and query_params:
            data = query_params

        topic = data.get("type") or data.get("topic")
        data_id = data.get("data_id") or (data.get("data") or {}).get("id")
        payment_id = data.get("id")

        if not data_id and query_params:
            data_id = query_params.get("data.id") or query_params.get("id")
        if not topic and query_params:
            topic = query_params.get("topic") or query_params.get("type")

        pago_mp_id = payment_id or data_id

        if not pago_mp_id:
            logger.warning("Webhook ignorado: no se recibió payment_id")
            return {"status": "ignored", "reason": "No payment ID"}

        if topic not in (None, "payment", "merchant_order"):
            logger.info("Webhook ignorado por topic=%s", topic)
            return {"status": "ignored", "reason": f"Topic: {topic}"}

        logger.info("Webhook payment_id recibido: %s", pago_mp_id)

        try:
            mp_info = await self._consultar_pago_mp(int(pago_mp_id))
            estado_mp = mp_info.get("mp_status")
            external_reference = mp_info.get("external_reference")

            logger.info(
                "Webhook consulta MP: payment_id=%s external_reference=%s status=%s",
                pago_mp_id, external_reference, estado_mp,
            )

            if estado_mp == "approved":
                nuevo_estado = "aprobado"
            elif estado_mp in ("rejected", "cancelled", "refunded", "charged_back"):
                nuevo_estado = "rechazado"
            elif estado_mp in ("pending", "in_process", "authorized"):
                nuevo_estado = "pendiente"
            else:
                return {"status": "ignored", "reason": f"Unknown status: {estado_mp}"}

            # Buscar pago local usando external_reference (pedido_id)
            # porque mp_payment_id aún es NULL al crearse la preferencia
            pedido_id = int(external_reference) if external_reference else None
            logger.info("Webhook pedido_id desde external_reference: %s", pedido_id)

            # Datos para la notificación WS post-commit (CE-09).
            broadcast_event: Optional[str] = None
            broadcast_estado_anterior: Optional[str] = None
            broadcast_estado_nuevo: Optional[str] = None
            broadcast_pedido_id: Optional[int] = None

            with PagoUnitOfWork(self._session) as uow:
                if pedido_id:
                    pago = uow.pagos.get_ultimo_by_pedido(pedido_id)
                else:
                    pago = None

                if not pago:
                    logger.warning(
                        "Webhook: pago local no encontrado para pedido_id=%s", pedido_id
                    )
                    return {"status": "ignored", "reason": "Pago not found in local DB"}

                if pago.estado == "aprobado":
                    logger.info("Webhook: pago %s ya procesado previamente", pago.id)
                    return {"status": "already_processed", "estado": pago.estado, "pago_id": pago.id, "pedido_id": pago.pedido_id}

                # Actualizar campos MP
                pago.mp_payment_id = int(pago_mp_id)
                pago.mp_status = estado_mp
                pago.mp_status_detail = mp_info.get("mp_status_detail")
                pago.mp_merchant_order_id = mp_info.get("mp_merchant_order_id")
                pago.estado = nuevo_estado
                pago.updated_at = datetime.now(timezone.utc)
                uow.pagos.add(pago)

                broadcast_pedido_id = pago.pedido_id
                pedido = uow.pedidos.get_by_id(pago.pedido_id)

                if nuevo_estado == "aprobado":
                    if pedido and pedido.estado_codigo == STATE_PENDIENTE:
                        broadcast_estado_anterior = pedido.estado_codigo
                        pedido.estado_codigo = STATE_CONFIRMADO
                        pedido.forma_pago_codigo = "MERCADOPAGO"
                        pedido.updated_at = datetime.now(timezone.utc)
                        uow.pedidos.add(pedido)
                        logger.info(
                            "Webhook: pedido %s actualizado a PAGADO",
                            pedido.id,
                        )
                        broadcast_event = EVENT_PAGO_CONFIRMADO
                        broadcast_estado_nuevo = STATE_CONFIRMADO
                elif nuevo_estado == "rechazado":
                    estado_actual = pedido.estado_codigo if pedido else None
                    broadcast_event = EVENT_PAGO_RECHAZADO
                    broadcast_estado_anterior = estado_actual
                    broadcast_estado_nuevo = estado_actual

            # Notificación WS post-commit (fuera de la transacción, CE-09).
            if broadcast_event and broadcast_pedido_id is not None:
                await self._broadcast_pago(
                    event=broadcast_event,
                    pedido_id=broadcast_pedido_id,
                    estado_anterior=broadcast_estado_anterior,
                    estado_nuevo=broadcast_estado_nuevo,
                    usuario_id=None,  # el webhook lo dispara "el sistema" (§9.4)
                    motivo=mp_info.get("mp_status_detail"),
                )

            if nuevo_estado == "aprobado" and broadcast_pedido_id:
                await self._broadcast_stock_changes(broadcast_pedido_id)
                _schedule_avance_en_prep(broadcast_pedido_id)

            logger.info(
                "Webhook procesado: pago_id=%s pedido_id=%s estado=%s",
                pago.id, pago.pedido_id, nuevo_estado,
            )
            return {
                "status": "processed",
                "pago_id": pago.id,
                "estado": nuevo_estado,
                "pedido_id": pago.pedido_id,
            }

        except Exception as e:
            logger.exception("Error procesando webhook MP")
            return {"status": "error", "reason": str(e)}

    async def confirmar_pago(
        self, pedido_id: int, payment_id: Optional[int] = None, current_user: Optional[CurrentUser] = None
    ) -> PagoEstadoResponse:
        pedido = PedidoRepository(self._session).get_by_id(pedido_id)
        if not pedido:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Pedido no encontrado",
            )

        if current_user:
            self._check_ownership(pedido, current_user)

        resolved_payment_id = payment_id
        if not resolved_payment_id:
            with PagoUnitOfWork(self._session) as uow:
                pago_local = uow.pagos.get_ultimo_by_pedido(pedido_id)
                if pago_local and pago_local.mp_payment_id:
                    resolved_payment_id = pago_local.mp_payment_id

        if not resolved_payment_id:
            resolved_payment_id = await self._buscar_pago_mp_por_referencia(pedido_id)

        if resolved_payment_id:
            try:
                mp_info = await self._consultar_pago_mp(resolved_payment_id)
            except RuntimeError as e:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=str(e),
                )

            estado_mp = mp_info.get("mp_status")
            if estado_mp == "approved":
                nuevo_estado = "aprobado"
            elif estado_mp in ("rejected", "cancelled", "refunded", "charged_back"):
                nuevo_estado = "rechazado"
            else:
                nuevo_estado = "pendiente"

            broadcast_event: Optional[str] = None
            broadcast_estado_anterior: Optional[str] = None
            broadcast_estado_nuevo: Optional[str] = None

            with PagoUnitOfWork(self._session) as uow:
                pago = uow.pagos.get_by_mp_payment_id(resolved_payment_id)
                if not pago:
                    pago = uow.pagos.get_ultimo_by_pedido(pedido_id)

                if pago:
                    pago.mp_payment_id = resolved_payment_id
                    pago.mp_status = estado_mp
                    pago.mp_status_detail = mp_info.get("mp_status_detail")
                    pago.mp_merchant_order_id = mp_info.get("mp_merchant_order_id")
                    pago.estado = nuevo_estado
                    pago.updated_at = datetime.now(timezone.utc)
                    uow.pagos.add(pago)

                    if nuevo_estado == "aprobado" and pedido.estado_codigo == "PENDIENTE":
                        broadcast_estado_anterior = pedido.estado_codigo
                        pedido.estado_codigo = STATE_CONFIRMADO
                        pedido.forma_pago_codigo = "MERCADOPAGO"
                        pedido.updated_at = datetime.now(timezone.utc)
                        uow.pedidos.add(pedido)
                        broadcast_event = EVENT_PAGO_CONFIRMADO
                        broadcast_estado_nuevo = STATE_CONFIRMADO
                    elif nuevo_estado == "rechazado":
                        broadcast_event = EVENT_PAGO_RECHAZADO
                        broadcast_estado_anterior = pedido.estado_codigo
                        broadcast_estado_nuevo = pedido.estado_codigo

            # Notificación WS post-commit (CE-09).
            if broadcast_event:
                await self._broadcast_pago(
                    event=broadcast_event,
                    pedido_id=pedido_id,
                    estado_anterior=broadcast_estado_anterior,
                    estado_nuevo=broadcast_estado_nuevo,
                    usuario_id=current_user.id if current_user else None,
                    motivo=mp_info.get("mp_status_detail"),
                )

            if nuevo_estado == "aprobado":
                await self._broadcast_stock_changes(pedido_id)
                _schedule_avance_en_prep(pedido_id)

            return PagoEstadoResponse(estado=nuevo_estado, pedido_id=pedido_id)

        with PagoUnitOfWork(self._session) as uow:
            pago_local = uow.pagos.get_ultimo_by_pedido(pedido_id)
            return PagoEstadoResponse(
                estado=pago_local.estado if pago_local else None,
                pedido_id=pedido_id,
            )

    async def aprobar_manual(self, data: ManualAprobarRequest) -> PagoEstadoResponse:
        pedido = PedidoRepository(self._session).get_by_id(data.pedido_id)
        if not pedido:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Pedido no encontrado",
            )

        broadcast_event: Optional[str] = None
        broadcast_estado_anterior: Optional[str] = None
        broadcast_estado_nuevo: Optional[str] = None

        with PagoUnitOfWork(self._session) as uow:
            pago = uow.pagos.get_ultimo_by_pedido(data.pedido_id)

            if data.mp_payment_id:
                try:
                    mp_info = await self._consultar_pago_mp(data.mp_payment_id)
                    estado_mp = mp_info.get("mp_status")
                    if estado_mp == "approved":
                        nuevo_estado = "aprobado"
                    elif estado_mp in ("rejected", "cancelled", "refunded", "charged_back"):
                        nuevo_estado = "rechazado"
                    else:
                        nuevo_estado = "pendiente"
                except RuntimeError:
                    nuevo_estado = "aprobado"
                    mp_info = {}
            else:
                nuevo_estado = "aprobado"
                mp_info = {}

            if pago:
                pago.estado = nuevo_estado
                pago.mp_status = mp_info.get("mp_status") if data.mp_payment_id else "manual"
                pago.mp_status_detail = mp_info.get("mp_status_detail") if data.mp_payment_id else "Aprobado manualmente"
                if data.mp_payment_id:
                    pago.mp_payment_id = data.mp_payment_id
                pago.updated_at = datetime.now(timezone.utc)
                uow.pagos.add(pago)
            else:
                pago = Pago(
                    pedido_id=data.pedido_id,
                    monto=pedido.total,
                    estado=nuevo_estado,
                    mp_payment_id=data.mp_payment_id,
                    mp_status=mp_info.get("mp_status") if data.mp_payment_id else "manual",
                    mp_status_detail=mp_info.get("mp_status_detail") if data.mp_payment_id else "Aprobado manualmente",
                    idempotency_key=str(uuid.uuid4()),
                )
                uow.pagos.add(pago)

            if nuevo_estado == "aprobado":
                broadcast_estado_anterior = pedido.estado_codigo
                pedido.estado_codigo = STATE_CONFIRMADO
                pedido.updated_at = datetime.now(timezone.utc)
                uow.pedidos.add(pedido)
                broadcast_event = EVENT_PAGO_CONFIRMADO
                broadcast_estado_nuevo = STATE_CONFIRMADO
            elif nuevo_estado == "rechazado":
                broadcast_event = EVENT_PAGO_RECHAZADO
                broadcast_estado_anterior = pedido.estado_codigo
                broadcast_estado_nuevo = pedido.estado_codigo

        # Notificación WS post-commit (CE-09).
        if broadcast_event:
            await self._broadcast_pago(
                event=broadcast_event,
                pedido_id=data.pedido_id,
                estado_anterior=broadcast_estado_anterior,
                estado_nuevo=broadcast_estado_nuevo,
                usuario_id=None,
                motivo=(mp_info.get("mp_status_detail") if data.mp_payment_id else "Aprobado manualmente"),
            )

        if nuevo_estado == "aprobado":
            await self._broadcast_stock_changes(data.pedido_id)
            _schedule_avance_en_prep(data.pedido_id)

        return PagoEstadoResponse(estado=nuevo_estado, pedido_id=data.pedido_id)
