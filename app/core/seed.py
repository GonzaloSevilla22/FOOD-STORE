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
