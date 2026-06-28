"""
Rate limiter basado en Token Bucket en memoria.

ADVERTENCIA: Almacena los buckets en memoria local del proceso.
Si la app se ejecuta con múltiples workers (gunicorn, uvicorn --workers N),
cada worker tendrá sus propios buckets independientes, por lo que el límite
se aplica por worker y no globalmente.

Para entornos multi-worker/productivos, reemplazar el diccionario en memoria
por un backend compartido como Redis (ej: usando redis-py + TokenBucket en Lua).
"""

import threading
import time
from dataclasses import dataclass, field


@dataclass
class TokenBucket:
    capacity: float
    refill_rate: float
    tokens: float = field(init=False)
    last_refill: float = field(init=False)
    _lock: threading.Lock = field(init=False, repr=False)

    def __post_init__(self) -> None:
        self.tokens = float(self.capacity)
        self.last_refill = time.perf_counter()
        self._lock = threading.Lock()

    def try_consume(self, tokens: float = 1.0) -> bool:
        with self._lock:
            now = time.perf_counter()
            elapsed = now - self.last_refill
            self.tokens = min(
                self.capacity,
                self.tokens + elapsed * self.refill_rate,
            )
            self.last_refill = now

            if self.tokens >= tokens:
                self.tokens -= tokens
                return True
            return False

    def reset(self) -> None:
        with self._lock:
            self.tokens = float(self.capacity)
            self.last_refill = time.perf_counter()


class RateLimiter:
    def __init__(self, capacity: int, refill_rate_per_minute: int) -> None:
        self.capacity = float(capacity)
        self.refill_rate = refill_rate_per_minute / 60.0
        self._buckets: dict[str, TokenBucket] = {}
        self._buckets_lock = threading.Lock()

    def _get_bucket(self, key: str) -> TokenBucket:
        with self._buckets_lock:
            if key not in self._buckets:
                self._buckets[key] = TokenBucket(
                    capacity=self.capacity,
                    refill_rate=self.refill_rate,
                )
            return self._buckets[key]

    def is_allowed(self, key: str) -> bool:
        bucket = self._get_bucket(key)
        return bucket.try_consume(1.0)

    def reset_all(self) -> None:
        with self._buckets_lock:
            for bucket in self._buckets.values():
                bucket.reset()

    def reset_key(self, key: str) -> None:
        with self._buckets_lock:
            if key in self._buckets:
                self._buckets[key].reset()
