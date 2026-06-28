import time

import pytest

from app.core.rate_limit.rate_limiter import TokenBucket, RateLimiter


class TestTokenBucket:
    def test_consume_returns_true_when_tokens_available(self):
        bucket = TokenBucket(capacity=5.0, refill_rate=10.0)
        assert bucket.try_consume(1.0) is True

    def test_consume_returns_false_when_empty(self):
        bucket = TokenBucket(capacity=1.0, refill_rate=0.0)
        assert bucket.try_consume(1.0) is True
        assert bucket.try_consume(1.0) is False

    def test_reset_restores_full_tokens(self):
        bucket = TokenBucket(capacity=5.0, refill_rate=0.0)
        for _ in range(5):
            bucket.try_consume(1.0)
        assert bucket.try_consume(1.0) is False
        bucket.reset()
        assert bucket.try_consume(1.0) is True

    def test_refills_over_time(self):
        bucket = TokenBucket(capacity=5.0, refill_rate=10.0)
        for _ in range(5):
            bucket.try_consume(1.0)
        assert bucket.try_consume(1.0) is False
        time.sleep(0.15)
        assert bucket.try_consume(1.0) is True


class TestRateLimiter:
    def test_is_allowed_on_new_key(self):
        limiter = RateLimiter(capacity=5, refill_rate_per_minute=60)
        assert limiter.is_allowed("user:1") is True

    def test_is_allowed_blocks_when_depleted(self):
        limiter = RateLimiter(capacity=3, refill_rate_per_minute=0)
        for _ in range(3):
            assert limiter.is_allowed("user:1") is True
        assert limiter.is_allowed("user:1") is False

    def test_different_keys_have_independent_buckets(self):
        limiter = RateLimiter(capacity=1, refill_rate_per_minute=0)
        assert limiter.is_allowed("user:1") is True
        assert limiter.is_allowed("user:1") is False
        assert limiter.is_allowed("user:2") is True

    def test_reset_all_clears_all_buckets(self):
        limiter = RateLimiter(capacity=1, refill_rate_per_minute=0)
        limiter.is_allowed("user:1")
        limiter.is_allowed("user:2")
        assert limiter.is_allowed("user:1") is False
        assert limiter.is_allowed("user:2") is False
        limiter.reset_all()
        assert limiter.is_allowed("user:1") is True
        assert limiter.is_allowed("user:2") is True

    def test_reset_key_clears_single_bucket(self):
        limiter = RateLimiter(capacity=1, refill_rate_per_minute=0)
        limiter.is_allowed("user:1")
        limiter.is_allowed("user:2")
        assert limiter.is_allowed("user:1") is False
        limiter.reset_key("user:1")
        assert limiter.is_allowed("user:1") is True
        assert limiter.is_allowed("user:2") is False

    def test_reset_key_nonexistent_does_not_raise(self):
        limiter = RateLimiter(capacity=5, refill_rate_per_minute=60)
        limiter.reset_key("nonexistent")
