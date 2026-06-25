"""
UsuarioService: Lógica de negocio para usuarios.
"""

from typing import Optional
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlmodel import Session

from app.modules.usuarios.models import Usuario
from app.modules.direcciones.models import DireccionEntrega
from app.modules.usuarios.unit_of_work import UsuarioUnitOfWork
from app.modules.usuarios.schemas import (
    UsuarioPublic,
    UsuarioUpdate,
    UsuarioDetail,
    UsuarioList,
    DireccionEntregaPublic,
    RolPublic,
)


class UsuarioService:
    """
    Servicio de negocio para Usuario.
    Maneja operaciones CRUD y relaciones con roles/direcciones.
    """

    def __init__(self, session: Session):
        self._session = session

    # ========================================================================
    # USUARIO CRUD
    # ========================================================================

    def get_usuario(self, usuario_id: int) -> UsuarioDetail:
        """
        Obtener usuario con detalles.
        
        Args:
            usuario_id: ID del usuario
            
        Returns:
            Usuario con roles y direcciones
            
        Raises:
            HTTPException: Si usuario no existe o está inactivo
        """
        with UsuarioUnitOfWork(self._session) as uow:
            usuario = uow.usuarios.get_by_id(usuario_id)
            if not usuario or not usuario.activo or usuario.deleted_at is not None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Usuario no encontrado",
                )
            
            return self._to_detail(usuario)

    def list_usuarios(
        self,
        offset: int = 0,
        limit: int = 20,
        include_inactive: bool = False,
    ) -> UsuarioList:
        """
        Listar usuarios con opción de incluir inactivos.
        
        Args:
            offset: Offset de paginación
            limit: Límite de resultados
            include_inactive: Si True, incluye usuarios inactivos
            
        Returns:
            Lista paginada de usuarios
        """
        with UsuarioUnitOfWork(self._session) as uow:
            usuarios = uow.usuarios.get_paginated(
                offset=offset,
                limit=limit,
                include_inactive=include_inactive,
            )
            total = uow.usuarios.count(include_inactive=include_inactive)
            
            return UsuarioList(
                data=[self._to_public(u) for u in usuarios],
                total=total,
            )

    def update_usuario(self, usuario_id: int, data: UsuarioUpdate) -> UsuarioDetail:
        """
        Actualizar usuario.
        
        Args:
            usuario_id: ID del usuario
            data: Datos a actualizar
            
        Returns:
            Usuario actualizado
            
        Raises:
            HTTPException: Si usuario no existe
        """
        with UsuarioUnitOfWork(self._session) as uow:
            usuario = uow.usuarios.get_by_id(usuario_id)
            if not usuario or usuario.deleted_at is not None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Usuario no encontrado",
                )

            if data.nombre is not None:
                usuario.nombre = data.nombre
            if data.apellido is not None:
                usuario.apellido = data.apellido
            if data.celular is not None:
                usuario.celular = data.celular
            if data.activo is not None:
                usuario.activo = data.activo
                if data.activo:
                    usuario.deleted_at = None

            uow.usuarios.add(usuario)

        return self._to_detail(usuario)

    def delete_usuario(self, usuario_id: int) -> None:
        """
        Soft-delete de usuario.
        
        Args:
            usuario_id: ID del usuario
            
        Raises:
            HTTPException: Si usuario no existe
        """
        with UsuarioUnitOfWork(self._session) as uow:
            usuario = uow.usuarios.get_by_id(usuario_id)
            if not usuario or usuario.deleted_at is not None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Usuario no encontrado",
                )

            now = datetime.now(timezone.utc)
            usuario.activo = False
            usuario.deleted_at = now
            usuario.updated_at = now
            uow.usuarios.add(usuario)

    # ========================================================================
    # ROLES
    # ========================================================================

    def asignar_rol(self, usuario_id: int, rol_codigo: str) -> UsuarioDetail:
        """
        Asignar rol a usuario.
        
        Args:
            usuario_id: ID del usuario
            rol_codigo: Código del rol
            
        Returns:
            Usuario actualizado
            
        Raises:
            HTTPException: Si usuario o rol no existen
        """
        with UsuarioUnitOfWork(self._session) as uow:
            usuario = uow.usuarios.get_by_id(usuario_id)
            if not usuario or not usuario.activo or usuario.deleted_at is not None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Usuario no encontrado",
                )

            rol = uow.roles.get_by_codigo(rol_codigo)
            if not rol:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Rol no encontrado",
                )

            existing = uow.usuarios_roles.get(usuario_id, rol_codigo)
            if not existing:
                uow.usuarios_roles.add(usuario_id, rol_codigo)

            uow._session.refresh(usuario)

        return self._to_detail(usuario)

    def remover_rol(self, usuario_id: int, rol_codigo: str) -> UsuarioDetail:
        """
        Remover rol de usuario.
        
        Args:
            usuario_id: ID del usuario
            rol_codigo: Código del rol
            
        Returns:
            Usuario actualizado
            
        Raises:
            HTTPException: Si usuario no existe
        """
        with UsuarioUnitOfWork(self._session) as uow:
            usuario = uow.usuarios.get_by_id(usuario_id)
            if not usuario or not usuario.activo or usuario.deleted_at is not None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Usuario no encontrado",
                )

            uow.usuarios_roles.delete(usuario_id, rol_codigo)
            uow._session.refresh(usuario)

        return self._to_detail(usuario)

    # ========================================================================
    # HELPERS
    # ========================================================================

    def _to_public(self, usuario: Usuario) -> UsuarioPublic:
        """Convertir Usuario a UsuarioPublic."""
        return UsuarioPublic(
            id=usuario.id,
            nombre=usuario.nombre,
            apellido=usuario.apellido,
            email=usuario.email,
            celular=usuario.celular,
            activo=usuario.activo,
        )

    def _to_detail(self, usuario: Usuario) -> UsuarioDetail:
        """Convertir Usuario a UsuarioDetail."""
        roles = [
            RolPublic(
                codigo=ur.rol.codigo,
                nombre=ur.rol.nombre,
                descripcion=ur.rol.descripcion,
            )
            for ur in usuario.usuarios_roles
        ]
        
        direcciones = [
            self._direccion_to_public(d)
            for d in usuario.direcciones
            if d.activo and d.deleted_at is None
        ]
        
        return UsuarioDetail(
            id=usuario.id,
            nombre=usuario.nombre,
            apellido=usuario.apellido,
            email=usuario.email,
            celular=usuario.celular,
            activo=usuario.activo,
            roles=roles,
            direcciones=direcciones,
            created_at=usuario.created_at,
            updated_at=usuario.updated_at,
        )

    def _direccion_to_public(self, direccion: DireccionEntrega) -> DireccionEntregaPublic:
        """Convertir DireccionEntrega a DireccionEntregaPublic."""
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
