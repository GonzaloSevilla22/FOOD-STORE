from sqlmodel import Session, func, select

from app.core.repository import BaseRepository
from app.modules.categorias.models import Categoria, ProductoCategoria
from app.modules.productos.models import Producto


class CategoriaRepository(BaseRepository[Categoria]):
    """
    Repository específico para Categoria.
    Hereda CRUD genérico de BaseRepository[Categoria].
    Puede tener queries personalizadas si es necesario.
    """

    def __init__(self, session: Session):
        super().__init__(session, Categoria)

    def get_by_nombre(self, nombre: str) -> Categoria | None:
        """Buscar categoría por nombre exacto."""
        statement = select(Categoria).where(Categoria.nombre == nombre)
        return self.session.exec(statement).first()

    def get_active_paginated(self, offset: int = 0, limit: int = 20) -> list[Categoria]:
        """Obtener categorías no eliminadas con paginación."""
        statement = (
            select(Categoria)
            .where(Categoria.deleted_at.is_(None), Categoria.activo.is_(True))
            .offset(offset)
            .limit(limit)
        )
        return self.session.exec(statement).all()

    def count_active(self) -> int:
        """Contar categorías no eliminadas."""
        statement = select(func.count()).select_from(Categoria).where(
            Categoria.deleted_at.is_(None),
            Categoria.activo.is_(True),
        )
        return self.session.exec(statement).one()

    def get_root_categories(self) -> list[Categoria]:
        """Obtener todas las categorías raíz (sin parent)."""
        statement = select(Categoria).where(
            Categoria.parent_id.is_(None),
            Categoria.deleted_at.is_(None),
            Categoria.activo.is_(True),
        )
        return self.session.exec(statement).all()

    def get_all_paginated(self, offset: int = 0, limit: int = 20) -> list[Categoria]:
        """Obtener TODAS las categorías (incluyendo deletedadas) con paginación."""
        statement = (
            select(Categoria)
            .offset(offset)
            .limit(limit)
        )
        return self.session.exec(statement).all()

    def count_all(self) -> int:
        """Contar TODAS las categorías (incluyendo deletedadas)."""
        statement = select(func.count()).select_from(Categoria)
        return self.session.exec(statement).one()

    def has_active_subcategories(self, categoria_id: int) -> bool:
        """Indicar si la categoría tiene subcategorías activas."""
        statement = select(func.count()).select_from(Categoria).where(
            Categoria.parent_id == categoria_id,
            Categoria.deleted_at.is_(None),
            Categoria.activo.is_(True),
        )
        return self.session.exec(statement).one() > 0

    def has_active_products(self, categoria_id: int) -> bool:
        """Indicar si la categoría tiene productos activos asociados."""
        statement = (
            select(func.count())
            .select_from(ProductoCategoria)
            .join(Producto, Producto.id == ProductoCategoria.producto_id)
            .where(
                ProductoCategoria.categoria_id == categoria_id,
                Producto.deleted_at.is_(None),
                Producto.activo.is_(True),
            )
        )
        return self.session.exec(statement).one() > 0
