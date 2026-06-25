import logging
import time

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

logger = logging.getLogger("app.access")


class LoggingMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)

    async def dispatch(self, request: Request, call_next) -> Response:
        start_time = time.perf_counter()
        method = request.method
        path = request.url.path

        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            client_ip = forwarded.split(",")[0].strip()
        elif request.client:
            client_ip = request.client.host
        else:
            client_ip = "unknown"

        response = await call_next(request)
        elapsed_ms = (time.perf_counter() - start_time) * 1000

        logger.info(
            "%s %s -> %d [%.1fms] client=%s",
            method,
            path,
            response.status_code,
            elapsed_ms,
            client_ip,
        )

        return response
