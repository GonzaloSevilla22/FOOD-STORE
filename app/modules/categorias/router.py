from fastapi import APIRouter, Depends, Query, status
from sqlmodel import Session

from app.core.deps import get_current_active_user, require_roles
from app.core.database import get_session
from app.core.rbac import ROLE_ADMIN
from app.modules.usuarios.schemas import CurrentUser
from app.modules.categorias.schemas import (
    CategoriaCreate,
    CategoriaDetail,
    CategoriaList,
    CategoriaPublic,
    CategoriaUpdate,
)
from app.modules.categorias.service import CategoriaService

router = APIRouter()


def get_categoria_service(session: Session = Depends(get_session)) -> CategoriaService:
    return CategoriaService(session)


@router.post("", response_model=CategoriaPublic, status_code=status.HTTP_201_CREATED)
def create_categoria(
    data: CategoriaCreate,
    _: CurrentUser = Depends(require_roles([ROLE_ADMIN])),
    svc: CategoriaService = Depends(get_categoria_service),
) -> CategoriaPublic:
    return svc.create(data)


@router.get("", response_model=CategoriaList)
def list_categorias(
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    include_deleted: bool = Query(default=False),
    _: CurrentUser = Depends(get_current_active_user),
    svc: CategoriaService = Depends(get_categoria_service),
) -> CategoriaList:
    return svc.get_all(offset=offset, limit=limit, include_deleted=include_deleted)


@router.get("/{categoria_id}", response_model=CategoriaPublic)
def get_categoria(
    categoria_id: int,
    _: CurrentUser = Depends(get_current_active_user),
    svc: CategoriaService = Depends(get_categoria_service),
) -> CategoriaPublic:
    return svc.get_by_id(categoria_id)


@router.get("/{categoria_id}/detail", response_model=CategoriaDetail)
def get_categoria_detail(
    categoria_id: int,
    _: CurrentUser = Depends(get_current_active_user),
    svc: CategoriaService = Depends(get_categoria_service),
) -> CategoriaDetail:
    return svc.get_detail(categoria_id)


@router.patch("/{categoria_id}", response_model=CategoriaPublic)
def update_categoria(
    categoria_id: int,
    data: CategoriaUpdate,
    _: CurrentUser = Depends(require_roles([ROLE_ADMIN])),
    svc: CategoriaService = Depends(get_categoria_service),
) -> CategoriaPublic:
    return svc.update(categoria_id, data)


@router.delete("/{categoria_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_categoria(
    categoria_id: int,
    _: CurrentUser = Depends(require_roles([ROLE_ADMIN])),
    svc: CategoriaService = Depends(get_categoria_service),
) -> None:
    svc.soft_delete(categoria_id)


@router.patch("/{categoria_id}/restore", response_model=CategoriaPublic)
def restore_categoria(
    categoria_id: int,
    _: CurrentUser = Depends(require_roles([ROLE_ADMIN])),
    svc: CategoriaService = Depends(get_categoria_service),
) -> CategoriaPublic:
    return svc.restore(categoria_id)
