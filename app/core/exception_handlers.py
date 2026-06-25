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


async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    errors = exc.errors()
    details = []
    for err in errors:
        field = " -> ".join(str(loc) for loc in err.get("loc", []))
        msg = err.get("msg", "Error de validación")
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
