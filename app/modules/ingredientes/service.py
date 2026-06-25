from datetime import datetime, timezone

from fastapi import HTTPException
from sqlmodel import Session

from app.core.websocket import manager
from app.modules.ingredientes.models import Ingrediente
from app.modules.catalogo.unit_of_work import CatalogUnitOfWork
from app.modules.ingredientes.schemas import (
    IngredienteCreate,
    IngredienteDetail,
    IngredienteList,
    IngredienteProductoUso,
    IngredientePublic,
    IngredienteUpdate,
    UnidadMedidaPublic,
)


class IngredienteService:
    """
    Servicio de negocio para Ingrediente.
    Usa CatalogUnitOfWork para transacciones atómicas.
    """

    def __init__(self, session: Session) -> None:
        self._session = session

    def _is_active(self, ingrediente: Ingrediente) -> bool:
        return bool(ingrediente.activo) and ingrediente.deleted_at is None

    def list_unidades_medida(self) -> list[UnidadMedidaPublic]:
        """Listar las unidades de medida disponibles (datos de referencia)."""
        with CatalogUnitOfWork(self._session) as uow:
            return [
                UnidadMedidaPublic.model_validate(u)
                for u in uow.ingredientes.list_unidades_medida()
            ]

    async def _broadcast_event(self, event_type: str, data: dict) -> None:
        await manager.broadcast(event_type, data)

    def create(self, data: IngredienteCreate) -> IngredientePublic:
        """Crear nuevo ingrediente."""
        with CatalogUnitOfWork(self._session) as uow:
            existing = uow.ingredientes.get_by_nombre(data.nombre)
            if existing is not None:
                raise HTTPException(status_code=409, detail="Ingrediente con ese nombre ya existe")

            ingrediente = Ingrediente(**data.model_dump())
            uow.ingredientes.add(ingrediente)
            result = IngredientePublic.model_validate(ingrediente)

        return result

    def get_all(self, offset: int = 0, limit: int = 20, include_deleted: bool = False) -> IngredienteList:
        """Obtener todos los ingredientes (opcionalmente incluyendo inactivos)."""
        with CatalogUnitOfWork(self._session) as uow:
            if include_deleted:
                items = uow.ingredientes.get_all_paginated(offset=offset, limit=limit)
                total = uow.ingredientes.count_all()
            else:
                items = uow.ingredientes.get_active_paginated(offset=offset, limit=limit)
                total = uow.ingredientes.count_active()
            data = [IngredientePublic.model_validate(item) for item in items]
        return IngredienteList(data=data, total=total)

    def get_by_id(self, ingrediente_id: int) -> IngredientePublic:
        """Obtener ingrediente por ID."""
        with CatalogUnitOfWork(self._session) as uow:
            ingrediente = uow.ingredientes.get_by_id(ingrediente_id)
            if ingrediente is None or not self._is_active(ingrediente):
                raise HTTPException(status_code=404, detail="Ingrediente no encontrado")
            result = IngredientePublic.model_validate(ingrediente)
        return result

    def get_detail(self, ingrediente_id: int) -> IngredienteDetail:
        """Obtener detalle de ingrediente con productos relacionados."""
        with CatalogUnitOfWork(self._session) as uow:
            ingrediente = uow.ingredientes.get_by_id(ingrediente_id)
            if ingrediente is None:
                raise HTTPException(status_code=404, detail="Ingrediente no encontrado")

            productos_relacionados = [
                IngredienteProductoUso(
                    producto_id=relation.producto_id,
                    producto_nombre=relation.producto.nombre if relation.producto else f"Producto {relation.producto_id}",
                    cantidad=relation.cantidad,
                    unidad_medida_id=relation.unidad_medida_id,
                    unidad_simbolo=relation.unidad_medida.simbolo if relation.unidad_medida else None,
                )
                for relation in ingrediente.productos_ingredientes
            ]

            result = IngredienteDetail(
                **IngredientePublic.model_validate(ingrediente).model_dump(),
                productos_relacionados=productos_relacionados,
            )

        return result

    async def update(self, ingrediente_id: int, data: IngredienteUpdate) -> IngredientePublic:
        """Actualizar ingrediente."""
        with CatalogUnitOfWork(self._session) as uow:
            ingrediente = uow.ingredientes.get_by_id(ingrediente_id)
            if ingrediente is None or not self._is_active(ingrediente):
                raise HTTPException(status_code=404, detail="Ingrediente no encontrado")

            if data.nombre and data.nombre != ingrediente.nombre:
                existing = uow.ingredientes.get_by_nombre(data.nombre)
                if existing is not None:
                    raise HTTPException(status_code=409, detail="Ingrediente con ese nombre ya existe")

            update_data = data.model_dump(exclude_unset=True)
            for key, value in update_data.items():
                setattr(ingrediente, key, value)

            ingrediente.updated_at = datetime.now(timezone.utc)
            uow.ingredientes.add(ingrediente)
            result = IngredientePublic.model_validate(ingrediente)

        stock_fields = {"stock_actual", "stock_minimo", "costo_unitario", "unidad"}
        if stock_fields & update_data.keys():
            await self._broadcast_event("INGREDIENTE_UPDATED", {"ingrediente_id": ingrediente_id, "data": result.model_dump()})
        return result

    def soft_delete(self, ingrediente_id: int) -> None:
        """Soft delete usando el campo activo."""
        with CatalogUnitOfWork(self._session) as uow:
            ingrediente = uow.ingredientes.get_by_id(ingrediente_id)
            if ingrediente is None or not self._is_active(ingrediente):
                raise HTTPException(status_code=404, detail="Ingrediente no encontrado")

            if uow.ingredientes.has_active_product_usage(ingrediente_id):
                raise HTTPException(
                    status_code=422,
                    detail="No se puede desactivar el ingrediente porque está asociado a productos activos",
                )

            now = datetime.now(timezone.utc)
            ingrediente.activo = False
            ingrediente.deleted_at = now
            ingrediente.updated_at = now
            uow.ingredientes.add(ingrediente)

    def restore(self, ingrediente_id: int) -> IngredientePublic:
        """Restaurar un ingrediente dado de baja."""
        with CatalogUnitOfWork(self._session) as uow:
            ingrediente = uow.ingredientes.get_by_id(ingrediente_id)
            if ingrediente is None or self._is_active(ingrediente):
                raise HTTPException(status_code=404, detail="Ingrediente no encontrado")

            ingrediente.activo = True
            ingrediente.deleted_at = None
            ingrediente.updated_at = datetime.now(timezone.utc)
            uow.ingredientes.add(ingrediente)
            result = IngredientePublic.model_validate(ingrediente)

        return result
