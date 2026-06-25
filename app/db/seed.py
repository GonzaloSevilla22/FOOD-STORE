"""Seed de datos obligatorios — consigna §14.2 (criterio CE-05).

Ejecutar con:

    python -m app.db.seed

Carga (de forma idempotente) roles, estados de pedido, formas de pago,
unidades de medida y el usuario admin de la consigna.
"""

from sqlmodel import Session

from app.core.database import create_db_and_tables, engine
from app.core.seed import seed_required_data

__all__ = ["seed_required_data", "main"]


def main() -> None:
    create_db_and_tables()
    with Session(engine) as session:
        seed_required_data(session)
    print(
        "[OK] Seed completado: roles, estados de pedido, formas de pago, "
        "unidades de medida y usuario admin (admin@foodstore.com)."
    )


if __name__ == "__main__":
    main()
