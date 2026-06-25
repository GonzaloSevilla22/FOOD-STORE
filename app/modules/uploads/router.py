import logging

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status

from app.core.deps import require_roles
from app.core.rbac import ROLE_ADMIN
from app.modules.usuarios.schemas import CurrentUser
from app.modules.uploads.service import UploadService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/uploads", tags=["uploads"])

# Consigna §10.1: validar tipo MIME y tamaño (max 5 MB) antes de subir a Cloudinary.
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_UPLOAD_BYTES = 5 * 1024 * 1024  # 5 MB


def get_upload_service() -> UploadService:
    return UploadService()


@router.post("/imagen")
def subir_imagen(
    file: UploadFile = File(...),
    current_user: CurrentUser = Depends(require_roles([ROLE_ADMIN])),
    svc: UploadService = Depends(get_upload_service),
) -> dict:
    if not file.content_type or file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El archivo debe ser una imagen JPEG, PNG o WebP",
        )

    # Validar tamaño (max 5 MB). Se lee el contenido y se rebobina para que el
    # service pueda reenviarlo a Cloudinary.
    contenido = file.file.read()
    if len(contenido) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La imagen supera el tamaño máximo permitido de 5 MB",
        )
    file.file.seek(0)

    return svc.upload_imagen(file)


@router.delete("/imagen/{public_id:path}")
def eliminar_imagen(
    public_id: str,
    current_user: CurrentUser = Depends(require_roles([ROLE_ADMIN])),
    svc: UploadService = Depends(get_upload_service),
) -> dict:
    svc.eliminar_imagen(public_id)
    return {"message": "Imagen eliminada correctamente"}
