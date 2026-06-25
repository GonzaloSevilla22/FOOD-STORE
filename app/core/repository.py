from typing import Generic, TypeVar, Type, Sequence
from sqlmodel import Session, SQLModel, select

ModelT = TypeVar("ModelT", bound=SQLModel)


class BaseRepository(Generic[ModelT]):
    """
    Repositorio genérico que implementa operaciones CRUD básicas
    para cualquier modelo basado en SQLModel.

    Principio: el repositorio solo habla con la DB.
    No contiene lógica de negocio ni levanta HTTPException.

    Tipado:
    - Usa Generic[ModelT] para mantener tipado fuerte en cada repositorio concreto.
    """

    def __init__(self, session: Session, model: Type[ModelT]) -> None:
        """
        Inicializa el repositorio con una sesión de base de datos y el modelo asociado.

        Args:
            session (Session): Sesión activa de SQLModel/SQLAlchemy.
            model (Type[ModelT]): Clase del modelo que este repositorio gestiona.
        """
        self.session = session
        self.model = model

    def get_by_id(self, record_id: int) -> ModelT | None:
        """Obtiene una entidad por su ID primario."""
        return self.session.get(self.model, record_id)

    def get_all(self, offset: int = 0, limit: int = 20) -> Sequence[ModelT]:
        """Obtiene una lista paginada de entidades."""
        return self.session.exec(
            select(self.model).offset(offset).limit(limit)
        ).all()

    def add(self, instance: ModelT) -> ModelT:
        """
        Persiste una entidad en la sesión.
        NO hace commit — lo maneja el UnitOfWork.
        """
        self.session.add(instance)
        self.session.flush()
        self.session.refresh(instance)
        return instance

    def delete(self, instance: ModelT) -> None:
        """
        Marca una entidad para eliminación.
        NO hace commit — lo maneja el UnitOfWork.
        """
        self.session.delete(instance)
        self.session.flush()
