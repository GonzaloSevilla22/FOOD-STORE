from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlmodel import Session

from app.core.deps import get_current_active_user
from app.modules.direcciones.models import DireccionEntrega
from app.modules.direcciones.schemas import (
    DireccionEntregaCreate,
    DireccionEntregaUpdate,
    DireccionEntregaPublic,
    DireccionEntregaList,
)
from app.modules.direcciones.unit_of_work import DireccionUnitOfWork
from app.modules.usuarios.schemas import CurrentUser


class DireccionService:
    def __init__(self, session: Session) -> None:
        self._session = session

    def _direccion_to_public(self, direccion: DireccionEntrega) -> DireccionEntregaPublic:
        return DireccionEntregaPublic(
            id=direccion.id,
            alias=direccion.alias,
            linea1=direccion.linea1,
            linea2=direccion.linea2,
            ciudad=direccion.ciudad,
            provincia=direccion.provincia,
            codigo_postal=direccion.codigo_postal,
            es_principal=direccion.es_principal,
            activo=direccion.activo,
        )

    def _ensure_self_or_admin(self, current_user: CurrentUser, usuario_id: int) -> None:
        if current_user.id != usuario_id and "ADMIN" not in (current_user.roles or []):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos para acceder a este recurso",
            )

    def crear_direccion(self, usuario_id: int, data: DireccionEntregaCreate) -> DireccionEntregaPublic:
        with DireccionUnitOfWork(self._session) as uow:
            from app.modules.usuarios.repository import UsuarioRepository
            usuario = UsuarioRepository(uow._session).get_by_id(usuario_id)
            if not usuario or not usuario.activo or usuario.deleted_at is not None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Usuario no encontrado",
                )

            if data.es_principal:
                principal = uow.direcciones.get_principal_by_usuario(usuario_id)
                if principal:
                    principal.es_principal = False
                    uow.direcciones.add(principal)

            direccion = DireccionEntrega(
                usuario_id=usuario_id,
                alias=data.alias,
                linea1=data.linea1,
                linea2=data.linea2,
                ciudad=data.ciudad,
                provincia=data.provincia,
                codigo_postal=data.codigo_postal,
                es_principal=data.es_principal,
                activo=True,
            )

            direccion = uow.direcciones.add(direccion)
            result = self._direccion_to_public(direccion)

        return result

    def get_direccion(self, usuario_id: int, direccion_id: int) -> DireccionEntregaPublic:
        with DireccionUnitOfWork(self._session) as uow:
            direccion = uow.direcciones.get_by_id(direccion_id)
            if not direccion or direccion.usuario_id != usuario_id or not direccion.activo:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Dirección no encontrada",
                )

            return self._direccion_to_public(direccion)

    def list_direcciones(self, usuario_id: int, offset: int = 0, limit: int = 20) -> DireccionEntregaList:
        with DireccionUnitOfWork(self._session) as uow:
            direcciones = uow.direcciones.get_by_usuario_id(usuario_id, offset=offset, limit=limit)
            total = len(direcciones)

            return DireccionEntregaList(
                data=[self._direccion_to_public(d) for d in direcciones],
                total=total,
            )

    def update_direccion(
        self,
        usuario_id: int,
        direccion_id: int,
        data: DireccionEntregaUpdate,
    ) -> DireccionEntregaPublic:
        with DireccionUnitOfWork(self._session) as uow:
            direccion = uow.direcciones.get_by_id(direccion_id)
            if not direccion or direccion.usuario_id != usuario_id or not direccion.activo:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Dirección no encontrada",
                )

            if data.es_principal:
                principal = uow.direcciones.get_principal_by_usuario(usuario_id)
                if principal and principal.id != direccion_id:
                    principal.es_principal = False
                    uow.direcciones.add(principal)

            update_data = data.model_dump(exclude_unset=True)
            for field, value in update_data.items():
                setattr(direccion, field, value)

            uow.direcciones.add(direccion)

        return self._direccion_to_public(direccion)

    def set_direccion_principal(self, usuario_id: int, direccion_id: int) -> DireccionEntregaPublic:
        with DireccionUnitOfWork(self._session) as uow:
            direccion = uow.direcciones.get_by_id(direccion_id)
            if not direccion or direccion.usuario_id != usuario_id or not direccion.activo:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Dirección no encontrada",
                )

            principal_actual = uow.direcciones.get_principal_by_usuario(usuario_id)
            if principal_actual and principal_actual.id != direccion.id:
                principal_actual.es_principal = False
                uow.direcciones.add(principal_actual)

            direccion.es_principal = True
            uow.direcciones.add(direccion)

        return self._direccion_to_public(direccion)

    def delete_direccion(self, usuario_id: int, direccion_id: int) -> None:
        with DireccionUnitOfWork(self._session) as uow:
            direccion = uow.direcciones.get_by_id(direccion_id)
            if not direccion or direccion.usuario_id != usuario_id or not direccion.activo:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Dirección no encontrada",
                )

            now = datetime.now(timezone.utc)
            direccion.activo = False
            direccion.deleted_at = now
            direccion.updated_at = now
            uow.direcciones.add(direccion)
