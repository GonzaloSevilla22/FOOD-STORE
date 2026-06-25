"""
Módulo Catálogo: agrupa lógica de Categorías, Productos e Ingredientes.
Esta es la capa de coordinación (UnitOfWork + Repositories compartidos).
"""

from app.modules.catalogo.unit_of_work import CatalogUnitOfWork

__all__ = ["CatalogUnitOfWork"]
