"""
Utilidades compartidas del core.

Este módulo centraliza helpers que antes estaban dispersos entre
base.py y security.py, y además sirve como capa de compatibilidad
para referencias antiguas a app.core.utils.
"""

from app.core.base import now_utc
from app.core.security import JWTHandler, hash_password, verify_password

__all__ = [
    "now_utc",
    "hash_password",
    "verify_password",
    "JWTHandler",
]