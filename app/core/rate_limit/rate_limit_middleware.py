import logging
import os
from typing import Awaitable, Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from app.core.config import settings
from app.core.rate_limit.rate_limiter import RateLimiter

logger = logging.getLogger(__name__)


class RateLimitMiddleware(BaseHTTPMiddleware):
    _instances: list["RateLimitMiddleware"] = []

    AUTH_PATHS: tuple[str, ...] = ("/api/v1/auth/login", "/api/v1/auth/register")
    EXCLUDED_PATHS: set[str] = {
        "/", "/favicon.ico", "/openapi.json", "/docs", "/redoc",
    }

    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)
        self.default_limiter = RateLimiter(
            capacity=settings.rate_limit_default_burst,
            refill_rate_per_minute=settings.rate_limit_default_per_minute,
        )
        self.auth_limiter = RateLimiter(
            capacity=settings.rate_limit_auth_burst,
            refill_rate_per_minute=settings.rate_limit_auth_per_minute,
        )
        RateLimitMiddleware._instances.append(self)

    @classmethod
    def reset_all_limiters(cls) -> None:
        for instance in cls._instances:
            instance.default_limiter.reset_all()
            instance.auth_limiter.reset_all()

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        if os.environ.get("SKIP_RATE_LIMIT") == "1":
            return await call_next(request)
        if request.url.path in self.EXCLUDED_PATHS:
            return await call_next(request)

        limiter = (
            self.auth_limiter
            if any(request.url.path.startswith(p) for p in self.AUTH_PATHS)
            else self.default_limiter
        )

        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            client_key = f"ip:{forwarded.split(',')[0].strip()}"
        elif request.client:
            client_key = f"ip:{request.client.host}"
        else:
            client_key = "ip:unknown"

        if not limiter.is_allowed(client_key):
            seconds_until_next_token = max(1, int(1 / max(limiter.refill_rate, 0.001)))
            logger.warning(
                "Rate limit exceeded | client=%s path=%s method=%s retry_after=%ds",
                client_key, request.url.path, request.method, seconds_until_next_token,
            )
            request_id = request.headers.get("x-request-id", "")
            return Response(
                content=(
                    '{"error":{'
                    '"code":"rate_limit_exceeded",'
                    '"message":"Demasiadas peticiones. Intenta de nuevo más tarde.",'
                    f'"retry_after_seconds":{seconds_until_next_token},'
                    f'"retry_after":{seconds_until_next_token},'
                    f'"request_id":"{request_id}"'
                    '}}'
                ),
                status_code=429,
                media_type="application/json",
                headers={
                    "Retry-After": str(seconds_until_next_token),
                    "X-RateLimit-Limit": str(limiter.capacity),
                    "X-RateLimit-Remaining": "0",
                },
            )

        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(limiter.capacity)
        remaining = max(0, int(limiter.capacity - 1))
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        return response
