import logging
import traceback

from fastapi import HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger(__name__)


def _build_error(code: str, message: str, details: list | None = None) -> dict:
    error = {"code": code, "message": message}
    if details:
        error["details"] = details
    return {"error": error}


async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    status_code = exc.status_code

    code_map = {
        status.HTTP_401_UNAUTHORIZED: "unauthorized",
        status.HTTP_403_FORBIDDEN: "forbidden",
        status.HTTP_404_NOT_FOUND: "not_found",
        status.HTTP_429_TOO_MANY_REQUESTS: "rate_limit_exceeded",
    }
    code = code_map.get(status_code, f"http_{status_code}")

    detail = exc.detail
    if isinstance(detail, str):
        message = detail
        details = None
    elif isinstance(detail, list):
        message = "Error de validación"
        details = detail
    else:
        message = str(detail)
        details = None

    logger.warning(
        "HTTP %d | %s %s | %s",
        status_code,
        request.method,
        request.url.path,
        message,
    )

    return JSONResponse(
        status_code=status_code,
        content=_build_error(code, message, details),
        headers=getattr(exc, "headers", None) or {},
    )


_FIELD_LABELS = {
    "alias": "Alias",
    "linea1": "Dirección",
    "linea2": "Dpto / Piso",
    "ciudad": "Ciudad",
    "provincia": "Provincia",
    "codigo_postal": "Código postal",
    "nombre": "Nombre",
    "apellido": "Apellido",
    "email": "Email",
    "celular": "Celular",
    "password": "Contraseña",
}


def _validation_msg(err: dict) -> str:
    loc = err.get("loc", [])
    field_name = str(loc[-1]) if loc else ""
    label = _FIELD_LABELS.get(field_name, field_name)
    err_type = err.get("type", "")
    ctx = err.get("ctx", {}) or {}

    if err_type == "missing":
        return f"El campo {label} es obligatorio."
    if err_type in ("string_too_short", "too_short"):
        min_len = ctx.get("min_length", "")
        return f"El campo {label} debe tener al menos {min_len} caracteres."
    if err_type in ("string_too_long", "too_long"):
        max_len = ctx.get("max_length", "")
        return f"El campo {label} debe tener menos de {max_len} caracteres."
    if err_type == "string_pattern_mismatch":
        return f"El campo {label} no tiene un formato válido."
    return f"El campo {label} no es válido."


async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    errors = exc.errors()
    details = []
    for err in errors:
        field = " -> ".join(str(loc) for loc in err.get("loc", []))
        msg = _validation_msg(err)
        details.append({"field": field, "message": msg})

        logger.warning(
            "Validation error | %s %s | field=%s msg=%s",
            request.method,
            request.url.path,
            field,
            msg,
        )

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=_build_error("validation_error", "Error de validación", details),
    )


async def general_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.error(
        "Unhandled exception | %s %s | %s\n%s",
        request.method,
        request.url.path,
        str(exc),
        traceback.format_exc(),
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=_build_error(
            "internal_error", "Error interno del servidor"
        ),
    )


def register_exception_handlers(app) -> None:
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    app.add_exception_handler(HTTPException, http_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(Exception, general_exception_handler)
