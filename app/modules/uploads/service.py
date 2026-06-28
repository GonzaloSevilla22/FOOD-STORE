import logging
from typing import Optional

import cloudinary
import cloudinary.uploader
import cloudinary.api
from fastapi import HTTPException, status, UploadFile

from app.core.config import settings

logger = logging.getLogger(__name__)


class UploadService:
    def __init__(self) -> None:
        self._configure()

    def _configure(self) -> None:
        cloud_name = settings.CLOUDINARY_CLOUD_NAME
        api_key = settings.CLOUDINARY_API_KEY
        api_secret = settings.CLOUDINARY_API_SECRET

        if cloud_name and api_key and api_secret:
            cloudinary.config(
                cloud_name=cloud_name,
                api_key=api_key,
                api_secret=api_secret,
                secure=True,
            )

    def _is_configured(self) -> bool:
        return bool(
            settings.CLOUDINARY_CLOUD_NAME
            and settings.CLOUDINARY_API_KEY
            and settings.CLOUDINARY_API_SECRET
        )

    def upload_imagen(self, file: UploadFile) -> dict:
        if not self._is_configured():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cloudinary no está configurado. Configure CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET en el .env",
            )

        try:
            result = cloudinary.uploader.upload(
                file.file,
                folder="food_store",
                resource_type="image",
            )

            return {
                "secure_url": result.get("secure_url"),
                "public_id": result.get("public_id"),
                "width": result.get("width"),
                "height": result.get("height"),
                "format": result.get("format"),
                "resource_type": result.get("resource_type"),
            }

        except Exception as e:
            logger.exception("Error subiendo imagen a Cloudinary")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error al subir imagen: {str(e)}",
            )

    def eliminar_imagen(self, public_id: str) -> None:
        if not self._is_configured():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cloudinary no está configurado",
            )

        try:
            cloudinary.uploader.destroy(public_id)
        except Exception as e:
            logger.exception("Error eliminando imagen de Cloudinary")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error al eliminar imagen: {str(e)}",
            )
