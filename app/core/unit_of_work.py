from sqlmodel import Session


class UnitOfWork:
    """
    Gestiona el ciclo de vida de la transacción de base de datos.

    Uso en servicios:
        with uow:
            uow.categorias.add(categoria)
            uow.productos.add(producto)
        # commit automático si no hay excepción
        # rollback automático si hay excepción

    El UoW es la única capa que llama a commit() y rollback().
    Los repositorios solo llaman a flush() para obtener IDs en memoria.
    """

    def __init__(self, session: Session) -> None:
        """
        Inicializa el UnitOfWork con una sesión activa de base de datos.

        Args:
            session (Session): Instancia de SQLModel/SQLAlchemy Session.
        """
        self._session = session

    def __enter__(self) -> "UnitOfWork":
        """Retorna la propia instancia para operar dentro del bloque."""
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        """
        Controla automáticamente la transacción:
        - Si no hubo excepción → commit()
        - Si hubo excepción → rollback()
        NOTA: No cierra la sesión — la gestiona FastAPI vía get_session().
        """
        if exc_type is None:
            self._session.commit()
        else:
            self._session.rollback()

    def commit(self) -> None:
        """Ejecuta un commit explícito."""
        self._session.commit()

    def rollback(self) -> None:
        """Ejecuta un rollback explícito."""
        self._session.rollback()
