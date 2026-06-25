from decimal import Decimal

from sqlmodel import Session, delete, func, select

from app.core.repository import BaseRepository
from app.modules.categorias.models import ProductoCategoria
from app.modules.productos.models import Producto, ProductoIngrediente


class ProductoRepository(BaseRepository[Producto]):
    """
    Repository específico para Producto.
    Hereda CRUD genérico de BaseRepository[Producto].
    Incluye queries personalizadas para filtrados comunes.
    """

    def __init__(self, session: Session):
        super().__init__(session, Producto)

    def get_by_nombre(self, nombre: str) -> Producto | None:
        """Buscar producto por nombre exacto."""
        statement = select(Producto).where(Producto.nombre == nombre)
        return self.session.exec(statement).first()

    def get_active_paginated(self, offset: int = 0, limit: int = 20) -> list[Producto]:
        """Obtener productos no eliminados con paginación."""
        statement = (
            select(Producto)
            .where(Producto.deleted_at.is_(None), Producto.activo.is_(True))
            .offset(offset)
            .limit(limit)
        )
        return self.session.exec(statement).all()

    def count_active(self) -> int:
        """Contar productos no eliminados."""
        statement = select(func.count()).select_from(Producto).where(
            Producto.deleted_at.is_(None),
            Producto.activo.is_(True),
        )
        return self.session.exec(statement).one()

    def set_categoria_principal(self, producto_id: int, categoria_id: int) -> None:
        """Reemplazar la categoría principal del producto."""
        self.session.exec(
            delete(ProductoCategoria).where(
                ProductoCategoria.producto_id == producto_id
            )
        )
        self.session.add(
            ProductoCategoria(
                producto_id=producto_id,
                categoria_id=categoria_id,
                es_principal=True,
            )
        )

    def clear_categoria_principal(self, producto_id: int) -> None:
        """Eliminar cualquier relación de categoría principal del producto."""
        self.session.exec(
            delete(ProductoCategoria).where(
                ProductoCategoria.producto_id == producto_id
            )
        )

    def set_ingredientes(self, producto_id: int, ingredientes: list[dict]) -> None:
        """
        Reemplazar ingredientes asociados del producto.
        
        Args:
            producto_id: ID del producto
            ingredientes: Lista de dicts con:
                - ingrediente_id: int
                - cantidad: Decimal (DECIMAL 10,3)
                - unidad_medida_id: int (FK → UnidadMedida.id)
                - es_removible: bool (opcional, default=True)
                - es_opcional: bool (opcional, default=False)
        """
        self.session.exec(
            delete(ProductoIngrediente).where(
                ProductoIngrediente.producto_id == producto_id
            )
        )

        for ing in ingredientes:
            self.session.add(
                ProductoIngrediente(
                    producto_id=producto_id,
                    ingrediente_id=ing["ingrediente_id"],
                    cantidad=ing["cantidad"],
                    unidad_medida_id=ing["unidad_medida_id"],
                    es_removible=ing.get("es_removible", True),
                    es_opcional=ing.get("es_opcional", False),
                )
            )

    def get_active_by_id(self, producto_id: int) -> Producto | None:
        statement = (
            select(Producto)
            .where(
                Producto.id == producto_id,
                Producto.activo.is_(True),
                Producto.deleted_at.is_(None),
            )
        )
        return self.session.exec(statement).first()

    def get_disponibles(self, offset: int = 0, limit: int = 100) -> list[Producto]:
        """Obtener todos los productos activos no eliminados (haya o no stock)."""
        statement = (
            select(Producto)
            .where(Producto.deleted_at.is_(None), Producto.activo.is_(True))
            .offset(offset)
            .limit(limit)
        )
        return self.session.exec(statement).all()

    def get_by_precio_range(
        self, min_precio: Decimal, max_precio: Decimal
    ) -> list[Producto]:
        """Obtener productos dentro de un rango de precio."""
        statement = select(Producto).where(
            Producto.precio_base >= min_precio,
            Producto.precio_base <= max_precio,
            Producto.deleted_at.is_(None),
            Producto.activo.is_(True),
        )
        return self.session.exec(statement).all()

    def get_all_paginated(self, offset: int = 0, limit: int = 20) -> list[Producto]:
        """Obtener TODOS los productos (incluyendo deletedados) con paginación."""
        statement = (
            select(Producto)
            .offset(offset)
            .limit(limit)
        )
        return self.session.exec(statement).all()

    def count_all(self) -> int:
        """Contar TODOS los productos (incluyendo deletedados)."""
        statement = select(func.count()).select_from(Producto)
        return self.session.exec(statement).one()
