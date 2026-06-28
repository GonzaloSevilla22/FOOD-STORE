import pytest
from fastapi.testclient import TestClient


class TestRegister:
    def test_register_success_returns_201(self, client: TestClient, cliente_data: dict):
        response = client.post("/api/v1/auth/register", json=cliente_data)
        assert response.status_code == 201
        data = response.json()
        assert data["email"] == cliente_data["email"]
        assert data["nombre"] == cliente_data["nombre"]
        assert "password" not in data
        assert data["activo"] is True

    def test_register_duplicate_email_returns_400(self, client: TestClient, cliente_data: dict):
        client.post("/api/v1/auth/register", json=cliente_data)
        response = client.post("/api/v1/auth/register", json=cliente_data)
        assert response.status_code == 400

    @pytest.mark.parametrize("payload", [
        {"email": "x@x.com", "password": "12345678"},
        {"nombre": "X", "password": "12345678"},
        {"nombre": "X", "email": "x@x.com"},
    ])
    def test_register_invalid_input_returns_422(self, client: TestClient, payload: dict):
        response = client.post("/api/v1/auth/register", json=payload)
        assert response.status_code == 422


class TestLogin:
    def test_login_success_returns_token(self, client: TestClient):
        response = client.post(
            "/api/v1/auth/login",
            json={"email": "admin@test.com", "password": "admin123"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "Bearer"
        assert "access_token" in response.cookies

    def test_login_wrong_password_returns_401(self, client: TestClient):
        response = client.post(
            "/api/v1/auth/login",
            json={"email": "admin@test.com", "password": "wrong"},
        )
        assert response.status_code == 401

    def test_login_nonexistent_user_returns_401(self, client: TestClient):
        response = client.post(
            "/api/v1/auth/login",
            json={"email": "ghost@test.com", "password": "anything"},
        )
        assert response.status_code == 401


class TestMe:
    def test_me_with_valid_token(self, client: TestClient, admin_auth_headers: dict):
        response = client.get("/api/v1/auth/me", headers=admin_auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "admin@test.com"

    def test_me_without_token_returns_401(self, client: TestClient):
        response = client.get("/api/v1/auth/me")
        assert response.status_code == 401


class TestRBAC:
    def test_cliente_cannot_access_admin_endpoints(self, client: TestClient, cliente_auth_headers: dict):
        response = client.get("/api/v1/usuarios", headers=cliente_auth_headers)
        assert response.status_code == 403

    def test_admin_can_access_admin_endpoints(self, client: TestClient, admin_auth_headers: dict):
        response = client.get("/api/v1/usuarios", headers=admin_auth_headers)
        assert response.status_code == 200
