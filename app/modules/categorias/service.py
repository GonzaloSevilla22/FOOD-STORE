from datetime import datetime, timezone

from fastapi import HTTPException
from sqlmodel import Session

from app.modules.categorias.models import Categoria
from app.modules.catalogo.unit_of_work import CatalogUnitOfWork
from app.modules.categorias.schemas import (
    CategoriaCreate,
    CategoriaDetail,
    CategoriaList,
    CategoriaMini,
    CategoriaProductoInfo,
    CategoriaPublic,
    CategoriaUpdate,
)


class CategoriaService:
    """
    Servicio de negocio para Categoría.
    Usa CatalogUnitOfWork para transacciones atómicas.
    Patrón: __init__(session) -> cada método abre UoW.
    """

    def __init__(self, session: Session) -> None:
        self._session = session

    def _is_active(self, categoria: Categoria) -> bool:
        return bool(categoria.activo) and categoria.deleted_at is None

    def create(self, data: CategoriaCreate) -> CategoriaPublic:
        """Crear nueva categoría."""
        with CatalogUnitOfWork(self._session) as uow:
            existing = uow.categorias.get_by_nombre(data.nombre)
            if existing is not None:
                raise HTTPException(status_code=409, detail="Categoría con ese nombre ya existe")

            if data.parent_id is not None:
                parent = uow.categorias.get_by_id(data.parent_id)
                if parent is None or not self._is_active(parent):
                    raise HTTPException(status_code=422, detail="La categoría padre no existe o está inactiva")

            categoria = Categoria(**data.model_dump())
            uow.categorias.add(categoria)
            result = CategoriaPublic.model_validate(categoria)

        return result

    def get_all(self, offset: int = 0, limit: int = 20, include_deleted: bool = False) -> CategoriaList:
        """Obtener todas las categorías (opcionalmente incluyendo inactivas)."""
        with CatalogUnitOfWork(self._session) as uow:
            if include_deleted:
                items = uow.categorias.get_all_paginated(offset=offset, limit=limit)
                total = uow.categorias.count_all()
            else:
                items = uow.categorias.get_active_paginated(offset=offset, limit=limit)
                total = uow.categorias.count_active()
            data = [CategoriaPublic.model_validate(item) for item in items]
        return CategoriaList(data=data, total=total)

    def get_by_id(self, categoria_id: int) -> CategoriaPublic:
        """Obtener categoría por ID."""
        with CatalogUnitOfWork(self._session) as uow:
            categoria = uow.categorias.get_by_id(categoria_id)
            if categoria is None or not self._is_active(categoria):
                raise HTTPException(status_code=404, detail="Categoría no encontrada")
            result = CategoriaPublic.model_validate(categoria)
        return result

    def get_detail(self, categoria_id: int) -> CategoriaDetail:
        """Obtener detalle de categoría con jerarquía y productos asociados."""
        with CatalogUnitOfWork(self._session) as uow:
            categoria = uow.categorias.get_by_id(categoria_id)
            if categoria is None:
                raise HTTPException(status_code=404, detail="Categoría no encontrada")

            parent = None
            if categoria.parent is not None:
                parent = CategoriaMini(
                    id=categoria.parent.id,
                    nombre=categoria.parent.nombre,
                    activo=bool(categoria.parent.activo) and categoria.parent.deleted_at is None,
                )

            subcategorias = [
                CategoriaMini(
                    id=sub.id,
                    nombre=sub.nombre,
                    activo=bool(sub.activo) and sub.deleted_at is None,
                )
                for sub in categoria.subcategorias
            ]

            productos_asociados = [
                CategoriaProductoInfo(
                    producto_id=relation.producto_id,
                    producto_nombre=relation.producto.nombre if relation.producto else f"Producto {relation.producto_id}",
                    activo=(relation.producto.activo and relation.producto.deleted_at is None) if relation.producto else False,
                )
                for relation in categoria.productos_categorias
            ]

            result = CategoriaDetail(
                **CategoriaPublic.model_validate(categoria).model_dump(),
                parent=parent,
                subcategorias=subcategorias,
                productos_asociados=productos_asociados,
            )

        return result

    def update(self, categoria_id: int, data: CategoriaUpdate) -> CategoriaPublic:
        """Actualizar categoría."""
        with CatalogUnitOfWork(self._session) as uow:
            categoria = uow.categorias.get_by_id(categoria_id)
            if categoria is None or not self._is_active(categoria):
                raise HTTPException(status_code=404, detail="Categoría no encontrada")

            if data.nombre and data.nombre != categoria.nombre:
                existing = uow.categorias.get_by_nombre(data.nombre)
                if existing is not None:
                    raise HTTPException(status_code=409, detail="Categoría con ese nombre ya existe")

            update_data = data.model_dump(exclude_unset=True)
            if "parent_id" in update_data and update_data["parent_id"] is not None:
                parent = uow.categorias.get_by_id(update_data["parent_id"])
                if parent is None or not self._is_active(parent):
                    raise HTTPException(status_code=422, detail="La categoría padre no existe o está inactiva")
                if update_data["parent_id"] == categoria.id:
                    raise HTTPException(status_code=422, detail="Una categoría no puede ser padre de sí misma")

            for key, value in update_data.items():
                setattr(categoria, key, value)

            categoria.updated_at = datetime.now(timezone.utc)
            uow.categorias.add(categoria)
            result = CategoriaPublic.model_validate(categoria)

        return result

    def soft_delete(self, categoria_id: int) -> None:
        """Soft delete usando el campo activo."""
        with CatalogUnitOfWork(self._session) as uow:
            categoria = uow.categorias.get_by_id(categoria_id)
            if categoria is None or not self._is_active(categoria):
                raise HTTPException(status_code=404, detail="Categoría no encontrada")

            if uow.categorias.has_active_products(categoria_id):
                raise HTTPException(
                    status_code=409,
                    detail="No se puede desactivar la categoría porque tiene productos activos asociados",
                )

            if uow.categorias.has_active_subcategories(categoria_id):
                raise HTTPException(
                    status_code=409,
                    detail="No se puede desactivar la categoría porque tiene subcategorías activas",
                )

            now = datetime.now(timezone.utc)
            categoria.activo = False
            categoria.deleted_at = now
            categoria.updated_at = now
            uow.categorias.add(categoria)

    def restore(self, categoria_id: int) -> CategoriaPublic:
        """Restaurar una categoría dada de baja."""
        with CatalogUnitOfWork(self._session) as uow:
            categoria = uow.categorias.get_by_id(categoria_id)
            if categoria is None or self._is_active(categoria):
                raise HTTPException(status_code=404, detail="Categoría no encontrada")

            if categoria.parent_id is not None:
                parent = uow.categorias.get_by_id(categoria.parent_id)
                if parent is None or not self._is_active(parent):
                    raise HTTPException(
                        status_code=422,
                        detail="No se puede activar la subcategoría porque su categoría padre está inactiva",
                    )

            categoria.activo = True
            categoria.deleted_at = None
            categoria.updated_at = datetime.now(timezone.utc)
            uow.categorias.add(categoria)
            result = CategoriaPublic.model_validate(categoria)

        return result
