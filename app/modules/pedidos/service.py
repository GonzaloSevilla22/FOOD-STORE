import logging
from decimal import Decimal
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException, status
from sqlmodel import Session

logger = logging.getLogger(__name__)

from app.core.rbac import (
    ROLE_ADMIN,
    ROLE_CLIENT,
    ROLE_PEDIDOS,
    STATE_CANCELADO,
    STATE_CONFIRMADO,
    STATE_EN_PREP,
    STATE_A_ENTREGAR,
    STATE_ESPERANDO_CLIENTE,
    STATE_ENTREGADO,
    STATE_PENDIENTE,
    is_terminal,
    normalize_role,
    normalize_state,
)

from app.core.sse import sse_manager
from app.core.websocket import manager
from app.modules.pedidos.events import (
    EVENT_ESTADO_CAMBIADO,
    EVENT_PAGO_CONFIRMADO,
    EVENT_PEDIDO_CANCELADO,
    EVENT_PEDIDO_CREADO,
    build_pedido_event,
)
from app.modules.pedidos.models import (
    Pedido,
    DetallePedido,
    HistorialEstadoPedido,
    EstadoPedido,
)
from app.modules.pedidos.pedido_repository import PedidoRepository
from app.modules.pedidos.detalle_pedido_repository import DetallePedidoRepository
from app.modules.pedidos.estado_pedido_repository import EstadoPedidoRepository
from app.modules.pedidos.historial_estado_pedido_repository import HistorialEstadoPedidoRepository
from app.modules.pedidos.unit_of_work import PedidoUnitOfWork
from app.modules.pedidos.schemas import (
    PedidoCreate,
    PedidoPublic,
    PedidoDetail,
    PedidoList,
    DetallePedidoPublic,
    EstadoPedidoPublic,
    HistorialEstadoPedidoPublic,
    HistorialEstadoPedidoList,
    ConfirmarPedidoResponse,
    CambiarEstadoPedidoRequest,
)
from app.modules.payments.repository import PagoRepository


class PedidoService:
    """
    Servicio de negocio para Pedido.
    Usa PedidoUnitOfWork para transacciones atómicas.
    Implementa reglas de negocio, transiciones de estado, y validaciones.
    """

    TRANSICIONES_VALIDAS = {
        STATE_PENDIENTE: [STATE_CONFIRMADO, STATE_CANCELADO, STATE_ENTREGADO],
        STATE_CONFIRMADO: [STATE_EN_PREP, STATE_CANCELADO, STATE_ENTREGADO],
        STATE_EN_PREP: [STATE_A_ENTREGAR, STATE_CANCELADO],
        STATE_A_ENTREGAR: [STATE_ESPERANDO_CLIENTE, STATE_CANCELADO],
        STATE_ESPERANDO_CLIENTE: [STATE_ENTREGADO],
        STATE_ENTREGADO: [],
        STATE_CANCELADO: [],
    }

    TRANSICIONES_STOCK = {
        (STATE_CONFIRMADO, STATE_CANCELADO): "restore",
        (STATE_EN_PREP, STATE_CANCELADO): "restore",
        (STATE_A_ENTREGAR, STATE_CANCELADO): "restore",
        (STATE_PENDIENTE, STATE_ENTREGADO): "discount",
    }

    @staticmethod
    def _aplicar_stock_static(session: Session, producto_id: int, cantidad: int, multiplicador: int = 1) -> list[dict]:
        from app.modules.productos.repository import ProductoRepository
        producto_repo = ProductoRepository(session)
        producto = producto_repo.get_by_id(producto_id)
        low_stock: list[dict] = []
        if not producto:
            return low_stock
        if producto.usa_stock_manual:
            delta = multiplicador * cantidad
            if multiplicador == 1 and producto.stock_manual is not None and producto.stock_manual - delta < 0:
                raise ValueError(f"Stock insuficiente de {producto.nombre} ¡fijate si te gusta otra cosa en el menú!")
            if producto.stock_manual is not None:
                producto.stock_manual -= delta
            if multiplicador == 1:
                producto.disponible = producto.stock_manual is not None and producto.stock_manual > 0
            elif multiplicador == -1:
                producto.disponible = True
            session.add(producto)
        else:
            ingredientes = list(producto.productos_ingredientes)
            if ingredientes:
                for pi in ingredientes:
                    ing = pi.ingrediente
                    if ing:
                        delta = float(pi.cantidad) * cantidad * multiplicador
                        if multiplicador == 1 and ing.stock_actual - delta < 0:
                            raise ValueError(
                                f"Stock insuficiente de {producto.nombre} ¡fijate si te gusta otra cosa en el menú!"
                            )
                        ing.stock_actual -= delta
                        session.add(ing)
                        if multiplicador == 1 and ing.stock_actual < ing.stock_minimo:
                            low_stock.append({
                                "ingrediente_id": ing.id,
                                "nombre": ing.nombre,
                                "stock_actual": ing.stock_actual,
                                "stock_minimo": ing.stock_minimo,
                            })
                if multiplicador == 1:
                    candidatos = [
                        int(float(pi.ingrediente.stock_actual) // float(pi.cantidad))
                        for pi in ingredientes
                        if pi.ingrediente and pi.cantidad > 0
                    ]
                    producto.disponible = candidatos and min(candidatos) > 0
                    session.add(producto)
                elif multiplicador == -1:
                    producto.disponible = True
                    session.add(producto)
        return low_stock

    def _aplicar_stock(
        self, uow: PedidoUnitOfWork, producto_id: int, cantidad: int, multiplicador: int = 1
    ) -> list[dict]:
        try:
            return PedidoService._aplicar_stock_static(uow._session, producto_id, cantidad, multiplicador)
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    @staticmethod
    def _stock_disponible(producto) -> int | None:
        """Unidades vendibles del producto: stock_manual, o el mínimo que habilitan
        los ingredientes (floor(stock_ingrediente / cantidad_receta)).

        Devuelve None cuando el producto no tiene límite de stock conocido (sin
        stock_manual ni ingredientes). Réplica de la métrica de productos/service.py.
        """
        if producto.usa_stock_manual:
            return producto.stock_manual
        relaciones = list(producto.productos_ingredientes)
        if relaciones:
            candidatos: list[int] = []
            for rel in relaciones:
                ingrediente = rel.ingrediente
                if ingrediente is None:
                    continue
                if rel.cantidad and float(rel.cantidad) > 0:
                    candidatos.append(int(float(ingrediente.stock_actual) // float(rel.cantidad)))
            if candidatos:
                return min(candidatos)
            return None
        if producto.stock_manual is not None:
            return producto.stock_manual
        return None

    def __init__(self, session: Session) -> None:
        self._session = session
        self._pedido_repo = PedidoRepository(session)
        self._detalle_repo = DetallePedidoRepository(session)
        self._estado_repo = EstadoPedidoRepository(session)
        self._historial_repo = HistorialEstadoPedidoRepository(session)

    def _can_manage_all(self, roles: list[str]) -> bool:
        normalized = {normalize_role(role) for role in roles}
        return ROLE_ADMIN in normalized or ROLE_PEDIDOS in normalized

    def _is_admin(self, roles: list[str]) -> bool:
        normalized = {normalize_role(role) for role in roles}
        return ROLE_ADMIN in normalized

    async def _broadcast_pedido(
        self,
        *,
        event: str,
        pedido_id: int,
        estado_anterior: str | None,
        estado_nuevo: str,
        usuario_id: int | None,
        motivo: str | None = None,
    ) -> None:
        """Emite el evento §9.4 al canal del pedido y al canal admin (post-commit)."""
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

    async def _broadcast_stock_changes(self, producto_ids: set[int]) -> None:
        """Broadcast PRODUCTO_UPDATED al canal productos cuando cambia stock."""
        for pid in producto_ids:
            await manager.broadcast("PRODUCTO_UPDATED", {"producto_id": pid})

    # ========================================================================
    # CREAR PEDIDO
    # ========================================================================

    async def crear_pedido(self, usuario_id: int, data: PedidoCreate) -> ConfirmarPedidoResponse:
        with PedidoUnitOfWork(self._session) as uow:
            usuario = uow.usuarios.get_by_id(usuario_id)
            if not usuario or not usuario.activo or usuario.deleted_at is not None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Usuario no encontrado",
                )

            direccion = uow.direcciones.get_by_id_and_usuario(data.direccion_entrega_id, usuario_id)
            if not direccion:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Dirección de entrega no encontrada",
                )

            detalles_list = []
            subtotal = Decimal("0")

            for detalle_data in data.detalles:
                producto = uow.productos.get_active_by_id(detalle_data.producto_id)
                if not producto:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail=f"Producto {detalle_data.producto_id} no encontrado",
                    )

                if not producto.disponible:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Producto {producto.nombre} no disponible",
                    )

                # Pre-validación de stock (no descuenta — eso ocurre al confirmar).
                # Rechaza el pedido si el producto no puede cubrir la cantidad pedida.
                disponible_stock = self._stock_disponible(producto)
                if disponible_stock is not None and disponible_stock < detalle_data.cantidad:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Stock insuficiente de {producto.nombre} ¡fijate si te gusta otra cosa en el menú!",
                    )

                subtotal_detalle = producto.precio_base * Decimal(detalle_data.cantidad)
                detalles_list.append({
                    "producto_id": producto.id,
                    "cantidad": detalle_data.cantidad,
                    "nombre_snapshot": producto.nombre,
                    "precio_snapshot": producto.precio_base,
                    "subtotal_snapshot": subtotal_detalle,
                })
                subtotal += subtotal_detalle

            costo_envio = Decimal("50")  # consigna §3.3: costo de envío fijo
            total = subtotal - data.descuento + costo_envio

            estado_pendiente = uow.estados.get_by_codigo(STATE_PENDIENTE)
            if not estado_pendiente:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Estado {STATE_PENDIENTE} no configurado",
                )

            pedido = Pedido(
                usuario_id=usuario_id,
                direccion_entrega_id=data.direccion_entrega_id,
                forma_pago_codigo=data.forma_pago_codigo,
                estado_codigo=STATE_PENDIENTE,
                subtotal=subtotal,
                descuento=data.descuento,
                costo_envio=costo_envio,
                total=total,
                notas=data.notas,
            )

            pedido = uow.pedidos.add(pedido)

            for detalle_data in detalles_list:
                detalle = DetallePedido(
                    pedido_id=pedido.id,
                    producto_id=detalle_data["producto_id"],
                    cantidad=detalle_data["cantidad"],
                    nombre_snapshot=detalle_data["nombre_snapshot"],
                    precio_snapshot=detalle_data["precio_snapshot"],
                    subtotal_snapshot=detalle_data["subtotal_snapshot"],
                )
                uow.detalles.add(detalle)

            # RN-02: primera transición del historial con estado_desde = NULL.
            historial_inicial = HistorialEstadoPedido(
                pedido_id=pedido.id,
                estado_desde_codigo=None,
                estado_hacia_codigo=STATE_PENDIENTE,
                usuario_id=usuario_id,
                motivo="Pedido creado",
                fecha=datetime.now(timezone.utc),
            )
            uow.historial.add(historial_inicial)

            detalles = uow.detalles.get_by_pedido_id(pedido.id)
            response = ConfirmarPedidoResponse(
                id=pedido.id,
                estado_codigo=pedido.estado_codigo,
                total=pedido.total,
                detalles=[self._detalle_to_public(d) for d in detalles],
                mensaje="Pedido creado. Pendiente de pago.",
            )

        await self._broadcast_pedido(
            event=EVENT_PEDIDO_CREADO,
            pedido_id=pedido.id,
            estado_anterior=None,
            estado_nuevo=STATE_PENDIENTE,
            usuario_id=usuario_id,
        )
        return response

    # ========================================================================
    # ACTUALIZAR ITEMS DE PEDIDO PENDIENTE
    # ========================================================================

    async def actualizar_items_pedido(self, usuario_id: int, pedido_id: int, data: PedidoCreate) -> PedidoDetail:
        with PedidoUnitOfWork(self._session) as uow:
            pedido = self._get_pedido_seguro(uow, usuario_id, pedido_id)

            if pedido.estado_codigo != STATE_PENDIENTE:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Pedido en estado {pedido.estado_codigo}, no puede modificarse",
                )

            direccion = uow.direcciones.get_by_id_and_usuario(data.direccion_entrega_id, usuario_id)
            if not direccion:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Dirección de entrega no encontrada",
                )

            detalles_list = []
            subtotal = Decimal("0")

            for detalle_data in data.detalles:
                producto = uow.productos.get_active_by_id(detalle_data.producto_id)
                if not producto:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail=f"Producto {detalle_data.producto_id} no encontrado",
                    )

                if not producto.disponible:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Producto {producto.nombre} no disponible",
                    )

                # Pre-validación de stock (no descuenta — eso ocurre al confirmar).
                # Rechaza el pedido si el producto no puede cubrir la cantidad pedida.
                disponible_stock = self._stock_disponible(producto)
                if disponible_stock is not None and disponible_stock < detalle_data.cantidad:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Stock insuficiente de {producto.nombre} ¡fijate si te gusta otra cosa en el menú!",
                    )

                subtotal_detalle = producto.precio_base * Decimal(detalle_data.cantidad)
                detalles_list.append({
                    "producto_id": producto.id,
                    "cantidad": detalle_data.cantidad,
                    "nombre_snapshot": producto.nombre,
                    "precio_snapshot": producto.precio_base,
                    "subtotal_snapshot": subtotal_detalle,
                })
                subtotal += subtotal_detalle

            costo_envio = pedido.costo_envio or Decimal("0")
            total = subtotal - data.descuento + costo_envio

            uow.detalles.delete_by_pedido_id(pedido.id)

            for detalle_data in detalles_list:
                detalle = DetallePedido(
                    pedido_id=pedido.id,
                    producto_id=detalle_data["producto_id"],
                    cantidad=detalle_data["cantidad"],
                    nombre_snapshot=detalle_data["nombre_snapshot"],
                    precio_snapshot=detalle_data["precio_snapshot"],
                    subtotal_snapshot=detalle_data["subtotal_snapshot"],
                )
                uow.detalles.add(detalle)

            pedido.direccion_entrega_id = data.direccion_entrega_id
            if data.forma_pago_codigo:
                pedido.forma_pago_codigo = data.forma_pago_codigo
            pedido.subtotal = subtotal
            pedido.descuento = data.descuento
            pedido.total = total
            pedido.notas = data.notas
            uow.pedidos.add(pedido)

            historial = HistorialEstadoPedido(
                pedido_id=pedido.id,
                estado_desde_codigo=STATE_PENDIENTE,
                estado_hacia_codigo=STATE_PENDIENTE,
                usuario_id=usuario_id,
                motivo="Items actualizados",
                fecha=datetime.now(timezone.utc),
            )
            uow.historial.add(historial)

            result = self._to_detail(pedido)

        await self._broadcast_pedido(
            event=EVENT_ESTADO_CAMBIADO,
            pedido_id=pedido.id,
            estado_anterior=STATE_PENDIENTE,
            estado_nuevo=STATE_PENDIENTE,
            usuario_id=usuario_id,
        )
        return result

    # ========================================================================
    # CONFIRMAR PEDIDO (PENDIENTE → PAGADO)
    # ========================================================================

    async def confirmar_pedido(self, usuario_id: int, pedido_id: int, forma_pago_codigo: str | None = None) -> ConfirmarPedidoResponse:
        with PedidoUnitOfWork(self._session) as uow:
            pedido = self._get_pedido_seguro(uow, usuario_id, pedido_id)

            if forma_pago_codigo:
                pedido.forma_pago_codigo = forma_pago_codigo

            if pedido.estado_codigo != STATE_PENDIENTE:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Pedido en estado {pedido.estado_codigo}, no puede confirmarse",
                )

            if STATE_CONFIRMADO not in self.TRANSICIONES_VALIDAS.get(pedido.estado_codigo, []):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Transición de estado no permitida",
                )

            detalles = uow.detalles.get_by_pedido_id(pedido_id)
            producto_ids_afectados: set[int] = set()
            low_stock_alerts: list[dict] = []
            for detalle in detalles:
                # Descuento real de stock (ingredientes o stock_manual) DENTRO de la
                # transacción UoW. Si algún ítem no alcanza, _aplicar_stock lanza 400
                # y el UoW hace rollback → la confirmación es atómica.
                low_stock_alerts.extend(
                    self._aplicar_stock(uow, detalle.producto_id, detalle.cantidad, multiplicador=1)
                )
                producto_ids_afectados.add(detalle.producto_id)

            pedido_anterior_codigo = pedido.estado_codigo
            pedido.estado_codigo = STATE_CONFIRMADO
            pedido = uow.pedidos.add(pedido)

            historial = HistorialEstadoPedido(
                pedido_id=pedido_id,
                estado_desde_codigo=pedido_anterior_codigo,
                estado_hacia_codigo=STATE_CONFIRMADO,
                usuario_id=usuario_id,
                motivo="Pedido confirmado",
                fecha=datetime.now(timezone.utc),
            )
            uow.historial.add(historial)

            response = ConfirmarPedidoResponse(
                id=pedido.id,
                estado_codigo=pedido.estado_codigo,
                total=pedido.total,
                detalles=[self._detalle_to_public(d) for d in detalles],
                mensaje="Pedido confirmado exitosamente. Stock descontado.",
            )

        await self._broadcast_pedido(
            event=EVENT_PAGO_CONFIRMADO,
            pedido_id=pedido_id,
            estado_anterior=pedido_anterior_codigo,
            estado_nuevo=response.estado_codigo,
            usuario_id=usuario_id,
        )
        await self._broadcast_stock_changes(producto_ids_afectados)
        for alert in low_stock_alerts:
            await manager.broadcast("LOW_STOCK", alert)
        PedidoService._schedule_avance_en_prep(pedido_id)
        return response

    # ========================================================================
    # CAMBIAR DIRECCIÓN DE ENTREGA
    # ========================================================================

    def cambiar_direccion(
        self, usuario_id: int, pedido_id: int, nueva_direccion_id: int
    ) -> PedidoDetail:
        with PedidoUnitOfWork(self._session) as uow:
            pedido = uow.pedidos.get_by_id(pedido_id)
            if not pedido or pedido.usuario_id != usuario_id:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Pedido no encontrado",
                )
            if pedido.estado_codigo != STATE_PENDIENTE:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="No se puede cambiar la dirección de un pedido que no está pendiente",
                )

            direccion = uow.direcciones.get_by_id_and_usuario(nueva_direccion_id, usuario_id)
            if not direccion:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Dirección de entrega no encontrada",
                )

            pedido.direccion_entrega_id = nueva_direccion_id
            pedido.updated_at = datetime.now(timezone.utc)
            uow.pedidos.add(pedido)

        return self.get_pedido(usuario_id, pedido_id, [ROLE_CLIENT])

    # ========================================================================
    # CANCELAR PEDIDO
    # ========================================================================

    async def cancelar_pedido(
        self,
        usuario_id: int,
        pedido_id: int,
        roles: list[str],
        motivo: Optional[str] = None,
    ) -> PedidoDetail:
        with PedidoUnitOfWork(self._session) as uow:
            pedido = self._get_pedido_seguro(uow, usuario_id, pedido_id, roles)

            is_client = not self._can_manage_all(roles)

            if is_client and pedido.estado_codigo not in (STATE_PENDIENTE, STATE_EN_PREP, STATE_ESPERANDO_CLIENTE):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Solo puedes cancelar pedidos pendientes o en preparación",
                )

            if is_client:
                estados_cancelables = [STATE_PENDIENTE, STATE_EN_PREP, STATE_ESPERANDO_CLIENTE]
            else:
                estados_cancelables = [STATE_PENDIENTE, STATE_CONFIRMADO, STATE_EN_PREP]

            if pedido.estado_codigo not in estados_cancelables:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"No se puede cancelar pedido en estado {pedido.estado_codigo}",
                )

            producto_ids_afectados: set[int] = set()
            if pedido.estado_codigo in [STATE_PENDIENTE, STATE_CONFIRMADO, STATE_EN_PREP, STATE_ESPERANDO_CLIENTE]:
                detalles = uow.detalles.get_by_pedido_id(pedido_id)
                for detalle in detalles:
                    self._aplicar_stock(uow, detalle.producto_id, detalle.cantidad, multiplicador=-1)
                    producto_ids_afectados.add(detalle.producto_id)

            pedido_anterior_codigo = pedido.estado_codigo
            pedido.estado_codigo = STATE_CANCELADO
            pedido = uow.pedidos.add(pedido)

            historial = HistorialEstadoPedido(
                pedido_id=pedido_id,
                estado_desde_codigo=pedido_anterior_codigo,
                estado_hacia_codigo=STATE_CANCELADO,
                usuario_id=usuario_id,
                motivo=motivo or "Pedido cancelado",
                fecha=datetime.now(timezone.utc),
            )
            uow.historial.add(historial)

            result = self._to_detail(pedido)

        await self._broadcast_pedido(
            event=EVENT_PEDIDO_CANCELADO,
            pedido_id=pedido_id,
            estado_anterior=pedido_anterior_codigo,
            estado_nuevo=result.estado_codigo,
            usuario_id=usuario_id,
            motivo=motivo,
        )
        await self._broadcast_stock_changes(producto_ids_afectados)
        return result

    async def recibir_pedido(self, usuario_id: int, pedido_id: int) -> PedidoDetail:
        """Cliente marca pedido como recibido (ESPERANDO_CLIENTE → ENTREGADO)."""
        with PedidoUnitOfWork(self._session) as uow:
            pedido = uow.pedidos.get_by_id_no_deleted(pedido_id, usuario_id=usuario_id)
            if not pedido:
                raise HTTPException(status_code=404, detail="Pedido no encontrado")
            if pedido.estado_codigo != STATE_ESPERANDO_CLIENTE:
                raise HTTPException(
                    status_code=400,
                    detail="El pedido no puede marcarse como recibido en su estado actual",
                )

            pedido_anterior_codigo = pedido.estado_codigo
            pedido.estado_codigo = STATE_ENTREGADO
            pedido = uow.pedidos.add(pedido)

            historial = HistorialEstadoPedido(
                pedido_id=pedido_id,
                estado_desde_codigo=pedido_anterior_codigo,
                estado_hacia_codigo=STATE_ENTREGADO,
                usuario_id=usuario_id,
                motivo="Pedido recibido por el cliente",
                fecha=datetime.now(timezone.utc),
            )
            uow.historial.add(historial)

            result = self._to_detail(pedido)

        await self._broadcast_pedido(
            event=EVENT_ESTADO_CAMBIADO,
            pedido_id=pedido_id,
            estado_anterior=pedido_anterior_codigo,
            estado_nuevo=STATE_ENTREGADO,
            usuario_id=usuario_id,
            motivo="Pedido recibido por el cliente",
        )
        return result

    # ========================================================================
    # CAMBIAR ESTADO (ADMIN)
    # ========================================================================

    async def cambiar_estado(
        self,
        usuario_id: int,
        pedido_id: int,
        data: CambiarEstadoPedidoRequest,
        roles: list[str] | None = None,
    ) -> PedidoDetail:
        with PedidoUnitOfWork(self._session) as uow:
            pedido = uow.pedidos.get_by_id_no_deleted(pedido_id)
            if not pedido:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Pedido no encontrado",
                )

            if is_terminal(pedido.estado_codigo):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"No se puede modificar un pedido en estado {pedido.estado_codigo}",
                )

            # PEDIDOS role can only: cancelar (EN_PREP/A_ENTREGAR) o avanzar A_ENTREGAR → ESPERANDO_CLIENTE
            if roles and not self._is_admin(roles):
                if pedido.estado_codigo == STATE_PENDIENTE and normalize_state(data.estado_codigo) not in [STATE_CANCELADO]:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="El rol PEDIDOS solo puede cancelar pedidos en estado PENDIENTE",
                    )
                if pedido.estado_codigo == STATE_CONFIRMADO and normalize_state(data.estado_codigo) not in [STATE_CANCELADO]:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="El rol PEDIDOS solo puede cancelar pedidos en estado CONFIRMADO",
                    )
                if pedido.estado_codigo == STATE_EN_PREP and normalize_state(data.estado_codigo) not in [STATE_CANCELADO]:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="El rol PEDIDOS solo puede cancelar pedidos en preparación",
                    )
                if pedido.estado_codigo == STATE_A_ENTREGAR and normalize_state(data.estado_codigo) not in [STATE_ESPERANDO_CLIENTE, STATE_CANCELADO]:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="El rol PEDIDOS solo puede confirmar entrega o cancelar pedidos listos para entregar",
                    )

            estado_destino_codigo = normalize_state(data.estado_codigo)

            # RN-05: el motivo es obligatorio cuando el nuevo estado es CANCELADO.
            if estado_destino_codigo == STATE_CANCELADO and not (data.motivo and data.motivo.strip()):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="El motivo es obligatorio para cancelar un pedido (RN-05)",
                )

            estado_destino = uow.estados.get_by_codigo(estado_destino_codigo)
            if not estado_destino:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Estado {estado_destino_codigo} no existe",
                )

            transiciones_validas = self.TRANSICIONES_VALIDAS.get(pedido.estado_codigo, [])
            if estado_destino_codigo not in transiciones_validas:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Transición de {pedido.estado_codigo} a {estado_destino_codigo} no permitida",
                )

            accion_stock = self.TRANSICIONES_STOCK.get((pedido.estado_codigo, estado_destino_codigo))
            producto_ids_afectados: set[int] = set()
            low_stock_alerts: list[dict] = []
            if accion_stock == "restore":
                detalles = uow.detalles.get_by_pedido_id(pedido_id)
                for detalle in detalles:
                    self._aplicar_stock(uow, detalle.producto_id, detalle.cantidad, multiplicador=-1)
                    producto_ids_afectados.add(detalle.producto_id)
            elif accion_stock == "discount":
                detalles = uow.detalles.get_by_pedido_id(pedido_id)
                for detalle in detalles:
                    low_stock_alerts.extend(
                        self._aplicar_stock(uow, detalle.producto_id, detalle.cantidad, multiplicador=1)
                    )
                    producto_ids_afectados.add(detalle.producto_id)

            pedido_anterior_codigo = pedido.estado_codigo
            pedido.estado_codigo = estado_destino_codigo
            pedido = uow.pedidos.add(pedido)

            historial = HistorialEstadoPedido(
                pedido_id=pedido_id,
                estado_desde_codigo=pedido_anterior_codigo,
                estado_hacia_codigo=estado_destino_codigo,
                usuario_id=usuario_id,
                motivo=data.motivo or f"Cambio de estado a {estado_destino_codigo}",
                fecha=datetime.now(timezone.utc),
            )
            uow.historial.add(historial)

            result = self._to_detail(pedido)

        await self._broadcast_pedido(
            event=EVENT_ESTADO_CAMBIADO,
            pedido_id=pedido_id,
            estado_anterior=pedido_anterior_codigo,
            estado_nuevo=result.estado_codigo,
            usuario_id=usuario_id,
            motivo=data.motivo,
        )
        await self._broadcast_stock_changes(producto_ids_afectados)
        for alert in low_stock_alerts:
            await manager.broadcast("LOW_STOCK", alert)
        return result

    # ========================================================================
    # OBTENER PEDIDOS
    # ========================================================================

    def get_pedido(self, usuario_id: int, pedido_id: int, roles: list[str]) -> PedidoDetail:
        with PedidoUnitOfWork(self._session) as uow:
            pedido = self._get_pedido_seguro(uow, usuario_id, pedido_id, roles)
            result = self._to_detail(pedido)
        return result

    def list_pedidos(
        self,
        usuario_id: int,
        offset: int = 0,
        limit: int = 20,
        roles: list[str] | None = None,
        estado: str | None = None,
        forma_pago: str | None = None,
        fecha_desde: datetime | None = None,
        fecha_hasta: datetime | None = None,
    ) -> PedidoList:
        roles = roles or []
        with PedidoUnitOfWork(self._session) as uow:
            if self._can_manage_all(roles):
                pedidos = uow.pedidos.get_all_filtered(
                    offset=offset, limit=limit,
                    estado=estado, forma_pago=forma_pago,
                    fecha_desde=fecha_desde, fecha_hasta=fecha_hasta,
                )
                total = uow.pedidos.count_all_filtered(
                    estado=estado, forma_pago=forma_pago,
                    fecha_desde=fecha_desde, fecha_hasta=fecha_hasta,
                )
            else:
                pedidos = uow.pedidos.get_by_usuario_id(usuario_id, offset=offset, limit=limit)
                total = uow.pedidos.count_by_usuario(usuario_id)
            data = [self._to_public(p) for p in pedidos]
        return PedidoList(data=data, total=total)

    # ========================================================================
    # HISTORIAL
    # ========================================================================

    def get_historial(self, usuario_id: int, pedido_id: int, roles: list[str]) -> HistorialEstadoPedidoList:
        with PedidoUnitOfWork(self._session) as uow:
            self._get_pedido_seguro(uow, usuario_id, pedido_id, roles)
            historiales = uow.historial.get_by_pedido_id(pedido_id)
            data = [self._historial_to_public(h) for h in historiales]
        return HistorialEstadoPedidoList(data=data)

    # ========================================================================
    # HELPERS
    # ========================================================================

    def _get_pedido_seguro(
        self, uow: PedidoUnitOfWork, usuario_id: int, pedido_id: int, roles: list[str] | None = None
    ) -> Pedido:
        roles = roles or []
        if self._can_manage_all(roles):
            pedido = uow.pedidos.get_by_id_no_deleted(pedido_id)
        else:
            pedido = uow.pedidos.get_by_id_no_deleted(pedido_id, usuario_id=usuario_id)

        if not pedido:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Pedido no encontrado",
            )

        return pedido

    def _to_public(self, pedido: Pedido) -> PedidoPublic:
        pago = PagoRepository(self._session).get_ultimo_by_pedido(pedido.id)
        motivo = None
        if pedido.estado_codigo == STATE_CANCELADO:
            ultimo_historial = HistorialEstadoPedidoRepository(self._session).get_last_by_pedido(pedido.id)
            if ultimo_historial:
                motivo = ultimo_historial.motivo
        return PedidoPublic(
            id=pedido.id,
            usuario_id=pedido.usuario_id,
            direccion_entrega_id=pedido.direccion_entrega_id,
            forma_pago_codigo=pedido.forma_pago_codigo,
            estado_codigo=pedido.estado_codigo,
            subtotal=pedido.subtotal,
            descuento=pedido.descuento,
            costo_envio=pedido.costo_envio,
            total=pedido.total,
            notas=pedido.notas,
            created_at=pedido.created_at.replace(tzinfo=timezone.utc) if pedido.created_at else None,
            pago_estado=pago.estado if pago else None,
            pago_mp_status=pago.mp_status if pago else None,
            motivo=motivo,
        )

    def _to_detail(self, pedido: Pedido) -> PedidoDetail:
        estado = self._estado_repo.get_by_codigo(pedido.estado_codigo)
        detalles = self._detalle_repo.get_by_pedido_id(pedido.id)
        pago_repo = PagoRepository(self._session)
        pago = pago_repo.get_ultimo_by_pedido(pedido.id)

        motivo = None
        if pedido.estado_codigo == STATE_CANCELADO:
            ultimo_historial = HistorialEstadoPedidoRepository(self._session).get_last_by_pedido(pedido.id)
            if ultimo_historial:
                motivo = ultimo_historial.motivo

        return PedidoDetail(
            id=pedido.id,
            usuario_id=pedido.usuario_id,
            direccion_entrega_id=pedido.direccion_entrega_id,
            forma_pago_codigo=pedido.forma_pago_codigo,
            estado_codigo=pedido.estado_codigo,
            subtotal=pedido.subtotal,
            descuento=pedido.descuento,
            costo_envio=pedido.costo_envio,
            total=pedido.total,
            notas=pedido.notas,
            motivo=motivo,
            created_at=pedido.created_at.replace(tzinfo=timezone.utc) if pedido.created_at else None,
            updated_at=pedido.updated_at.replace(tzinfo=timezone.utc) if pedido.updated_at else None,
            estado=self._estado_to_public(estado) if estado else EstadoPedidoPublic(
                codigo="UNKNOWN",
                nombre="Desconocido",
            ),
            detalles=[self._detalle_to_public(d) for d in detalles],
            pago_estado=pago.estado if pago else None,
            pago_mp_status=pago.mp_status if pago else None,
            pago_mp_payment_id=pago.mp_payment_id if pago else None,
        )

    def _detalle_to_public(self, detalle: DetallePedido) -> DetallePedidoPublic:
        return DetallePedidoPublic(
            id=detalle.id,
            producto_id=detalle.producto_id,
            cantidad=detalle.cantidad,
            nombre_snapshot=detalle.nombre_snapshot,
            precio_snapshot=detalle.precio_snapshot,
            subtotal_snapshot=detalle.subtotal_snapshot,
            personalizacion=detalle.personalizacion,
        )

    def _estado_to_public(self, estado: EstadoPedido) -> EstadoPedidoPublic:
        return EstadoPedidoPublic(
            codigo=estado.codigo,
            nombre=estado.nombre,
            descripcion=estado.descripcion,
        )

    @staticmethod
    def _schedule_avance_en_prep(pedido_id: int) -> None:
        """Programa avance automático CONFIRMADO → EN_PREP a los 3 s."""
        import asyncio
        asyncio.get_running_loop().call_later(
            3,
            lambda pid=pedido_id: PedidoService._avanzar_a_en_prep(pid),
        )

    @staticmethod
    def _avanzar_a_en_prep(pedido_id: int) -> None:
        """Timer: 3 s después de confirmar pago, avanza CONFIRMADO → EN_PREP."""
        from app.core.database import engine
        try:
            with Session(engine) as session:
                repo = PedidoRepository(session)
                pedido = repo.get_by_id(pedido_id)
                if not pedido or pedido.estado_codigo != STATE_CONFIRMADO:
                    return
                pedido_anterior = pedido.estado_codigo
                pedido.estado_codigo = STATE_EN_PREP
                pedido.updated_at = datetime.now(timezone.utc)
                repo.add(pedido)
                historial = HistorialEstadoPedido(
                    pedido_id=pedido_id,
                    estado_desde_codigo=pedido_anterior,
                    estado_hacia_codigo=STATE_EN_PREP,
                    usuario_id=None,
                    motivo="Avance automático a en preparación",
                    fecha=datetime.now(timezone.utc),
                )
                historial_repo = HistorialEstadoPedidoRepository(session)
                historial_repo.add(historial)
                session.commit()
            import asyncio
            from app.core.websocket import manager
            from app.core.sse import sse_manager
            from app.modules.pedidos.events import EVENT_ESTADO_CAMBIADO, build_pedido_event
            evento = build_pedido_event(
                event=EVENT_ESTADO_CAMBIADO,
                pedido_id=pedido_id,
                estado_anterior=pedido_anterior,
                estado_nuevo=STATE_EN_PREP,
                usuario_id=None,
                motivo="Avance automático a en preparación",
            )
            loop = asyncio.get_running_loop()
            if loop.is_running():
                loop.create_task(manager.broadcast_pedido(pedido_id, evento))
                loop.create_task(sse_manager.broadcast(EVENT_ESTADO_CAMBIADO, evento))
            else:
                loop.run_until_complete(manager.broadcast_pedido(pedido_id, evento))
                loop.run_until_complete(sse_manager.broadcast(EVENT_ESTADO_CAMBIADO, evento))
            PedidoService._schedule_avance_a_entregar(pedido_id)
        except Exception:
            logger.exception("Error en timer auto-advance EN_PREP pedido %s", pedido_id)

    @staticmethod
    def _schedule_avance_a_entregar(pedido_id: int) -> None:
        """Programa avance automático EN_PREP → A_ENTREGAR a los 15 s."""
        import asyncio
        asyncio.get_running_loop().call_later(
            15,
            lambda pid=pedido_id: PedidoService._avanzar_a_entregar(pid),
        )

    @staticmethod
    def _avanzar_a_entregar(pedido_id: int) -> None:
        """Timer: 15 s después de EN_PREP, avanza EN_PREP → A_ENTREGAR."""
        from app.core.database import engine
        try:
            with Session(engine) as session:
                repo = PedidoRepository(session)
                pedido = repo.get_by_id(pedido_id)
                if not pedido or pedido.estado_codigo != STATE_EN_PREP:
                    return
                pedido_anterior = pedido.estado_codigo
                pedido.estado_codigo = STATE_A_ENTREGAR
                pedido.updated_at = datetime.now(timezone.utc)
                repo.add(pedido)
                historial = HistorialEstadoPedido(
                    pedido_id=pedido_id,
                    estado_desde_codigo=pedido_anterior,
                    estado_hacia_codigo=STATE_A_ENTREGAR,
                    usuario_id=None,
                    motivo="Avance automático a listo para entregar",
                    fecha=datetime.now(timezone.utc),
                )
                historial_repo = HistorialEstadoPedidoRepository(session)
                historial_repo.add(historial)
                session.commit()
            import asyncio
            from app.core.websocket import manager
            from app.core.sse import sse_manager
            from app.modules.pedidos.events import EVENT_ESTADO_CAMBIADO, build_pedido_event
            evento = build_pedido_event(
                event=EVENT_ESTADO_CAMBIADO,
                pedido_id=pedido_id,
                estado_anterior=pedido_anterior,
                estado_nuevo=STATE_A_ENTREGAR,
                usuario_id=None,
                motivo="Avance automático a listo para entregar",
            )
            loop = asyncio.get_running_loop()
            if loop.is_running():
                loop.create_task(manager.broadcast_pedido(pedido_id, evento))
                loop.create_task(sse_manager.broadcast(EVENT_ESTADO_CAMBIADO, evento))
            else:
                loop.run_until_complete(manager.broadcast_pedido(pedido_id, evento))
                loop.run_until_complete(sse_manager.broadcast(EVENT_ESTADO_CAMBIADO, evento))
        except Exception:
            logger.exception("Error en timer auto-advance A_ENTREGAR pedido %s", pedido_id)

    def _historial_to_public(self, historial: HistorialEstadoPedido) -> HistorialEstadoPedidoPublic:
        return HistorialEstadoPedidoPublic(
            id=historial.id,
            pedido_id=historial.pedido_id,
            estado_desde_codigo=historial.estado_desde_codigo,
            estado_hacia_codigo=historial.estado_hacia_codigo,
            usuario_id=historial.usuario_id,
            motivo=historial.motivo,
            fecha=historial.fecha,
        )
