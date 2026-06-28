from sqlmodel import Session

from app.core.unit_of_work import UnitOfWork
from app.modules.pedidos.pedido_repository import PedidoRepository
from app.modules.pedidos.detalle_pedido_repository import DetallePedidoRepository
from app.modules.pedidos.estado_pedido_repository import EstadoPedidoRepository
from app.modules.pedidos.historial_estado_pedido_repository import HistorialEstadoPedidoRepository
from app.modules.usuarios.repository import UsuarioRepository
from app.modules.usuarios.direccion_entrega_repository import DireccionEntregaRepository
from app.modules.productos.repository import ProductoRepository


class PedidoUnitOfWork(UnitOfWork):
    def __init__(self, session: Session):
        super().__init__(session)
        self.pedidos = PedidoRepository(session)
        self.detalles = DetallePedidoRepository(session)
        self.estados = EstadoPedidoRepository(session)
        self.historial = HistorialEstadoPedidoRepository(session)
        self.usuarios = UsuarioRepository(session)
        self.direcciones = DireccionEntregaRepository(session)
        self.productos = ProductoRepository(session)
