from sqlmodel import Session

from app.core.unit_of_work import UnitOfWork
from app.modules.categorias.repository import CategoriaRepository
from app.modules.ingredientes.repository import IngredienteRepository
from app.modules.productos.repository import ProductoRepository


class CatalogUnitOfWork(UnitOfWork):
    """
    Domain-Specific Unit Of Work para el dominio Catálogo.
    Agrega todos los repositories (Categoria, Producto, Ingrediente).
    Se usa como context manager en las operaciones atómicas:

    with CatalogUnitOfWork(session) as uow:
        cat = uow.categorias.get_by_id(1)
        prod = uow.productos.get_by_id(1)
        uow.commit()  # automático en __exit__ si no hay error
    """

    def __init__(self, session: Session):
        super().__init__(session)
        self.categorias = CategoriaRepository(session)
        self.productos = ProductoRepository(session)
        self.ingredientes = IngredienteRepository(session)
