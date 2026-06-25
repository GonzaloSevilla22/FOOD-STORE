import logging

from fastapi import APIRouter, Depends, UploadFile, File

from app.core.deps import require_roles
from app.core.rbac import ROLE_ADMIN
from app.modules.usuarios.schemas import CurrentUser
from app.modules.uploads.service import UploadService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/uploads", tags=["uploads"])


def get_upload_service() -> UploadService:
    return UploadService()


@router.post("/imagen")
def subir_imagen(
    file: UploadFile = File(...),
    current_user: CurrentUser = Depends(require_roles([ROLE_ADMIN])),
    svc: UploadService = Depends(get_upload_service),
) -> dict:
    if not file.content_type or not file.content_type.startswith("image/"):
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El archivo debe ser una imagen",
        )

    return svc.upload_imagen(file)


@router.delete("/imagen/{public_id:path}")
def eliminar_imagen(
    public_id: str,
    current_user: CurrentUser = Depends(require_roles([ROLE_ADMIN])),
    svc: UploadService = Depends(get_upload_service),
) -> dict:
    svc.eliminar_imagen(public_id)
    return {"message": "Imagen eliminada correctamente"}
