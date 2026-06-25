import warnings

from pydantic import computed_field, model_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    ENVIRONMENT: str = "development"
    SECRET_KEY: str = "change_this_secret_key_for_production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    COOKIE_SECURE: bool = False
    rate_limit_default_burst: int = 30
    rate_limit_default_per_minute: int = 120
    rate_limit_auth_burst: int = 5
    rate_limit_auth_per_minute: int = 5
    COOKIE_SAMESITE: str = "lax"
    COOKIE_NAME: str = "access_token"
    # MercadoPago (nuevos nombres)
    MP_ACCESS_TOKEN: str = ""
    MP_PUBLIC_KEY: str = ""
    MP_WEBHOOK_URL: str = ""
    NGROK_URL: str = ""

    # MercadoPago (nombres anteriores, compatibilidad)
    MERCADOPAGO_ACCESS_TOKEN: str = ""
    MERCADOPAGO_PUBLIC_KEY: str = ""

    # Cloudinary
    CLOUDINARY_CLOUD_NAME: str = ""
    CLOUDINARY_API_KEY: str = ""
    CLOUDINARY_API_SECRET: str = ""

    # URLs para frontend y webhooks
    VITE_FRONTEND_URL: str = "http://localhost:5500"
    VITE_API_URL: str = "http://localhost:8000"

    # Base de datos — se puede sobreescribir desde .env
    # SQLite (por defecto): sqlite:///./food_store.db
    # PostgreSQL: postgresql://postgres:postgres@localhost:5432/food_store_db
    DATABASE_URL: str = "sqlite:///./food_store.db"

    @computed_field
    @property
    def CORS_ORIGINS(self) -> list[str]:
        origins = [
            "http://127.0.0.1:5500",
            "http://127.0.0.1:5501",
            "http://localhost:5500",
            "http://localhost:5501",
            "http://127.0.0.1:3000",
            "http://localhost:3000",
            "http://127.0.0.1:5173",
            "http://localhost:5173",
        ]
        if self.VITE_FRONTEND_URL and self.VITE_FRONTEND_URL not in origins:
            origins.append(self.VITE_FRONTEND_URL)
        if self.NGROK_URL and self.NGROK_URL not in origins:
            origins.append(self.NGROK_URL)
        return origins

    @model_validator(mode="after")
    def _validate_secret_key(self) -> "Settings":
        if self.ENVIRONMENT != "development" and self.SECRET_KEY == "change_this_secret_key_for_production":
            warnings.warn(
                "SECRET_KEY no fue cambiada en modo producción. "
                "Usá una clave segura en el archivo .env",
                RuntimeWarning,
                stacklevel=2,
            )
        return self

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


settings = Settings()
