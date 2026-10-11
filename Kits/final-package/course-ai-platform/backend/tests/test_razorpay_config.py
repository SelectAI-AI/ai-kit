"""
Smoke tests for Razorpay settings and env documentation.

Covers:
  - Settings exposes razorpay_key_id / razorpay_key_secret, read from env
    via the existing pydantic-settings mechanism (Req 12.1)
  - backend/.env.example documents RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET
    with placeholder (non-secret) values (Req 12.2)
  - Test-mode credentials are picked up without code changes (Req 12.5)
"""
import os
from pathlib import Path
from unittest.mock import patch


# Path to backend/.env.example (this file lives in backend/tests/)
ENV_EXAMPLE = Path(__file__).resolve().parent.parent / ".env.example"


# ---------------------------------------------------------------------------
# Settings exposes the Razorpay keys (Req 12.1)
# ---------------------------------------------------------------------------


class TestSettingsExposesRazorpayKeys:
    """Settings exposes razorpay_key_id and razorpay_key_secret fields (Req 12.1)."""

    def test_settings_has_razorpay_fields(self):
        from app.config import Settings

        s = Settings(_env_file=None)
        assert hasattr(s, "razorpay_key_id")
        assert hasattr(s, "razorpay_key_secret")

    def test_razorpay_fields_default_empty_when_env_absent(self):
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop("RAZORPAY_KEY_ID", None)
            os.environ.pop("RAZORPAY_KEY_SECRET", None)
            from app.config import Settings

            s = Settings(_env_file=None)
            assert s.razorpay_key_id == ""
            assert s.razorpay_key_secret == ""

    def test_razorpay_fields_read_from_env(self):
        """Values are sourced from the environment via pydantic-settings (Req 12.1, 12.5)."""
        env = {
            "RAZORPAY_KEY_ID": "rzp_test_abc123",
            "RAZORPAY_KEY_SECRET": "secret_xyz789",
        }
        with patch.dict(os.environ, env):
            from app.config import Settings

            s = Settings(_env_file=None)
            assert s.razorpay_key_id == "rzp_test_abc123"
            assert s.razorpay_key_secret == "secret_xyz789"

    def test_razorpay_fields_are_strings(self):
        from app.config import Settings

        s = Settings(_env_file=None)
        assert isinstance(s.razorpay_key_id, str)
        assert isinstance(s.razorpay_key_secret, str)


# ---------------------------------------------------------------------------
# .env.example documents both keys with placeholder values (Req 12.2)
# ---------------------------------------------------------------------------


class TestEnvExampleDocumentsRazorpayKeys:
    """backend/.env.example documents both keys with placeholders (Req 12.2)."""

    def _read_env_example(self):
        assert ENV_EXAMPLE.exists(), f".env.example not found at {ENV_EXAMPLE}"
        return ENV_EXAMPLE.read_text(encoding="utf-8")

    def test_env_example_documents_key_id(self):
        content = self._read_env_example()
        assert "RAZORPAY_KEY_ID=" in content

    def test_env_example_documents_key_secret(self):
        content = self._read_env_example()
        assert "RAZORPAY_KEY_SECRET=" in content

    def test_env_example_uses_placeholder_values_not_real_secrets(self):
        """Documented values must be non-empty placeholders, not real credentials (Req 12.2)."""
        lines = {
            k: v
            for k, _, v in (
                line.partition("=")
                for line in self._read_env_example().splitlines()
                if line.strip() and not line.strip().startswith("#") and "=" in line
            )
        }
        key_id = lines.get("RAZORPAY_KEY_ID", "")
        key_secret = lines.get("RAZORPAY_KEY_SECRET", "")

        # Placeholders are present and clearly non-secret (look like obvious stand-ins)
        assert key_id, "RAZORPAY_KEY_ID placeholder should not be empty"
        assert key_secret, "RAZORPAY_KEY_SECRET placeholder should not be empty"
        assert "your" in key_id.lower() or "test" in key_id.lower()
        assert "your" in key_secret.lower()
