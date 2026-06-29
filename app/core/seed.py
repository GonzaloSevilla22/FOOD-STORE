import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import text
from sqlmodel import Session, select

from app.core.database import engine
from app.core.rbac import ROLE_ADMIN, ROLE_CLIENT, ROLE_PEDIDOS, ROLE_STOCK
from app.core.security import hash_password
from app.modules.categorias.models import Categoria, ProductoCategoria
from app.modules.productos.models import Producto, ProductoIngrediente, UnidadEnum
from app.modules.ingredientes.models import Ingrediente, UnidadMedida
from app.modules.usuarios.models import Rol, Usuario, UsuarioRol
from app.modules.direcciones.models import DireccionEntrega
from app.modules.pedidos.models import (
    DetallePedido,
    EstadoPedido,
    FormaPago,
    HistorialEstadoPedido,
    Pedido,
)
from app.modules.payments.models import Pago


def initialize_roles_and_states() -> None:
    """Inicializar roles, estados de pedido y datos de ejemplo si no existen."""
    session = Session(engine)

    try:
        _migrate_legacy_roles(session)
        _create_roles(session)
        _create_estados_pedido(session)
        _create_formas_pago(session)
        _create_unidades_medida(session)
        _migrate_legacy_states(session)
        # Migrar bases viejas a los códigos v7 (5 estados de la consigna §3.4)
        _migrate_old_state(session, "PAGADO", "CONFIRMADO")
        _migrate_old_state(session, "EN_PREPARACION", "EN_PREP")
        _migrate_old_state(session, "TERMINADO", "ENTREGADO")
        _migrate_old_state(session, "PREPARANDO", "EN_PREP")
        _migrate_old_state(session, "EN_CAMINO", "EN_PREP")
        _ensure_admin_user(session)
        _ensure_cliente_user(session)
        _ensure_stock_user(session)
        _ensure_pedidos_user(session)
        _ensure_default_role_for_all(session)
        _cleanup_legacy_client_role(session)
        _seed_example_data(session)
        _seed_extra_catalog(session)
        _seed_ventas_data(session)
        session.commit()
    except Exception as e:
        session.rollback()
        print(f"Error initializing roles and states: {e}")
    finally:
        session.close()


def _migrate_legacy_roles(session: Session) -> None:
    legacy_cliente = session.exec(select(Rol).where(Rol.codigo == "CLIENTE")).first()
    client_role = session.exec(select(Rol).where(Rol.codigo == ROLE_CLIENT)).first()
    if legacy_cliente and client_role is None:
        session.execute(
            text("UPDATE roles SET nombre = 'Cliente Legacy' WHERE codigo = 'CLIENTE'")
        )
        session.add(
            Rol(codigo=ROLE_CLIENT, nombre="Cliente", descripcion="Usuario cliente de la tienda")
        )
        session.flush()
        session.execute(
            text("UPDATE usuarios_roles SET rol_codigo = 'CLIENT' WHERE rol_codigo = 'CLIENTE'")
        )
        session.flush()


def _create_roles(session: Session) -> None:
    roles = [
        (ROLE_ADMIN, "Administrador", "Acceso total al sistema"),
        (ROLE_STOCK, "Stock", "Gestión de stock y disponibilidad"),
        (ROLE_PEDIDOS, "Pedidos", "Gestión operativa de pedidos"),
        (ROLE_CLIENT, "Cliente", "Usuario cliente de la tienda"),
    ]
    for codigo, nombre, descripcion in roles:
        existing = session.exec(select(Rol).where(Rol.codigo == codigo)).first()
        if not existing:
            session.add(Rol(codigo=codigo, nombre=nombre, descripcion=descripcion))


def _create_estados_pedido(session: Session) -> None:
    # FSM v8 — 7 estados.
    estados = [
        ("PENDIENTE", "Pendiente", "Pedido creado, pago pendiente", False),
        ("CONFIRMADO", "Confirmado", "Pago procesado y confirmado", False),
        ("EN_PREP", "En Preparación", "En preparación en cocina", False),
        ("A_ENTREGAR", "A Entregar", "Listo para entregar", False),
        ("ESPERANDO_CLIENTE", "Esperando Cliente", "Esperando que el cliente acepte la entrega", False),
        ("ENTREGADO", "Entregado", "Entrega confirmada", True),
        ("CANCELADO", "Cancelado", "Pedido cancelado", True),
    ]
    for codigo, nombre, descripcion, es_terminal in estados:
        existing = session.exec(select(EstadoPedido).where(EstadoPedido.codigo == codigo)).first()
        if not existing:
            session.add(
                EstadoPedido(
                    codigo=codigo,
                    nombre=nombre,
                    descripcion=descripcion,
                    es_terminal=es_terminal,
                )
            )


def _create_formas_pago(session: Session) -> None:
    formas = [
        ("MERCADOPAGO", "MercadoPago", "Pago con MercadoPago"),
        ("EFECTIVO", "Efectivo", "Pago en efectivo"),
        ("TRANSFERENCIA", "Transferencia", "Pago por transferencia"),
    ]
    for codigo, nombre, descripcion in formas:
        existing = session.exec(
            select(FormaPago).where(FormaPago.codigo == codigo)
        ).first()
        if not existing:
            session.add(FormaPago(codigo=codigo, nombre=nombre, descripcion=descripcion))


def _create_unidades_medida(session: Session) -> None:
    # Unidades de medida obligatorias (consigna §14.2).
    unidades = [
        ("Kilogramo", "kg", "peso"),
        ("Gramo", "g", "peso"),
        ("Litro", "L", "volumen"),
        ("Mililitro", "ml", "volumen"),
        ("Unidad", "ud", "contable"),
        ("Porción", "porciones", "contable"),
    ]
    for nombre, simbolo, tipo in unidades:
        existing = session.exec(
            select(UnidadMedida).where(UnidadMedida.nombre == nombre)
        ).first()
        if not existing:
            session.add(UnidadMedida(nombre=nombre, simbolo=simbolo, tipo=tipo))


def _ensure_consigna_admin_user(session: Session) -> None:
    # Usuario admin de la consigna §14.2: admin@foodstore.com / Admin1234!
    _ensure_user(
        session,
        "admin@foodstore.com",
        "Admin",
        "FoodStore",
        "0000000000",
        "Admin1234!",
        ROLE_ADMIN,
    )


def seed_required_data(session: Session) -> None:
    """Carga los datos obligatorios de la consigna §14.2 (idempotente).

    Roles, estados de pedido (con es_terminal), formas de pago, unidades de
    medida y el usuario admin. Usado por `python -m app.db.seed`.
    """
    _create_roles(session)
    _create_estados_pedido(session)
    _create_formas_pago(session)
    _create_unidades_medida(session)
    _ensure_consigna_admin_user(session)
    session.commit()


def _migrate_old_state(session: Session, old_codigo: str, new_codigo: str) -> None:
    estado = session.exec(
        select(EstadoPedido).where(EstadoPedido.codigo == old_codigo)
    ).first()
    if estado:
        session.execute(
            text(
                "UPDATE pedidos SET estado_codigo = :new WHERE estado_codigo = :old"
            ).bindparams(new=new_codigo, old=old_codigo)
        )
        session.execute(
            text(
                "UPDATE historiales_estado_pedido SET estado_desde_codigo = :new WHERE estado_desde_codigo = :old"
            ).bindparams(new=new_codigo, old=old_codigo)
        )
        session.execute(
            text(
                "UPDATE historiales_estado_pedido SET estado_hacia_codigo = :new WHERE estado_hacia_codigo = :old"
            ).bindparams(new=new_codigo, old=old_codigo)
        )
        session.delete(estado)


def _migrate_legacy_states(session: Session) -> None:
    pass


def _ensure_user(
    session: Session,
    email: str,
    nombre: str,
    apellido: str,
    celular: str,
    password: str,
    rol_codigo: str,
) -> None:
    user = session.exec(
        select(Usuario).where(
            Usuario.email == email,
            Usuario.deleted_at.is_(None),
        )
    ).first()
    if not user:
        user = Usuario(
            nombre=nombre,
            apellido=apellido,
            email=email,
            celular=celular,
            password_hash=hash_password(password),
            activo=True,
        )
        session.add(user)
        session.flush()
    role_link = session.exec(
        select(UsuarioRol).where(
            UsuarioRol.usuario_id == user.id,
            UsuarioRol.rol_codigo == rol_codigo,
        )
    ).first()
    if not role_link:
        session.add(UsuarioRol(usuario_id=user.id, rol_codigo=rol_codigo))


def _ensure_admin_user(session: Session) -> None:
    _ensure_user(session, "admin@test.com", "Admin", "Test", "3333333333", "admin123", ROLE_ADMIN)


def _ensure_cliente_user(session: Session) -> None:
    _ensure_user(
        session, "cliente@test.com", "Cliente", "Test", "4444444444", "cliente123", ROLE_CLIENT
    )


def _ensure_stock_user(session: Session) -> None:
    _ensure_user(session, "stock@test.com", "Stock", "Test", "1111111111", "stock123", ROLE_STOCK)


def _ensure_pedidos_user(session: Session) -> None:
    _ensure_user(
        session, "pedidos@test.com", "Pedidos", "Test", "2222222222", "pedidos123", ROLE_PEDIDOS
    )


def _ensure_default_role_for_all(session: Session) -> None:
    usuarios = session.exec(
        select(Usuario).where(
            Usuario.deleted_at.is_(None),
            Usuario.activo.is_(True),
        )
    ).all()
    for usuario in usuarios:
        has_any_role = session.exec(
            select(UsuarioRol).where(UsuarioRol.usuario_id == usuario.id)
        ).first()
        if not has_any_role:
            session.add(UsuarioRol(usuario_id=usuario.id, rol_codigo=ROLE_CLIENT))


def _cleanup_legacy_client_role(session: Session) -> None:
    legacy_links = session.exec(
        select(UsuarioRol).where(UsuarioRol.rol_codigo == "CLIENTE")
    ).all()
    for legacy_link in legacy_links:
        session.delete(legacy_link)
        existing_client = session.exec(
            select(UsuarioRol).where(
                UsuarioRol.usuario_id == legacy_link.usuario_id,
                UsuarioRol.rol_codigo == ROLE_CLIENT,
            )
        ).first()
        if not existing_client:
            session.add(
                UsuarioRol(usuario_id=legacy_link.usuario_id, rol_codigo=ROLE_CLIENT)
            )
    legacy_cliente = session.exec(select(Rol).where(Rol.codigo == "CLIENTE")).first()
    if legacy_cliente:
        session.delete(legacy_cliente)


def _seed_example_data(session: Session) -> None:
    categorias_existentes = session.exec(select(Categoria).limit(1)).first()
    if categorias_existentes:
        return

    cat_pizzas = Categoria(
        nombre="Pizzas", descripcion="Pizzas clásicas y especiales", orden_display=1
    )
    cat_bebidas = Categoria(
        nombre="Bebidas", descripcion="Gaseosas, aguas y más", orden_display=2
    )
    cat_adicionales = Categoria(
        nombre="Adicionales", descripcion="Porciones, fainá, etc.", orden_display=3
    )
    session.add_all([cat_pizzas, cat_bebidas, cat_adicionales])
    session.flush()

    prod_muzza = Producto(
        nombre="Muzza",
        descripcion="Pizza de mozzarella",
        precio_base=Decimal("1500"),
        stock_manual=50,
        disponible=True,
        usa_stock_manual=True,
    )
    prod_napo = Producto(
        nombre="Napolitana",
        descripcion="Pizza napolitana con rodajas de tomate",
        precio_base=Decimal("1800"),
        stock_manual=40,
        disponible=True,
        usa_stock_manual=True,
    )
    prod_faina = Producto(
        nombre="Fainá",
        descripcion="Porción de fainá",
        precio_base=Decimal("500"),
        stock_manual=60,
        disponible=True,
        usa_stock_manual=True,
    )
    prod_coca = Producto(
        nombre="Coca Cola 1.5L",
        descripcion="Gaseosa Coca Cola 1.5 litros",
        precio_base=Decimal("1200"),
        stock_manual=100,
        disponible=True,
        usa_stock_manual=True,
    )
    prod_agua = Producto(
        nombre="Agua mineral 500ml",
        descripcion="Agua mineral sin gas",
        precio_base=Decimal("400"),
        stock_manual=100,
        disponible=True,
        usa_stock_manual=True,
    )
    session.add_all([prod_muzza, prod_napo, prod_faina, prod_coca, prod_agua])
    session.flush()

    session.add(
        ProductoCategoria(
            producto_id=prod_muzza.id, categoria_id=cat_pizzas.id, es_principal=True
        )
    )
    session.add(
        ProductoCategoria(
            producto_id=prod_napo.id, categoria_id=cat_pizzas.id, es_principal=True
        )
    )
    session.add(
        ProductoCategoria(
            producto_id=prod_faina.id, categoria_id=cat_adicionales.id, es_principal=True
        )
    )
    session.add(
        ProductoCategoria(
            producto_id=prod_coca.id, categoria_id=cat_bebidas.id, es_principal=True
        )
    )
    session.add(
        ProductoCategoria(
            producto_id=prod_agua.id, categoria_id=cat_bebidas.id, es_principal=True
        )
    )

    ingrediente_muzza = Ingrediente(
        nombre="Mozzarella",
        descripcion="Queso mozzarella",
        es_alergeno=False,
        stock_actual=10,
        stock_minimo=2,
        costo_unitario=Decimal("200"),
        unidad_medida=UnidadEnum.GRAMOS,
    )
    ingrediente_aceite = Ingrediente(
        nombre="Aceite de oliva",
        descripcion="Aceite de oliva extra virgen",
        es_alergeno=False,
        stock_actual=5,
        stock_minimo=1,
        costo_unitario=Decimal("150"),
        unidad_medida=UnidadEnum.MILILITROS,
    )
    session.add_all([ingrediente_muzza, ingrediente_aceite])
    session.flush()

    # Unidades de medida por símbolo (las crea _create_unidades_medida).
    unidad_g = session.exec(select(UnidadMedida).where(UnidadMedida.simbolo == "g")).first()
    unidad_l = session.exec(select(UnidadMedida).where(UnidadMedida.simbolo == "L")).first()

    session.add(
        ProductoIngrediente(
            producto_id=prod_muzza.id,
            ingrediente_id=ingrediente_muzza.id,
            cantidad=Decimal("200.000"),
            unidad_medida_id=unidad_g.id,
            es_removible=False,
        )
    )
    session.add(
        ProductoIngrediente(
            producto_id=prod_napo.id,
            ingrediente_id=ingrediente_muzza.id,
            cantidad=Decimal("180.000"),
            unidad_medida_id=unidad_g.id,
            es_removible=False,
        )
    )
    session.add(
        ProductoIngrediente(
            producto_id=prod_napo.id,
            ingrediente_id=ingrediente_aceite.id,
            cantidad=Decimal("0.050"),
            unidad_medida_id=unidad_l.id,
            es_removible=True,
        )
    )


def _get_or_create_categoria(
    session: Session, nombre: str, descripcion: str, orden: int
) -> Categoria:
    """Devuelve la categoría por nombre; la crea si no existe (idempotente)."""
    cat = session.exec(select(Categoria).where(Categoria.nombre == nombre)).first()
    if not cat:
        cat = Categoria(nombre=nombre, descripcion=descripcion, orden_display=orden)
        session.add(cat)
        session.flush()
    return cat


# Catálogo de ingredientes (precio = costo_unitario, stock = stock_actual/minimo).
# nombre -> (descripcion, es_alergeno, stock_actual, stock_minimo, costo_unitario, unidad)
_INGREDIENTES_CATALOGO: dict[str, tuple[str, bool, int, int, str, "UnidadEnum"]] = {
    "Mozzarella": ("Queso mozzarella", True, 8000, 1000, "0.20", UnidadEnum.GRAMOS),
    "Salsa de tomate": ("Salsa de tomate natural", False, 6000, 800, "0.05", UnidadEnum.GRAMOS),
    "Masa de pizza": ("Masa de pizza artesanal", True, 80, 15, "350", UnidadEnum.UNIDADES),
    "Cebolla": ("Cebolla fresca", False, 200, 30, "200", UnidadEnum.UNIDADES),
    "Tomate": ("Tomate fresco", False, 200, 30, "250", UnidadEnum.UNIDADES),
    "Aceitunas": ("Aceitunas verdes", False, 3000, 400, "0.30", UnidadEnum.GRAMOS),
    "Jamón": ("Jamón cocido", False, 4000, 500, "0.40", UnidadEnum.GRAMOS),
    "Longaniza": ("Longaniza calabresa", False, 3000, 400, "0.60", UnidadEnum.GRAMOS),
    "Carne picada": ("Carne picada especial", False, 7000, 1000, "0.55", UnidadEnum.GRAMOS),
    "Bife de lomo": ("Bife de lomo", False, 6000, 800, "0.90", UnidadEnum.GRAMOS),
    "Milanesa de carne": ("Milanesa de carne empanada", True, 60, 12, "650", UnidadEnum.UNIDADES),
    "Suprema de pollo": ("Suprema de pollo empanada", True, 60, 12, "600", UnidadEnum.UNIDADES),
    "Pollo": ("Pechuga de pollo", False, 6000, 800, "0.45", UnidadEnum.GRAMOS),
    "Huevo": ("Huevo fresco", True, 200, 24, "120", UnidadEnum.UNIDADES),
    "Lechuga": ("Lechuga fresca", False, 150, 20, "300", UnidadEnum.UNIDADES),
    "Pan de hamburguesa": ("Pan de hamburguesa con sésamo", True, 300, 40, "180", UnidadEnum.UNIDADES),
    "Pan de lomo": ("Pan para lomo", True, 200, 30, "220", UnidadEnum.UNIDADES),
    "Cheddar": ("Queso cheddar", True, 5000, 600, "0.30", UnidadEnum.GRAMOS),
    "Papa": ("Papa para freír", False, 15000, 2000, "0.02", UnidadEnum.GRAMOS),
    "Provolone": ("Queso provolone", True, 3000, 400, "0.45", UnidadEnum.GRAMOS),
    "Fideos": ("Fideos secos", True, 8000, 1000, "0.04", UnidadEnum.GRAMOS),
    "Ñoquis": ("Ñoquis de papa", True, 6000, 800, "0.06", UnidadEnum.GRAMOS),
    "Ricota": ("Ricota fresca", True, 3000, 400, "0.22", UnidadEnum.GRAMOS),
    "Pan rallado": ("Pan rallado", True, 5000, 600, "0.03", UnidadEnum.GRAMOS),
    "Croutons": ("Croutons de pan", True, 2000, 300, "0.10", UnidadEnum.GRAMOS),
    "Dulce de leche": ("Dulce de leche repostero", True, 4000, 500, "0.25", UnidadEnum.GRAMOS),
    "Chocolate": ("Chocolate semiamargo", True, 3000, 400, "0.50", UnidadEnum.GRAMOS),
    "Helado de crema": ("Helado de crema", True, 5000, 800, "0.30", UnidadEnum.GRAMOS),
    "Harina": ("Harina 000", True, 12000, 1500, "0.03", UnidadEnum.GRAMOS),
    "Garbanzo": ("Harina de garbanzo", False, 4000, 500, "0.06", UnidadEnum.GRAMOS),
}


def _get_or_create_ingrediente(session: Session, nombre: str) -> Ingrediente:
    """Devuelve el ingrediente por nombre; lo crea con su precio/stock si no existe."""
    ing = session.exec(select(Ingrediente).where(Ingrediente.nombre == nombre)).first()
    if ing:
        return ing
    desc, alergeno, stock_a, stock_m, costo, unidad = _INGREDIENTES_CATALOGO[nombre]
    ing = Ingrediente(
        nombre=nombre,
        descripcion=desc,
        es_alergeno=alergeno,
        stock_actual=stock_a,
        stock_minimo=stock_m,
        costo_unitario=Decimal(str(costo)),
        unidad_medida=unidad,
    )
    session.add(ing)
    session.flush()
    return ing


def _link_ingrediente(
    session: Session,
    producto: Producto,
    ingrediente: Ingrediente,
    cantidad: float,
    simbolo: str,
    removible: bool,
) -> None:
    """Vincula un ingrediente a un producto (idempotente por par producto/ingrediente)."""
    existing = session.exec(
        select(ProductoIngrediente).where(
            ProductoIngrediente.producto_id == producto.id,
            ProductoIngrediente.ingrediente_id == ingrediente.id,
        )
    ).first()
    if existing:
        return
    unidad = session.exec(
        select(UnidadMedida).where(UnidadMedida.simbolo == simbolo)
    ).first()
    if unidad is None:
        return
    session.add(
        ProductoIngrediente(
            producto_id=producto.id,
            ingrediente_id=ingrediente.id,
            cantidad=Decimal(str(cantidad)),
            unidad_medida_id=unidad.id,
            es_removible=removible,
        )
    )


def _ensure_producto_catalogo(
    session: Session,
    nombre: str,
    descripcion: str,
    precio: int,
    stock: int,
    img_keywords: str,
    categoria: Categoria,
    ingredientes: list[tuple[str, float, str, bool]],
    ing_cache: dict[str, Ingrediente],
) -> None:
    """Crea un producto de catálogo (stock manual), lo asocia a su categoría y lo
    vincula con sus ingredientes. Idempotente por nombre.

    No setea imagen propia: en el catálogo cada producto usa la imagen de su
    categoría (las imágenes propias quedan reservadas para subidas reales por
    Cloudinary desde el panel admin). `img_keywords` se conserva sin uso por ahora.
    """
    prod = session.exec(select(Producto).where(Producto.nombre == nombre)).first()
    if not prod:
        prod = Producto(
            nombre=nombre,
            descripcion=descripcion,
            precio_base=Decimal(str(precio)),
            stock_manual=stock,
            disponible=True,
            usa_stock_manual=True,
        )
        session.add(prod)
        session.flush()
        session.add(
            ProductoCategoria(
                producto_id=prod.id, categoria_id=categoria.id, es_principal=True
            )
        )

    for ing_nombre, cantidad, simbolo, removible in ingredientes:
        ingrediente = ing_cache.get(ing_nombre)
        if ingrediente is not None:
            _link_ingrediente(session, prod, ingrediente, cantidad, simbolo, removible)


def _seed_extra_catalog(session: Session) -> None:
    """Catálogo ampliado con imágenes e ingredientes, idempotente por nombre.

    Additivo: crea categorías nuevas, productos relacionados, ingredientes (con su
    costo/stock) y los vínculos producto-ingrediente. Para los productos que ya
    existen (los originales), solo completa la imagen faltante y agrega ingredientes.
    No toca ni duplica lo ya cargado: seguro de correr en cada arranque.

    Estructura del catálogo: categoría -> (descripcion, orden, [
        (nombre, desc, precio, stock, img_keywords, [(ingrediente, cantidad, simbolo, removible)])
    ]).
    """
    ing_cache = {n: _get_or_create_ingrediente(session, n) for n in _INGREDIENTES_CATALOGO}

    catalogo: dict[str, tuple[str, int, list]] = {
        "Pizzas": ("Pizzas clásicas y especiales", 1, [
            ("Muzza", "Pizza de mozzarella", 1500, 50, "pizza,mozzarella", [
                ("Masa de pizza", 1, "ud", False), ("Mozzarella", 200, "g", False), ("Salsa de tomate", 80, "g", True),
            ]),
            ("Napolitana", "Pizza napolitana con rodajas de tomate", 1800, 40, "pizza,tomato", [
                ("Masa de pizza", 1, "ud", False), ("Mozzarella", 180, "g", False), ("Tomate", 2, "ud", True), ("Salsa de tomate", 80, "g", True),
            ]),
            ("Fugazzeta", "Pizza de cebolla y muzzarella", 1900, 40, "pizza,onion", [
                ("Masa de pizza", 1, "ud", False), ("Mozzarella", 200, "g", False), ("Cebolla", 2, "ud", True),
            ]),
            ("Pizza Especial", "Jamón, morrón y aceitunas", 2300, 35, "pizza,supreme", [
                ("Masa de pizza", 1, "ud", False), ("Mozzarella", 180, "g", False), ("Jamón", 50, "g", True), ("Aceitunas", 30, "g", True),
            ]),
            ("Calabresa", "Longaniza calabresa y muzzarella", 2100, 35, "pizza,pepperoni", [
                ("Masa de pizza", 1, "ud", False), ("Mozzarella", 180, "g", False), ("Longaniza", 80, "g", True),
            ]),
        ]),
        "Bebidas": ("Gaseosas, aguas y más", 2, [
            ("Coca Cola 1.5L", "Gaseosa Coca Cola 1.5 litros", 1200, 100, "cola,soda", []),
            ("Agua mineral 500ml", "Agua mineral sin gas", 400, 100, "water,bottle", []),
            ("Sprite 1.5L", "Gaseosa lima-limón 1.5 litros", 1200, 80, "lemon,soda", []),
            ("Cerveza Quilmes 1L", "Cerveza rubia 1 litro", 1800, 60, "beer,bottle", []),
            ("Agua con gas 500ml", "Agua mineral con gas", 450, 100, "sparkling,water", []),
            ("Jugo de Naranja 500ml", "Jugo exprimido natural", 1000, 50, "orange,juice", []),
        ]),
        "Adicionales": ("Porciones, fainá, etc.", 3, [
            ("Fainá", "Porción de fainá", 500, 60, "chickpea,bread", [
                ("Garbanzo", 120, "g", False),
            ]),
            ("Papas Fritas", "Porción de papas fritas", 1600, 70, "french,fries", [
                ("Papa", 300, "g", False),
            ]),
            ("Provoleta", "Provoleta a la parrilla con orégano", 2000, 30, "grilled,cheese", [
                ("Provolone", 200, "g", False),
            ]),
        ]),
        "Empanadas": ("Empanadas caseras al horno", 4, [
            ("Empanada de Carne", "Carne cortada a cuchillo", 950, 120, "empanada,beef", [
                ("Harina", 60, "g", False), ("Carne picada", 70, "g", False), ("Cebolla", 1, "ud", True),
            ]),
            ("Empanada de Jamón y Queso", "Jamón cocido y muzzarella", 950, 120, "empanada", [
                ("Harina", 60, "g", False), ("Jamón", 30, "g", False), ("Mozzarella", 30, "g", False),
            ]),
            ("Empanada de Pollo", "Pollo desmenuzado y verdeo", 950, 100, "empanada,chicken", [
                ("Harina", 60, "g", False), ("Pollo", 70, "g", False),
            ]),
            ("Empanada de Verdura", "Acelga con salsa blanca", 900, 80, "empanada,spinach", [
                ("Harina", 60, "g", False), ("Mozzarella", 20, "g", True),
            ]),
        ]),
        "Hamburguesas": ("Hamburguesas artesanales", 5, [
            ("Hamburguesa Simple", "Medallón de carne, lechuga y tomate", 2800, 50, "burger", [
                ("Pan de hamburguesa", 1, "ud", False), ("Carne picada", 150, "g", False), ("Lechuga", 1, "ud", True), ("Tomate", 1, "ud", True),
            ]),
            ("Hamburguesa Doble Cheddar", "Doble medallón con cheddar", 3900, 45, "cheeseburger", [
                ("Pan de hamburguesa", 1, "ud", False), ("Carne picada", 300, "g", False), ("Cheddar", 40, "g", False),
            ]),
            ("Hamburguesa Completa", "Carne, huevo, jamón, lechuga y tomate", 4200, 40, "burger,bacon", [
                ("Pan de hamburguesa", 1, "ud", False), ("Carne picada", 150, "g", False), ("Huevo", 1, "ud", True), ("Jamón", 30, "g", True), ("Lechuga", 1, "ud", True), ("Tomate", 1, "ud", True),
            ]),
        ]),
        "Lomos": ("Lomos completos y simples", 6, [
            ("Lomo Completo", "Lomo, jamón, queso, huevo, lechuga y tomate", 4500, 35, "steak,sandwich", [
                ("Pan de lomo", 1, "ud", False), ("Bife de lomo", 150, "g", False), ("Jamón", 30, "g", True), ("Mozzarella", 40, "g", True), ("Huevo", 1, "ud", True), ("Lechuga", 1, "ud", True), ("Tomate", 1, "ud", True),
            ]),
            ("Lomo Simple", "Lomo con lechuga y tomate", 3800, 35, "sandwich,steak", [
                ("Pan de lomo", 1, "ud", False), ("Bife de lomo", 150, "g", False), ("Lechuga", 1, "ud", True), ("Tomate", 1, "ud", True),
            ]),
        ]),
        "Pastas": ("Pastas caseras con salsa", 7, [
            ("Ñoquis con salsa", "Ñoquis de papa con salsa a elección", 2600, 40, "gnocchi", [
                ("Ñoquis", 250, "g", False), ("Salsa de tomate", 120, "g", True),
            ]),
            ("Ravioles de Ricota", "Ravioles de ricota y verdura", 2900, 40, "ravioli", [
                ("Harina", 100, "g", False), ("Ricota", 120, "g", False), ("Salsa de tomate", 120, "g", True),
            ]),
            ("Fideos con Tuco", "Fideos caseros con tuco", 2400, 40, "spaghetti,tomato", [
                ("Fideos", 150, "g", False), ("Salsa de tomate", 150, "g", True),
            ]),
        ]),
        "Milanesas": ("Milanesas de carne y pollo", 8, [
            ("Milanesa Napolitana", "Milanesa con jamón, queso y salsa", 3600, 40, "schnitzel,cheese", [
                ("Milanesa de carne", 1, "ud", False), ("Mozzarella", 60, "g", False), ("Jamón", 30, "g", True), ("Salsa de tomate", 60, "g", True),
            ]),
            ("Milanesa con Papas Fritas", "Milanesa con guarnición de papas", 3400, 40, "schnitzel,fries", [
                ("Milanesa de carne", 1, "ud", False), ("Papa", 250, "g", False),
            ]),
            ("Suprema de Pollo", "Suprema de pollo crocante", 3500, 40, "chicken,cutlet", [
                ("Suprema de pollo", 1, "ud", False), ("Pan rallado", 40, "g", False),
            ]),
        ]),
        "Ensaladas": ("Ensaladas frescas", 9, [
            ("Ensalada César", "Lechuga, pollo, croutons y aderezo César", 2100, 30, "caesar,salad", [
                ("Lechuga", 1, "ud", False), ("Pollo", 80, "g", False), ("Croutons", 20, "g", True),
            ]),
            ("Ensalada Mixta", "Lechuga, tomate y cebolla", 1700, 30, "salad,vegetables", [
                ("Lechuga", 1, "ud", False), ("Tomate", 1, "ud", False), ("Cebolla", 1, "ud", True),
            ]),
        ]),
        "Postres": ("Postres caseros", 10, [
            ("Flan con Dulce de Leche", "Flan casero con dulce de leche", 1400, 40, "flan,caramel", [
                ("Huevo", 2, "ud", False), ("Dulce de leche", 60, "g", True),
            ]),
            ("Helado 1/4 kg", "Helado artesanal 1/4 kg", 2200, 30, "ice,cream", [
                ("Helado de crema", 250, "g", False),
            ]),
            ("Brownie con Helado", "Brownie tibio con helado de crema", 1800, 35, "brownie,icecream", [
                ("Chocolate", 80, "g", False), ("Harina", 60, "g", False), ("Helado de crema", 80, "g", True),
            ]),
        ]),
    }
    for nombre_cat, (descripcion, orden, productos) in catalogo.items():
        categoria = _get_or_create_categoria(session, nombre_cat, descripcion, orden)
        for nombre, desc, precio, stock, img_keywords, ingredientes in productos:
            _ensure_producto_catalogo(
                session, nombre, desc, precio, stock, img_keywords, categoria, ingredientes, ing_cache
            )


def _seed_ventas_data(session: Session) -> None:
    if session.exec(select(Pago).where(Pago.estado == "aprobado").limit(1)).first():
        return

    cliente = session.exec(
        select(Usuario).where(Usuario.email == "cliente@test.com", Usuario.deleted_at.is_(None))
    ).first()
    if not cliente:
        return

    direccion = session.exec(
        select(DireccionEntrega).where(DireccionEntrega.usuario_id == cliente.id).limit(1)
    ).first()
    if not direccion:
        direccion = DireccionEntrega(
            usuario_id=cliente.id,
            alias="Casa",
            linea1="Av. Siempre Viva 123",
            ciudad="Buenos Aires",
            provincia="BA",
            codigo_postal="1000",
            es_principal=True,
        )
        session.add(direccion)
        session.flush()

    productos = session.exec(select(Producto).where(Producto.deleted_at.is_(None))).all()
    if not productos:
        return

    admin = session.exec(
        select(Usuario).where(Usuario.email == "admin@test.com", Usuario.deleted_at.is_(None))
    ).first()
    admin_id = admin.id if admin else cliente.id

    now = datetime.now(timezone.utc)
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)

    pedidos_data = [
        # (dias_atras, estado, productos_indices, cantidades, forma_pago)
        (1, "ENTREGADO", [0, 3], [2, 2], "MERCADOPAGO"),
        (2, "ENTREGADO", [1, 4], [1, 3], "MERCADOPAGO"),
        (3, "ENTREGADO", [0], [3], "EFECTIVO"),
        (4, "ENTREGADO", [2, 3], [2, 1], "MERCADOPAGO"),
        (5, "ENTREGADO", [1, 0], [1, 1], "MERCADOPAGO"),
        (6, "ENTREGADO", [0, 3, 4], [2, 1, 2], "MERCADOPAGO"),
        (7, "CONFIRMADO", [3, 4], [2, 2], "MERCADOPAGO"),
        (8, "EN_PREP", [1, 2], [2, 1], "EFECTIVO"),
        (9, "ENTREGADO", [0, 3], [1, 3], "MERCADOPAGO"),
        (10, "ENTREGADO", [2, 4], [3, 2], "MERCADOPAGO"),
        (11, "ENTREGADO", [0], [4], "EFECTIVO"),
        (12, "CONFIRMADO", [1, 3], [2, 1], "MERCADOPAGO"),
        (14, "ENTREGADO", [0, 2], [2, 2], "MERCADOPAGO"),
        (16, "EN_PREP", [0, 3], [1, 1], "MERCADOPAGO"),
        (18, "ENTREGADO", [1, 4], [2, 1], "EFECTIVO"),
        (20, "ENTREGADO", [0, 3, 4], [3, 1, 1], "MERCADOPAGO"),
        (22, "PENDIENTE", [0], [2], None),
        (24, "ENTREGADO", [2, 3], [2, 2], "MERCADOPAGO"),
        (26, "CONFIRMADO", [1, 3], [1, 2], "MERCADOPAGO"),
        (28, "ENTREGADO", [0, 4], [2, 3], "MERCADOPAGO"),
    ]

    for dias_atras, estado, prod_indices, cantidades, forma_pago in pedidos_data:
        fecha = today - timedelta(days=dias_atras)
        detalles_data = [(productos[i], cantidades[j]) for j, i in enumerate(prod_indices)]
        subtotal = sum(p.precio_base * c for p, c in detalles_data)
        costo_envio = Decimal("300") if subtotal < Decimal("3000") else Decimal("0")
        total = subtotal + costo_envio

        pedido = Pedido(
            usuario_id=cliente.id,
            direccion_entrega_id=direccion.id,
            estado_codigo=estado,
            subtotal=subtotal,
            forma_pago_codigo=forma_pago,
            descuento=Decimal("0"),
            costo_envio=costo_envio,
            total=total,
            created_at=fecha,
            updated_at=fecha,
        )
        session.add(pedido)
        session.flush()

        for producto, cantidad in detalles_data:
            subt = producto.precio_base * cantidad
            detalle = DetallePedido(
                pedido_id=pedido.id,
                producto_id=producto.id,
                cantidad=cantidad,
                nombre_snapshot=producto.nombre,
                precio_snapshot=producto.precio_base,
                subtotal_snapshot=subt,
                created_at=fecha,
                updated_at=fecha,
            )
            session.add(detalle)

        # Historial: PENDIENTE → estado actual
        historial = HistorialEstadoPedido(
            pedido_id=pedido.id,
            estado_desde_codigo="PENDIENTE",
            estado_hacia_codigo=estado,
            usuario_id=admin_id,
            fecha=fecha,
            created_at=fecha,
            updated_at=fecha,
        )
        session.add(historial)

        # Pago para estados que no son PENDIENTE
        if estado != "PENDIENTE":
            pago_estado = "aprobado" if estado == "ENTREGADO" else "aprobado"
            pago = Pago(
                pedido_id=pedido.id,
                monto=total,
                estado=pago_estado,
                mp_status="approved" if forma_pago == "MERCADOPAGO" else ("manual" if forma_pago == "EFECTIVO" else None),
                mp_status_detail="accredited" if forma_pago == "MERCADOPAGO" else ("Aprobado manualmente" if forma_pago == "EFECTIVO" else None),
                transaction_amount=total,
                idempotency_key=str(uuid.uuid4()),
                created_at=fecha,
                updated_at=fecha,
            )
            session.add(pago)
