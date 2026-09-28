"""
Unit tests for:
  - Settings.demo_mode config flag (Requirements 1.1, 1.2, 1.5)
  - GET /health demo_mode field (Requirement 5.1)
"""
import os
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError


# ---------------------------------------------------------------------------
# Settings tests
# ---------------------------------------------------------------------------


class TestSettingsDemoModeDefault:
    """Settings.demo_mode defaults to False when DEMO_MODE is absent (Req 1.2)."""

    def test_demo_mode_defaults_false_when_env_absent(self):
        # Ensure DEMO_MODE is not in the environment, then instantiate Settings
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop("DEMO_MODE", None)
            from app.config import Settings

            s = Settings(_env_file=None)
            assert s.demo_mode is False


class TestSettingsDemoModeTruthy:
    """Recognised truthy values each resolve to True (Req 1.1)."""

    @pytest.mark.parametrize("value", ["true", "True", "TRUE", "1", "yes", "Yes", "YES"])
    def test_truthy_values_resolve_to_true(self, value):
        with patch.dict(os.environ, {"DEMO_MODE": value}):
            from app.config import Settings

            s = Settings(_env_file=None)
            assert s.demo_mode is True

    @pytest.mark.parametrize("value", ["false", "False", "FALSE", "0", "no", "No", "NO"])
    def test_falsy_values_resolve_to_false(self, value):
        with patch.dict(os.environ, {"DEMO_MODE": value}):
            from app.config import Settings

            s = Settings(_env_file=None)
            assert s.demo_mode is False


class TestSettingsDemoModeInvalidValue:
    """Unrecognised DEMO_MODE value raises ValidationError (Req 1.5)."""

    @pytest.mark.parametrize("value", ["enabled", "yes_please", "2", "demo"])
    def test_invalid_value_raises_validation_error(self, value):
        with patch.dict(os.environ, {"DEMO_MODE": value}):
            from app.config import Settings

            with pytest.raises(ValidationError):
                Settings(_env_file=None)


# ---------------------------------------------------------------------------
# Health endpoint tests
# ---------------------------------------------------------------------------


class TestHealthEndpointDemoMode:
    """GET /health includes demo_mode boolean field (Req 5.1)."""

    def _make_client(self):
        """Import app fresh; use TestClient."""
        from app.main import app

        return TestClient(app)

    def test_health_returns_demo_mode_true_when_patched(self):
        from app.main import app
        import app.main as main_module

        client = TestClient(app)
        with patch.object(main_module.settings, "demo_mode", True):
            response = client.get("/health")

        assert response.status_code == 200
        data = response.json()
        assert data["demo_mode"] is True

    def test_health_returns_demo_mode_false_normally(self):
        from app.main import app
        import app.main as main_module

        client = TestClient(app)
        with patch.object(main_module.settings, "demo_mode", False):
            response = client.get("/health")

        assert response.status_code == 200
        data = response.json()
        assert data["demo_mode"] is False

    def test_health_response_contains_required_fields(self):
        from app.main import app

        client = TestClient(app)
        response = client.get("/health")

        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert "demo_mode" in data
        assert isinstance(data["demo_mode"], bool)
