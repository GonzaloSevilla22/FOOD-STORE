from decimal import Decimal

from sqlalchemy import text
from sqlmodel import Session, create_engine, select

from app.core.config import settings
from app.modules.categorias.models import Categoria
from app.modules.ingredientes.models import Ingrediente
from app.modules.productos.models import Producto
from app.modules.productos.models import UnidadEnum
from app.modules.categorias.schemas import CategoriaCreate, CategoriaUpdate
from app.modules.categorias.service import CategoriaService
from app.modules.ingredientes.schemas import IngredienteCreate, IngredienteUpdate
from app.modules.ingredientes.service import IngredienteService
from app.modules.productos.schemas import ProductoCreate, ProductoIngredienteSchema, ProductoUpdate
from app.modules.productos.service import ProductoService


def cleanup_soft_deleted(engine) -> None:
    with engine.begin() as connection:
        connection.execute(
            text(
                "DELETE FROM productos_ingredientes "
                "WHERE producto_id IN (SELECT id FROM productos WHERE deleted_at IS NOT NULL) "
                "OR ingrediente_id IN (SELECT id FROM ingredientes WHERE deleted_at IS NOT NULL)"
            )
        )
        connection.execute(
            text(
                "DELETE FROM productos_categorias "
                "WHERE producto_id IN (SELECT id FROM productos WHERE deleted_at IS NOT NULL) "
                "OR categoria_id IN (SELECT id FROM categorias WHERE deleted_at IS NOT NULL)"
            )
        )
        connection.execute(text("DELETE FROM productos WHERE deleted_at IS NOT NULL"))
        connection.execute(text("DELETE FROM categorias WHERE deleted_at IS NOT NULL"))
        connection.execute(text("DELETE FROM ingredientes WHERE deleted_at IS NOT NULL"))


def get_by_name(session: Session, model, name: str):
    return session.exec(select(model).where(model.nombre == name)).first()


def upsert_categoria(service: CategoriaService, session: Session, nombre: str, descripcion: str, orden: int, parent_id: int | None) -> Categoria:
    existing = get_by_name(session, Categoria, nombre)
    payload = CategoriaCreate(nombre=nombre, descripcion=descripcion, orden_display=orden, parent_id=parent_id)
    if existing is None:
        created = service.create(payload)
        return session.get(Categoria, created.id)

    if existing.deleted_at is not None or not existing.activo:
        service.restore(existing.id)
    updated = service.update(existing.id, payload)
    return session.get(Categoria, updated.id)


def upsert_ingrediente(service: IngredienteService, session: Session, nombre: str, descripcion: str, es_alergeno: bool, stock_actual: float, stock_minimo: float, costo_unitario: Decimal, unidad_medida: UnidadEnum) -> Ingrediente:
    existing = get_by_name(session, Ingrediente, nombre)
    payload = IngredienteCreate(
        nombre=nombre,
        descripcion=descripcion,
        es_alergeno=es_alergeno,
        stock_actual=stock_actual,
        stock_minimo=stock_minimo,
        costo_unitario=costo_unitario,
        unidad_medida=unidad_medida,
    )
    if existing is None:
        created = service.create(payload)
        return session.get(Ingrediente, created.id)

    if existing.deleted_at is not None or not existing.activo:
        service.restore(existing.id)
    updated = service.update(existing.id, IngredienteUpdate(**payload.model_dump()))
    return session.get(Ingrediente, updated.id)


def upsert_producto(service: ProductoService, session: Session, nombre: str, descripcion: str, precio_base: Decimal, categoria_id: int | None, disponible: bool, usa_stock_manual: bool, stock_manual: int | None, costo_compra_manual: Decimal | None, ingredientes: list[ProductoIngredienteSchema]) -> Producto:
    existing = get_by_name(session, Producto, nombre)
    payload = ProductoCreate(
        nombre=nombre,
        descripcion=descripcion,
        precio_base=precio_base,
        imagenes_url=None,
        tiempo_prep_min=15 if ingredientes else 0,
        disponible=disponible,
        usa_stock_manual=usa_stock_manual,
        stock_manual=stock_manual,
        costo_compra_manual=costo_compra_manual,
        categoria_id=categoria_id,
        ingredientes=ingredientes,
    )
    if existing is None:
        created = service.create(payload)
        return session.get(Producto, created.id)

    if existing.deleted_at is not None or not existing.activo:
        service.restore(existing.id)
    updated = service.update(existing.id, ProductoUpdate(**payload.model_dump()))
    return session.get(Producto, updated.id)


def main() -> None:
    engine = create_engine(settings.DATABASE_URL, echo=False)
    cleanup_soft_deleted(engine)

    with Session(engine) as session:
        categoria_service = CategoriaService(session)
        ingrediente_service = IngredienteService(session)
        producto_service = ProductoService(session)

        pizzas_id = upsert_categoria(categoria_service, session, "Pizzas", "Categoría principal de pizzas", 1, None).id
        bebidas = upsert_categoria(categoria_service, session, "Bebidas", "Bebidas frías y sin alcohol", 2, None)
        especiales = upsert_categoria(categoria_service, session, "Pizzas especiales", "Pizzas con variantes especiales", 3, pizzas_id)
        tradicionales = upsert_categoria(categoria_service, session, "Pizzas tradicionales", "Recetas clásicas", 4, pizzas_id)

        queso = upsert_ingrediente(
            ingrediente_service,
            session,
            "Queso Mozzarella",
            "Queso base para pizzas",
            False,
            5200,
            1000,
            Decimal("0.0200"),
            UnidadEnum.GRAMOS,
        )
        jamon = upsert_ingrediente(
            ingrediente_service,
            session,
            "Jamon Cocido",
            "Jamon cocido feteado",
            False,
            3000,
            500,
            Decimal("0.0350"),
            UnidadEnum.GRAMOS,
        )
        salsa = upsert_ingrediente(
            ingrediente_service,
            session,
            "Salsa de Tomate",
            "Salsa base para pizzas",
            False,
            4800,
            800,
            Decimal("0.0065"),
            UnidadEnum.GRAMOS,
        )
        masa = upsert_ingrediente(
            ingrediente_service,
            session,
            "Masa de Pizza",
            "Masa para pre-pizzas y pizzas",
            False,
            2500,
            500,
            Decimal("0.0040"),
            UnidadEnum.GRAMOS,
        )
        agua = upsert_ingrediente(
            ingrediente_service,
            session,
            "Agua Carbonatada",
            "Base para bebidas",
            False,
            10000,
            2000,
            Decimal("0.0010"),
            UnidadEnum.MILILITROS,
        )

        upsert_producto(
            producto_service,
            session,
            "Pizza Muzzarella",
            "Pizza clasica con queso y salsa",
            Decimal("7500"),
            tradicionales.id,
            True,
            False,
            None,
            None,
            [
                ProductoIngredienteSchema(ingrediente_id=masa.id, cantidad=300, unidad=UnidadEnum.GRAMOS, es_removible=False, es_opcional=False),
                ProductoIngredienteSchema(ingrediente_id=salsa.id, cantidad=120, unidad=UnidadEnum.GRAMOS, es_removible=True, es_opcional=False),
                ProductoIngredienteSchema(ingrediente_id=queso.id, cantidad=250, unidad=UnidadEnum.GRAMOS, es_removible=True, es_opcional=False),
            ],
        )

        upsert_producto(
            producto_service,
            session,
            "Pizza Jamon y Queso",
            "Pizza clasica con jamon y mozzarella",
            Decimal("8200"),
            especiales.id,
            True,
            False,
            None,
            None,
            [
                ProductoIngredienteSchema(ingrediente_id=masa.id, cantidad=300, unidad=UnidadEnum.GRAMOS, es_removible=False, es_opcional=False),
                ProductoIngredienteSchema(ingrediente_id=salsa.id, cantidad=100, unidad=UnidadEnum.GRAMOS, es_removible=True, es_opcional=False),
                ProductoIngredienteSchema(ingrediente_id=queso.id, cantidad=220, unidad=UnidadEnum.GRAMOS, es_removible=True, es_opcional=False),
                ProductoIngredienteSchema(ingrediente_id=jamon.id, cantidad=120, unidad=UnidadEnum.GRAMOS, es_removible=True, es_opcional=True),
            ],
        )

        upsert_producto(
            producto_service,
            session,
            "Coca Cola",
            "Bebida sin ingredientes, con stock manual",
            Decimal("1800"),
            bebidas.id,
            True,
            True,
            48,
            Decimal("980.00"),
            [],
        )

        upsert_producto(
            producto_service,
            session,
            "Agua Mineral",
            "Producto manual para ventas externas",
            Decimal("1200"),
            bebidas.id,
            True,
            True,
            96,
            Decimal("450.00"),
            [],
        )

    print("Seed completado: categorias, ingredientes y productos actualizados.")


if __name__ == "__main__":
    main()
