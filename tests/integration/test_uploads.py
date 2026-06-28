"""Tests de integración del módulo uploads (Cloudinary). Cloudinary se mockea."""

from unittest.mock import patch

from fastapi.testclient import TestClient

from app.modules.uploads.service import UploadService

BASE = "/api/v1/uploads"


class TestUploads:
    def test_upload_requires_admin(self, client: TestClient, cliente_auth_headers: dict):
        files = {"file": ("foto.png", b"bytes-falsos", "image/png")}
        r = client.post(f"{BASE}/imagen", headers=cliente_auth_headers, files=files)
        assert r.status_code == 403

    def test_upload_rejects_non_image(self, client: TestClient, admin_auth_headers: dict):
        files = {"file": ("doc.txt", b"hola", "text/plain")}
        r = client.post(f"{BASE}/imagen", headers=admin_auth_headers, files=files)
        assert r.status_code == 400

    def test_upload_ok_mocked(self, client: TestClient, admin_auth_headers: dict):
        fake = {
            "secure_url": "https://res.cloudinary.com/demo/image/upload/x.png",
            "public_id": "food_store/x",
            "width": 100,
            "height": 100,
            "format": "png",
            "resource_type": "image",
        }
        with patch.object(UploadService, "_is_configured", return_value=True), patch(
            "app.modules.uploads.service.cloudinary.uploader.upload", return_value=fake
        ):
            files = {"file": ("foto.png", b"bytes-falsos", "image/png")}
            r = client.post(f"{BASE}/imagen", headers=admin_auth_headers, files=files)
        assert r.status_code == 200
        body = r.json()
        assert body["public_id"] == "food_store/x"
        assert body["secure_url"].startswith("https://")

    def test_delete_ok_mocked(self, client: TestClient, admin_auth_headers: dict):
        with patch.object(UploadService, "_is_configured", return_value=True), patch(
            "app.modules.uploads.service.cloudinary.uploader.destroy", return_value={"result": "ok"}
        ):
            r = client.delete(f"{BASE}/imagen/food_store%2Fx", headers=admin_auth_headers)
        assert r.status_code == 200
