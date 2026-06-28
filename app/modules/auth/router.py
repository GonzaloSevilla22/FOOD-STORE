"""Auth Router: autenticación y sesión."""

from fastapi import APIRouter, Depends, Response, status
from sqlmodel import Session

from app.core.config import settings
from app.core.deps import get_current_active_user
from app.core.database import get_session
from app.modules.usuarios.auth_service import AuthService
from app.modules.usuarios.schemas import (
    LoginRequest,
    RefreshRequest,
    TokenResponse,
    UsuarioCreate,
    UsuarioPublic,
    CurrentUser,
)

router = APIRouter()


def get_auth_service(session: Session = Depends(get_session)) -> AuthService:
    """Dependency para obtener el AuthService."""
    return AuthService(session)


@router.post("/register", response_model=UsuarioPublic, status_code=status.HTTP_201_CREATED)
def register(
    data: UsuarioCreate,
    svc: AuthService = Depends(get_auth_service),
) -> UsuarioPublic:
    """
    Registrar nuevo usuario.
    
    Parámetros:
    - **nombre**: Nombre del usuario
    - **apellido**: Apellido del usuario
    - **email**: Email único
    - **celular**: Teléfono (opcional)
    - **password**: Contraseña (mínimo 8 caracteres)
    
    Retorna el usuario creado.
    """
    return svc.register(data)


@router.post("/login", response_model=TokenResponse)
def login(
    data: LoginRequest,
    response: Response,
    svc: AuthService = Depends(get_auth_service),
) -> TokenResponse:
    """
    Autenticar usuario y obtener JWT token.

    El token se devuelve en la respuesta JSON (access_token) y también en una
    cookie httpOnly `access_token` (consigna §4.1). El cliente Bearer sigue
    funcionando: lee el token del body; la cookie no interfiere.

    Parámetros:
    - **email**: Email del usuario
    - **password**: Contraseña

    Retorna:
    - **access_token**: JWT token para usar en Authorization header
    - **token_type**: Tipo de token (Bearer)
    - **expires_in**: Segundos hasta la expiración del access_token
    - **usuario**: Información del usuario autenticado
    """
    result = svc.login(data)
    response.set_cookie(
        key=settings.COOKIE_NAME,
        value=result.access_token,
        httponly=True,
        samesite=settings.COOKIE_SAMESITE,
        secure=settings.COOKIE_SECURE,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )
    return result


@router.post("/refresh", response_model=TokenResponse)
def refresh(
    data: RefreshRequest,
    svc: AuthService = Depends(get_auth_service),
) -> TokenResponse:
    """
    Renovar access token usando refresh token.
    """
    return svc.refresh(data.refresh_token)


@router.get("/me", response_model=CurrentUser)
def get_me(
    current_user: CurrentUser = Depends(get_current_active_user),
) -> CurrentUser:
    """
    Obtener información del usuario autenticado.
    
    Requiere autenticación por Authorization header con JWT token válido.
    
    Ejemplo:
    ```
    GET /auth/me
    Authorization: Bearer eyJhbGc...
    ```
    
    Retorna información del usuario actual incluyendo sus roles.
    """
    return current_user


@router.post("/logout")
def logout(response: Response) -> dict:
    """
    Limpiar la sesión.
    
    Retorna:
    - **message**: Confirmación de logout
    """
    response.delete_cookie(
        key=settings.COOKIE_NAME,
        httponly=True,
        samesite=settings.COOKIE_SAMESITE,
        secure=settings.COOKIE_SECURE,
    )
    return {"message": "Sesión cerrada correctamente"}

