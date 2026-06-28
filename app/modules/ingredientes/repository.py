from sqlmodel import Session, func, select

from app.core.repository import BaseRepository
from app.modules.ingredientes.models import Ingrediente, UnidadMedida
from app.modules.productos.models import Producto, ProductoIngrediente


class IngredienteRepository(BaseRepository[Ingrediente]):
    """
    Repository específico para Ingrediente.
    Hereda CRUD genérico de BaseRepository[Ingrediente].
    """

    def __init__(self, session: Session):
        super().__init__(session, Ingrediente)

    def get_by_nombre(self, nombre: str) -> Ingrediente | None:
        """Buscar ingrediente por nombre exacto."""
        statement = select(Ingrediente).where(Ingrediente.nombre == nombre)
        return self.session.exec(statement).first()

    def list_unidades_medida(self) -> list[UnidadMedida]:
        """Todas las unidades de medida (datos de referencia)."""
        return list(self.session.exec(select(UnidadMedida).order_by(UnidadMedida.id)).all())

    def get_active_paginated(
        self, offset: int = 0, limit: int = 20
    ) -> list[Ingrediente]:
        """Obtener ingredientes no eliminados con paginación."""
        statement = (
            select(Ingrediente)
            .where(Ingrediente.deleted_at.is_(None), Ingrediente.activo.is_(True))
            .order_by(Ingrediente.id)
            .offset(offset)
            .limit(limit)
        )
        return self.session.exec(statement).all()

    def count_active(self) -> int:
        """Contar ingredientes no eliminados."""
        statement = select(func.count()).select_from(Ingrediente).where(
            Ingrediente.deleted_at.is_(None),
            Ingrediente.activo.is_(True),
        )
        return self.session.exec(statement).one()

    def get_alergenos(self) -> list[Ingrediente]:
        """Obtener todos los alérgenos."""
        statement = select(Ingrediente).where(
            Ingrediente.es_alergeno.is_(True),
            Ingrediente.deleted_at.is_(None),
            Ingrediente.activo.is_(True),
        )
        return self.session.exec(statement).all()

    def get_all_paginated(
        self, offset: int = 0, limit: int = 20
    ) -> list[Ingrediente]:
        """Obtener TODOS los ingredientes (incluyendo deletedados) con paginación."""
        statement = (
            select(Ingrediente)
            .order_by(Ingrediente.id)
            .offset(offset)
            .limit(limit)
        )
        return self.session.exec(statement).all()

    def count_all(self) -> int:
        """Contar TODOS los ingredientes (incluyendo deletedados)."""
        statement = select(func.count()).select_from(Ingrediente)
        return self.session.exec(statement).one()

    def has_active_product_usage(self, ingrediente_id: int) -> bool:
        """Indicar si el ingrediente está asociado a productos activos."""
        statement = (
            select(func.count())
            .select_from(ProductoIngrediente)
            .join(Producto, Producto.id == ProductoIngrediente.producto_id)
            .where(
                ProductoIngrediente.ingrediente_id == ingrediente_id,
                Producto.deleted_at.is_(None),
                Producto.activo.is_(True),
            )
        )
        return self.session.exec(statement).one() > 0
