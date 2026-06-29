from datetime import datetime, timezone
from decimal import Decimal
from math import floor
from typing import Any, Optional

from fastapi import HTTPException
from sqlmodel import Session

from app.core.websocket import manager
from app.modules.categorias.models import Categoria
from app.modules.ingredientes.models import UnidadMedida
from app.modules.productos.models import Producto
from app.modules.catalogo.unit_of_work import CatalogUnitOfWork
from app.modules.productos.schemas import (
    ProductoCreate,
    ProductoIngredienteSchema,
    ProductoList,
    ProductoPublic,
    ProductoUpdate,
)


class ProductoService:
    """
    Servicio de negocio para Producto.
    Usa CatalogUnitOfWork para transacciones atómicas.
    Maneja relaciones N:M con Categoria e Ingrediente.
    """

    def __init__(self, session: Session) -> None:
        self._session = session

    def _is_active_product(self, producto: Producto) -> bool:
        return bool(producto.activo) and producto.deleted_at is None

    async def _broadcast_event(self, event_type: str, data: dict[str, Any]) -> None:
        await manager.broadcast(event_type, data)

    def _is_active_category(self, categoria) -> bool:
        return categoria is not None and bool(categoria.activo) and categoria.deleted_at is None

    def _is_active_ingredient(self, ingrediente) -> bool:
        return ingrediente is not None and bool(ingrediente.activo) and ingrediente.deleted_at is None

    def _get_principal_category(self, producto: Producto):
        categoria_relation = None
        for relation in producto.productos_categorias:
            if relation.es_principal:
                categoria_relation = relation
                break
        if categoria_relation is None and producto.productos_categorias:
            categoria_relation = producto.productos_categorias[0]
        return categoria_relation

    def _compute_metrics(
        self, producto: Producto
    ) -> tuple[Optional[int], Decimal, Decimal, Decimal, Optional[str], Optional[int]]:
        categoria_relation = self._get_principal_category(producto)
        categoria_id = categoria_relation.categoria_id if categoria_relation is not None else None
        categoria_nombre = None
        if categoria_relation is not None and categoria_relation.categoria is not None:
            categoria_nombre = categoria_relation.categoria.nombre

        ingredientes_relaciones = list(producto.productos_ingredientes)
        costo_total = Decimal("0")
        stock_disponible: int | None = None

        if producto.usa_stock_manual:
            stock_disponible = producto.stock_manual
            if producto.costo_compra_manual is not None:
                costo_total = Decimal(str(producto.costo_compra_manual))
        elif ingredientes_relaciones:
            candidatos: list[int] = []
            for relation in ingredientes_relaciones:
                ingrediente = relation.ingrediente
                if ingrediente is None:
                    continue
                cantidad = Decimal(str(relation.cantidad))
                costo_total += cantidad * Decimal(str(ingrediente.costo_unitario))
                if relation.cantidad > 0:
                    candidatos.append(int(floor(float(ingrediente.stock_actual) / float(relation.cantidad))))
            if candidatos:
                stock_disponible = min(candidatos)
        elif producto.stock_manual is not None:
            stock_disponible = producto.stock_manual

        precio_sugerido = (costo_total * Decimal("1.5")).quantize(Decimal("0.0001"))
        margen_estimado = (precio_sugerido - costo_total).quantize(Decimal("0.0001"))
        return categoria_id, costo_total, precio_sugerido, margen_estimado, categoria_nombre, stock_disponible

    def _to_public(self, producto: Producto) -> ProductoPublic:
        """Convertir modelo a DTO Public (incluye ingredientes con cantidad y unidad)."""
        categoria_id, costo_total, precio_sugerido, margen_estimado, categoria_nombre, stock_disponible = self._compute_metrics(producto)

        ingredientes = [
            ProductoIngredienteSchema(
                ingrediente_id=item.ingrediente_id,
                cantidad=item.cantidad,
                unidad_medida_id=item.unidad_medida_id,
                unidad_simbolo=item.unidad_medida.simbolo if item.unidad_medida else None,
                es_removible=item.es_removible,
                es_opcional=item.es_opcional,
            )
            for item in producto.productos_ingredientes
        ]
        return ProductoPublic(
            id=producto.id,
            nombre=producto.nombre,
            descripcion=producto.descripcion,
            precio_base=producto.precio_base,
            imagenes_url=producto.imagenes_url,
            tiempo_prep_min=producto.tiempo_prep_min,
            disponible=producto.disponible,
            usa_stock_manual=producto.usa_stock_manual,
            stock_manual=producto.stock_manual,
            costo_compra_manual=producto.costo_compra_manual,
            categoria_id=categoria_id,
            categoria_nombre=categoria_nombre,
            ingredientes=ingredientes,
            stock_disponible=stock_disponible,
            costo_total_ingredientes=costo_total,
            precio_sugerido=precio_sugerido,
            margen_estimado=margen_estimado,
            activo=producto.activo,
            deleted_at=producto.deleted_at,
        )

    def _validate_categoria(self, uow: CatalogUnitOfWork, categoria_id: int) -> None:
        categoria = uow.categorias.get_by_id(categoria_id)
        if categoria is None or not self._is_active_category(categoria):
            raise HTTPException(status_code=422, detail=f"Categoria con ID {categoria_id} no existe o está inactiva")

    def _validate_ingredientes(self, uow: CatalogUnitOfWork, ingredientes: list[ProductoIngredienteSchema]) -> None:
        seen_ids: set[int] = set()
        for ing in ingredientes:
            if ing.ingrediente_id in seen_ids:
                raise HTTPException(status_code=422, detail="No se permiten ingredientes repetidos en el producto")
            seen_ids.add(ing.ingrediente_id)

            ingrediente = uow.ingredientes.get_by_id(ing.ingrediente_id)
            if ingrediente is None or not self._is_active_ingredient(ingrediente):
                raise HTTPException(
                    status_code=422,
                    detail=f"Ingrediente con ID {ing.ingrediente_id} no existe o está inactivo",
                )

            if uow._session.get(UnidadMedida, ing.unidad_medida_id) is None:
                raise HTTPException(
                    status_code=422,
                    detail=f"La unidad de medida con ID {ing.unidad_medida_id} no existe",
                )

    def _validate_stock_mode(self, data: ProductoCreate | ProductoUpdate, current: Producto | None = None) -> None:
        usa_stock_manual = data.usa_stock_manual if data.usa_stock_manual is not None else (current.usa_stock_manual if current is not None else False)
        stock_manual = data.stock_manual if data.stock_manual is not None else (current.stock_manual if current is not None else None)

        if usa_stock_manual and stock_manual is None:
            raise HTTPException(
                status_code=422,
                detail="Si usa_stock_manual es true, debes informar stock_manual",
            )

        if usa_stock_manual and data.ingredientes is not None and len(data.ingredientes) > 0:
            raise HTTPException(
                status_code=422,
                detail="Un producto con usa_stock_manual=true no debe definir ingredientes",
            )

    async def create(self, data: ProductoCreate) -> ProductoPublic:
        """Crear nuevo producto con ingredientes."""
        with CatalogUnitOfWork(self._session) as uow:
            existing = uow.productos.get_by_nombre(data.nombre)
            if existing is not None:
                raise HTTPException(status_code=409, detail="Producto con ese nombre ya existe")

            self._validate_stock_mode(data)

            if data.categoria_id is not None:
                self._validate_categoria(uow, data.categoria_id)

            if data.ingredientes:
                self._validate_ingredientes(uow, data.ingredientes)

            payload = data.model_dump(exclude={"ingredientes", "categoria_id"})
            producto = Producto(**payload)

            uow.productos.add(producto)

            if data.categoria_id is not None:
                uow.productos.set_categoria_principal(producto.id, data.categoria_id)

            ingredientes_data = [ing.model_dump() for ing in data.ingredientes]
            uow.productos.set_ingredientes(producto.id, ingredientes_data)

            uow._session.flush()
            uow._session.refresh(producto)
            result = self._to_public(producto)

        await self._broadcast_event("PRODUCTO_UPDATED", {"producto_id": producto.id, "data": result.model_dump()})
        return result

    def _collect_category_ids(self, categoria_id: int, categorias_repo) -> list[int]:
        """Recolecta el ID de la categoría y todos sus descendientes recursivamente."""
        categoria = categorias_repo.get_by_id(categoria_id)
        if categoria is None:
            return [categoria_id]
        ids = [categoria.id]
        for sub in categoria.subcategorias:
            ids.extend(self._collect_category_ids(sub.id, categorias_repo))
        return ids

    def get_public(
        self,
        offset: int = 0,
        limit: int = 20,
        categoria_id: int | None = None,
        q: str | None = None,
    ) -> ProductoList:
        """Obtener solo productos activos y no eliminados (disponibles o no, para público)."""
        with CatalogUnitOfWork(self._session) as uow:
            items = uow.productos.get_disponibles(offset=0, limit=10000)
            if categoria_id is not None:
                ids = self._collect_category_ids(categoria_id, uow.categorias)
                items = [
                    item
                    for item in items
                    if any(rel.categoria_id in ids for rel in item.productos_categorias)
                ]
            if q:
                q_lower = q.strip().lower()
                if q_lower:
                    items = [
                        item
                        for item in items
                        if q_lower in item.nombre.lower()
                        or (item.descripcion is not None and q_lower in item.descripcion.lower())
                    ]
            total = len(items)
            items = items[offset : offset + limit]
            data = [self._to_public(item) for item in items]
        return ProductoList(data=data, total=total)

    def get_all(
        self,
        offset: int = 0,
        limit: int = 20,
        include_deleted: bool = False,
        categoria_id: int | None = None,
        disponible: bool | None = None,
        q: str | None = None,
    ) -> ProductoList:
        """Obtener todos los productos (opcionalmente incluyendo inactivos)."""
        with CatalogUnitOfWork(self._session) as uow:
            if include_deleted:
                items = uow.productos.get_all_paginated(offset=offset, limit=limit)
                total = uow.productos.count_all()
            else:
                items = uow.productos.get_active_paginated(offset=0, limit=10000)
                if categoria_id is not None:
                    ids = self._collect_category_ids(categoria_id, uow.categorias)
                    items = [
                        item
                        for item in items
                        if any(rel.categoria_id in ids for rel in item.productos_categorias)
                    ]
                if disponible is not None:
                    items = [item for item in items if item.disponible is disponible]
                if q:
                    q_lower = q.strip().lower()
                    if q_lower:
                        items = [
                            item
                            for item in items
                            if q_lower in item.nombre.lower()
                            or (item.descripcion is not None and q_lower in item.descripcion.lower())
                        ]

                total = len(items)
                items = items[offset : offset + limit]

            data = [self._to_public(item) for item in items]
        return ProductoList(data=data, total=total)

    async def update_disponibilidad(self, producto_id: int, disponible: bool) -> ProductoPublic:
        with CatalogUnitOfWork(self._session) as uow:
            producto = uow.productos.get_by_id(producto_id)
            if producto is None or not self._is_active_product(producto):
                raise HTTPException(status_code=404, detail="Producto no encontrado")

            if disponible:
                stock_disponible = self._compute_metrics(producto)[5]
                tiene_stock = stock_disponible is not None and stock_disponible > 0
                if not tiene_stock:
                    raise HTTPException(
                        status_code=400,
                        detail="Stock es 0, no se puede clasificar como Disponible.",
                    )

            producto.disponible = disponible
            producto.updated_at = datetime.now(timezone.utc)
            uow.productos.add(producto)
            result = self._to_public(producto)

        await self._broadcast_event("PRODUCTO_UPDATED", {"producto_id": producto_id, "data": result.model_dump()})
        return result

    async def update_stock_manual(self, producto_id: int, stock_cantidad: int) -> ProductoPublic:
        with CatalogUnitOfWork(self._session) as uow:
            producto = uow.productos.get_by_id(producto_id)
            if producto is None or not self._is_active_product(producto):
                raise HTTPException(status_code=404, detail="Producto no encontrado")

            if not producto.usa_stock_manual:
                producto.usa_stock_manual = True

            producto.stock_manual = stock_cantidad
            producto.disponible = stock_cantidad > 0
            producto.updated_at = datetime.now(timezone.utc)
            uow.productos.add(producto)
            result = self._to_public(producto)

        await self._broadcast_event("PRODUCTO_UPDATED", {"producto_id": producto_id, "data": result.model_dump()})
        return result

    async def reservar_stock(self, producto_id: int, cantidad: int) -> ProductoPublic:
        """Reservar stock al agregar al carrito. Usa FOR UPDATE para evitar race conditions."""
        from sqlmodel import select as _select

        low_stock_ingredientes: list[dict] = []

        with CatalogUnitOfWork(self._session) as uow:
            stmt = _select(Producto).where(
                Producto.id == producto_id,
                Producto.deleted_at.is_(None),
                Producto.activo.is_(True),
            ).with_for_update()
            producto = uow._session.exec(stmt).first()
            if producto is None:
                raise HTTPException(status_code=404, detail="Producto no encontrado")

            if not producto.disponible:
                raise HTTPException(status_code=400, detail=f"Producto {producto.nombre} no disponible")

            if producto.usa_stock_manual:
                if producto.stock_manual is None or producto.stock_manual < cantidad:
                    raise HTTPException(status_code=400, detail=f"Stock insuficiente de {producto.nombre} ¡fijate si te gusta otra cosa en el menú!")
                producto.stock_manual -= cantidad
                producto.disponible = producto.stock_manual > 0
            else:
                pi_list = list(producto.productos_ingredientes)
                if pi_list:
                    ing_ids = [pi.ingrediente_id for pi in pi_list if pi.ingrediente_id]
                    from app.modules.ingredientes.models import Ingrediente
                    from sqlmodel import select as _sel2
                    ing_stmt = _sel2(Ingrediente).where(Ingrediente.id.in_(ing_ids)).with_for_update()
                    ingredientes_lockeados = {i.id: i for i in uow._session.exec(ing_stmt).all()}
                    for pi in pi_list:
                        ing = ingredientes_lockeados.get(pi.ingrediente_id)
                        if ing is None:
                            continue
                        delta = float(pi.cantidad) * cantidad
                        if ing.stock_actual - delta < 0:
                            raise HTTPException(
                                status_code=400,
                                detail=f"Stock insuficiente de {producto.nombre} ¡fijate si te gusta otra cosa en el menú!",
                            )
                        ing.stock_actual -= delta
                        uow._session.add(ing)
                        if ing.stock_actual < ing.stock_minimo:
                            low_stock_ingredientes.append({
                                "ingrediente_id": ing.id,
                                "nombre": ing.nombre,
                                "stock_actual": ing.stock_actual,
                                "stock_minimo": ing.stock_minimo,
                            })

            producto.updated_at = datetime.now(timezone.utc)
            uow._session.add(producto)
            uow._session.flush()
            uow._session.refresh(producto)
            result = self._to_public(producto)

        await self._broadcast_event("PRODUCTO_UPDATED", {"producto_id": producto_id, "data": result.model_dump()})

        for alert in low_stock_ingredientes:
            await self._broadcast_event("LOW_STOCK", alert)

        return result

    async def liberar_stock(self, producto_id: int, cantidad: int) -> ProductoPublic:
        """Liberar stock al eliminar producto del carrito. Espejo de reservar_stock."""
        from sqlmodel import select as _select

        with CatalogUnitOfWork(self._session) as uow:
            stmt = _select(Producto).where(
                Producto.id == producto_id,
                Producto.deleted_at.is_(None),
                Producto.activo.is_(True),
            ).with_for_update()
            producto = uow._session.exec(stmt).first()
            if producto is None:
                raise HTTPException(status_code=404, detail="Producto no encontrado")

            if producto.usa_stock_manual:
                if producto.stock_manual is not None:
                    producto.stock_manual += cantidad
                else:
                    producto.stock_manual = cantidad
                producto.disponible = True
            else:
                pi_list = list(producto.productos_ingredientes)
                if pi_list:
                    ing_ids = [pi.ingrediente_id for pi in pi_list if pi.ingrediente_id]
                    from app.modules.ingredientes.models import Ingrediente
                    from sqlmodel import select as _sel2
                    ing_stmt = _sel2(Ingrediente).where(Ingrediente.id.in_(ing_ids)).with_for_update()
                    ingredientes_lockeados = {i.id: i for i in uow._session.exec(ing_stmt).all()}
                    for pi in pi_list:
                        ing = ingredientes_lockeados.get(pi.ingrediente_id)
                        if ing is None:
                            continue
                        delta = float(pi.cantidad) * cantidad
                        ing.stock_actual += delta
                        uow._session.add(ing)

            producto.updated_at = datetime.now(timezone.utc)
            uow._session.add(producto)
            uow._session.flush()
            uow._session.refresh(producto)
            result = self._to_public(producto)

        await self._broadcast_event("PRODUCTO_UPDATED", {"producto_id": producto_id, "data": result.model_dump()})
        return result

    def get_by_id(self, producto_id: int) -> ProductoPublic:
        """Obtener producto por ID."""
        with CatalogUnitOfWork(self._session) as uow:
            producto = uow.productos.get_by_id(producto_id)
            if producto is None or not self._is_active_product(producto):
                raise HTTPException(status_code=404, detail="Producto no encontrado")
            result = self._to_public(producto)
        return result

    async def update(self, producto_id: int, data: ProductoUpdate) -> ProductoPublic:
        """Actualizar producto."""
        with CatalogUnitOfWork(self._session) as uow:
            producto = uow.productos.get_by_id(producto_id)
            if producto is None or not self._is_active_product(producto):
                raise HTTPException(status_code=404, detail="Producto no encontrado")

            self._validate_stock_mode(data, current=producto)

            if data.nombre and data.nombre != producto.nombre:
                existing = uow.productos.get_by_nombre(data.nombre)
                if existing is not None:
                    raise HTTPException(status_code=409, detail="Producto con ese nombre ya existe")

            update_data = data.model_dump(exclude_unset=True, exclude={"ingredientes"})
            for key, value in update_data.items():
                if key == "categoria_id":
                    continue
                setattr(producto, key, value)

            if "categoria_id" in update_data:
                categoria_id = update_data["categoria_id"]
                if categoria_id is None:
                    uow.productos.clear_categoria_principal(producto.id)
                else:
                    self._validate_categoria(uow, categoria_id)
                    uow.productos.set_categoria_principal(producto.id, categoria_id)

            if data.ingredientes is not None:
                self._validate_ingredientes(uow, data.ingredientes)
                ingredientes_data = [ing.model_dump() for ing in data.ingredientes]
                uow.productos.set_ingredientes(producto.id, ingredientes_data)

            if producto.usa_stock_manual:
                uow.productos.set_ingredientes(producto.id, [])

            stock_disponible = self._compute_metrics(producto)[5]
            producto.disponible = stock_disponible is not None and stock_disponible > 0

            producto.updated_at = datetime.now(timezone.utc)
            uow.productos.add(producto)
            uow._session.flush()
            uow._session.refresh(producto)
            result = self._to_public(producto)

        await self._broadcast_event("PRODUCTO_UPDATED", {"producto_id": producto_id, "data": result.model_dump()})
        return result

    async def soft_delete(self, producto_id: int) -> None:
        """Soft delete usando el campo activo."""
        with CatalogUnitOfWork(self._session) as uow:
            producto = uow.productos.get_by_id(producto_id)
            if producto is None or not self._is_active_product(producto):
                raise HTTPException(status_code=404, detail="Producto no encontrado")

            now = datetime.now(timezone.utc)
            producto.activo = False
            producto.deleted_at = now
            producto.updated_at = now
            uow.productos.add(producto)

        await self._broadcast_event("PRODUCTO_UPDATED", {"producto_id": producto_id})

    async def restore(self, producto_id: int) -> ProductoPublic:
        """Restaurar un producto dado de baja."""
        with CatalogUnitOfWork(self._session) as uow:
            producto = uow.productos.get_by_id(producto_id)
            if producto is None or self._is_active_product(producto):
                raise HTTPException(status_code=404, detail="Producto no encontrado")

            categoria_relation = self._get_principal_category(producto)
            if categoria_relation is not None:
                self._validate_categoria(uow, categoria_relation.categoria_id)

            if producto.productos_ingredientes:
                self._validate_ingredientes(
                    uow,
                    [
                        ProductoIngredienteSchema(
                            ingrediente_id=item.ingrediente_id,
                            cantidad=item.cantidad,
                            unidad_medida_id=item.unidad_medida_id,
                            es_removible=item.es_removible,
                            es_opcional=item.es_opcional,
                        )
                        for item in producto.productos_ingredientes
                    ],
                )

            producto.activo = True
            producto.deleted_at = None
            producto.updated_at = datetime.now(timezone.utc)
            uow.productos.add(producto)
            result = self._to_public(producto)

        await self._broadcast_event("PRODUCTO_UPDATED", {"producto_id": producto_id, "data": result.model_dump()})
        return result
