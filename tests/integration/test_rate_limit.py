import os

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(autouse=True)
def enable_rate_limiting():
    """Remove SKIP_RATE_LIMIT so rate limiter is active in these tests."""
    from app.core.rate_limit import RateLimitMiddleware
    original = os.environ.pop("SKIP_RATE_LIMIT", None)
    RateLimitMiddleware.reset_all_limiters()
    yield
    if original is not None:
        os.environ["SKIP_RATE_LIMIT"] = original


class TestRateLimitIntegration:
    def test_default_health_endpoint_is_not_rate_limited(self, client: TestClient):
        for _ in range(10):
            response = client.get("/health")
            assert response.status_code == 200

    def test_auth_login_returns_429_when_exceeded(self, client: TestClient):
        for _ in range(5):
            response = client.post(
                "/api/v1/auth/login",
                json={"email": "admin@test.com", "password": "admin123"},
            )
            assert response.status_code == 200

        response = client.post(
            "/api/v1/auth/login",
            json={"email": "admin@test.com", "password": "admin123"},
        )
        assert response.status_code == 429
        data = response.json()
        assert data["error"]["code"] == "rate_limit_exceeded"
        assert "retry_after_seconds" in data["error"]

    def test_rate_limit_headers_are_present(self, client: TestClient):
        response = client.get("/health")
        assert "X-RateLimit-Limit" in response.headers
        assert "X-RateLimit-Remaining" in response.headers

    def test_auth_register_returns_429_when_exceeded(self, client: TestClient):
        for _ in range(5):
            response = client.post(
                "/api/v1/auth/login",
                json={"email": "admin@test.com", "password": "admin123"},
            )
            assert response.status_code == 200

        response = client.post(
            "/api/v1/auth/register",
            json={
                "nombre": "Test", "apellido": "User", "email": "test@limit.com",
                "password": "test123456",
            },
        )
        assert response.status_code == 429

    def test_default_limiter_allows_burst_then_blocks(self, client: TestClient):
        for _ in range(30):
            response = client.get("/health")
            assert response.status_code == 200

        response = client.get("/health")
        assert response.status_code == 429

    def test_retry_after_header_on_rate_limit(self, client: TestClient):
        for _ in range(30):
            client.get("/health")

        response = client.get("/health")
        assert response.status_code == 429
        assert "Retry-After" in response.headers
        retry_after = int(response.headers["Retry-After"])
        assert retry_after > 0
