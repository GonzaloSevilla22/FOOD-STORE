from datetime import datetime, timezone

from sqlalchemy import inspect, text
from sqlalchemy.dialects import postgresql
from sqlmodel import SQLModel, Session, create_engine

from app.core.config import settings

if settings.DATABASE_URL.startswith("sqlite"):
    _connect_args = {"check_same_thread": False}
else:
    _connect_args = {"client_encoding": "UTF8"}
engine = create_engine(settings.DATABASE_URL, echo=False, connect_args=_connect_args)
_is_postgres = settings.DATABASE_URL.startswith("postgresql")


def _register_all_models() -> None:
    """Importa los módulos de modelos para poblar SQLModel.metadata.

    Los modelos viven en cada módulo de feature (app/modules/<x>/models.py).
    Este import explícito garantiza que todas las tablas estén registradas
    antes de create_all / configuración de mappers, sin depender de cadenas
    transitivas de import.
    """
    from app.modules.categorias import models as _categorias  # noqa: F401
    from app.modules.productos import models as _productos  # noqa: F401
    from app.modules.ingredientes import models as _ingredientes  # noqa: F401
    from app.modules.usuarios import models as _usuarios  # noqa: F401
    from app.modules.direcciones import models as _direcciones  # noqa: F401
    from app.modules.pedidos import models as _pedidos  # noqa: F401
    from app.modules.payments import models as _payments  # noqa: F401


def create_db_and_tables() -> None:
    _register_all_models()
    SQLModel.metadata.create_all(engine)
    _migrate_legacy_schema()


def _add_column_if_missing(
    connection, table: str, column_name: str, column_def: str
) -> None:
    inspector = inspect(connection)
    if table not in inspector.get_table_names():
        return
    columns = {c["name"] for c in inspector.get_columns(table)}
    if column_name in columns:
        return
    if _is_postgres:
        connection.execute(text(f"ALTER TABLE {table} ADD COLUMN {column_def}"))
    else:
        connection.execute(text(f"ALTER TABLE {table} ADD COLUMN {column_def}"))


def _update_activo_from_deleted_at(connection, table: str) -> None:
    inspector = inspect(connection)
    if table not in inspector.get_table_names():
        return
    columns = {c["name"] for c in inspector.get_columns(table)}
    if "activo" not in columns:
        return
    connection.execute(
        text(
            f"UPDATE {table} SET activo = CASE "
            "WHEN deleted_at IS NULL THEN TRUE ELSE FALSE END "
            "WHERE activo IS NULL"
        )
    )


def _resize_varchar_if_needed(connection, table: str, column: str, new_type: str) -> None:
    """Ampliar VARCHAR de una columna si el tipo actual es muy pequeño.
    Solo aplica a PostgreSQL; SQLite no impone largo en VARCHAR."""
    if not _is_postgres:
        return
    inspector = inspect(connection)
    if table not in inspector.get_table_names():
        return
    col_info = next((c for c in inspector.get_columns(table) if c["name"] == column), None)
    if col_info is None:
        return
    current_type = str(col_info["type"])
    connection.execute(text(f"ALTER TABLE {table} ALTER COLUMN {column} TYPE {new_type}"))


def _drop_unidad_medida_check_constraint(connection) -> None:
    """Eliminar CHECK constraint de ingredientes.unidad_medida para permitir nuevos valores del enum.
    Solo aplica a PostgreSQL; SQLite recrea la tabla desde cero al iniciar."""
    if not _is_postgres:
        return
    inspector = inspect(connection)
    if "ingredientes" not in inspector.get_table_names():
        return
    for constraint in inspector.get_check_constraints("ingredientes"):
        if constraint.get("sqltext") and "unidad_medida" in constraint["sqltext"]:
            constraint_name = constraint.get("name")
            if constraint_name:
                connection.execute(text(f"ALTER TABLE ingredientes DROP CONSTRAINT IF EXISTS {constraint_name}"))


def _migrate_legacy_schema() -> None:
    """Aplicar ajustes mínimos sobre tablas existentes sin migraciones formales.
    Cada operación DDL se ejecuta en su propia transacción para compatibilidad
    con PostgreSQL (que requiere commit implícito en ciertas ALTER TABLE)."""
    with engine.connect() as connection:
        _add_column_if_missing(
            connection, "categorias", "activo", "activo BOOLEAN NOT NULL DEFAULT TRUE"
        )
        _add_column_if_missing(
            connection, "categorias", "parent_id", "parent_id INTEGER"
        )
        _update_activo_from_deleted_at(connection, "categorias")

        _add_column_if_missing(
            connection, "productos_ingredientes", "cantidad", "cantidad NUMERIC(10,3) NOT NULL DEFAULT 1"
        )
        # v7: la unidad pasa de enum (columna `unidad`) a FK `unidad_medida_id` → UnidadMedida.
        # Nullable en la migración para no romper filas existentes; en esquemas nuevos es NN.
        _add_column_if_missing(
            connection, "productos_ingredientes", "unidad_medida_id", "unidad_medida_id BIGINT"
        )
        _add_column_if_missing(
            connection, "productos_ingredientes", "es_removible", "es_removible BOOLEAN NOT NULL DEFAULT false"
        )
        _add_column_if_missing(
            connection, "productos_ingredientes", "es_opcional", "es_opcional BOOLEAN NOT NULL DEFAULT false"
        )

        _add_column_if_missing(
            connection, "ingredientes", "stock_actual", "stock_actual DOUBLE PRECISION NOT NULL DEFAULT 0"
        )
        _add_column_if_missing(
            connection, "ingredientes", "stock_minimo", "stock_minimo DOUBLE PRECISION NOT NULL DEFAULT 0"
        )
        _add_column_if_missing(
            connection, "ingredientes", "costo_unitario", "costo_unitario NUMERIC(10,4) NOT NULL DEFAULT 0"
        )
        _add_column_if_missing(
            connection, "ingredientes", "unidad_medida", "unidad_medida VARCHAR(20) NOT NULL DEFAULT 'gramos'"
        )
        _add_column_if_missing(
            connection, "ingredientes", "activo", "activo BOOLEAN NOT NULL DEFAULT TRUE"
        )
        _update_activo_from_deleted_at(connection, "ingredientes")

        _add_column_if_missing(
            connection, "productos", "usa_stock_manual", "usa_stock_manual BOOLEAN NOT NULL DEFAULT FALSE"
        )
        _add_column_if_missing(
            connection, "productos", "stock_manual", "stock_manual INTEGER"
        )
        _add_column_if_missing(
            connection, "productos", "costo_compra_manual", "costo_compra_manual NUMERIC(10,4)"
        )
        _add_column_if_missing(
            connection, "productos", "activo", "activo BOOLEAN NOT NULL DEFAULT TRUE"
        )
        _update_activo_from_deleted_at(connection, "productos")

        _add_column_if_missing(
            connection, "pedidos", "forma_pago_codigo", "forma_pago_codigo VARCHAR(50)"
        )

        _add_column_if_missing(
            connection, "estados_pedido", "es_terminal",
            "es_terminal BOOLEAN NOT NULL DEFAULT FALSE",
        )

    # Migrar estados legacy a los códigos v7 (FSM 5 estados, consigna §3.4).
    # Transacción separada con commit explícito (engine.connect() no commitea,
    # y el seed necesita ver estos cambios).
    with engine.begin() as conn:
        _migrate_estado_pedido(conn, "PAGADO", "CONFIRMADO")
        _migrate_estado_pedido(conn, "EN_PREPARACION", "EN_PREP")
        _migrate_estado_pedido(conn, "TERMINADO", "ENTREGADO")
        _migrate_estado_pedido(conn, "PREPARANDO", "EN_PREP")
        _migrate_estado_pedido(conn, "EN_CAMINO", "EN_PREP")

    # Migrar unidad_medida de ingredientes: litros → mililitros
    with engine.begin() as conn:
        _resize_varchar_if_needed(conn, "ingredientes", "unidad_medida", "VARCHAR(20)")
        if "ingredientes" in inspect(conn).get_table_names():
            conn.execute(
                text("UPDATE ingredientes SET unidad_medida = 'mililitros' WHERE unidad_medida = 'litros'")
            )
            _drop_unidad_medida_check_constraint(conn)

    # Extender CHECK constraint de ingredientes.unidad_medida para nuevos valores
    with engine.begin() as conn:
        if "ingredientes" in inspect(conn).get_table_names():
            _drop_unidad_medida_check_constraint(conn)


_ESTADO_INFO = {
    "PENDIENTE": ("Pendiente", "Pedido creado, pago pendiente", False),
    "CONFIRMADO": ("Confirmado", "Pago procesado y confirmado", False),
    "EN_PREP": ("En Preparación", "En preparación en cocina", False),
    "ENTREGADO": ("Entregado", "Entrega confirmada", True),
    "CANCELADO": ("Cancelado", "Pedido cancelado", True),
}


def _migrate_estado_pedido(connection, old_codigo: str, new_codigo: str) -> None:
    """Migrar pedidos e historiales de un estado antiguo a uno nuevo.

    También asegura que el estado nuevo exista en la tabla estados_pedido.
    """
    inspector = inspect(connection)
    for table in ("pedidos", "historiales_estado_pedido"):
        if table not in inspector.get_table_names():
            continue
        columns = {c["name"] for c in inspector.get_columns(table)}
        col = "estado_codigo" if table == "pedidos" else "estado_desde_codigo"
        if col in columns:
            connection.execute(
                text(f"UPDATE {table} SET {col} = :new WHERE {col} = :old").bindparams(
                    new=new_codigo, old=old_codigo
                )
            )
        col2 = "estado_hacia_codigo" if table == "historiales_estado_pedido" else None
        if col2 and col2 in columns:
            connection.execute(
                text(f"UPDATE {table} SET {col2} = :new WHERE {col2} = :old").bindparams(
                    new=new_codigo, old=old_codigo
                )
            )

    # Asegurar que el estado nuevo exista en estados_pedido
    if "estados_pedido" in inspector.get_table_names():
        info = _ESTADO_INFO.get(new_codigo, (new_codigo, "", False))
        _now = datetime.now(timezone.utc)
        if _is_postgres:
            connection.execute(
                text(
                    "INSERT INTO estados_pedido (codigo, nombre, descripcion, es_terminal, created_at, updated_at) "
                    "VALUES (:codigo, :nombre, :descripcion, :es_terminal, :created_at, :updated_at) ON CONFLICT (codigo) DO NOTHING"
                ).bindparams(codigo=new_codigo, nombre=info[0], descripcion=info[1], es_terminal=info[2], created_at=_now, updated_at=_now)
            )
        else:
            connection.execute(
                text(
                    "INSERT OR IGNORE INTO estados_pedido (codigo, nombre, descripcion, es_terminal, created_at, updated_at) "
                    "VALUES (:codigo, :nombre, :descripcion, :es_terminal, :created_at, :updated_at)"
                ).bindparams(codigo=new_codigo, nombre=info[0], descripcion=info[1], es_terminal=info[2], created_at=_now, updated_at=_now)
            )

    # Eliminar estado antiguo si existe en estados_pedido
    if "estados_pedido" in inspector.get_table_names():
        connection.execute(
            text("DELETE FROM estados_pedido WHERE codigo = :old").bindparams(old=old_codigo)
        )


def get_session():
    with Session(engine) as session:
        yield session
