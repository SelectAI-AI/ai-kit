"""
tests/test_pii.py — validates the PII redaction logic you complete in
Notebook 2. Skips with a reminder until you run the notebook's Section 5b
`%%writefile` cell, which graduates your redact()/coverage() into
security_utils/pii_solution.py.
"""
import re

import pytest

from security_utils.pii import DEFAULT_PII_PATTERNS, RegexRecognizer, mask_text

try:
    from security_utils.pii_solution import coverage, redact
except ModuleNotFoundError:
    pytest.skip(
        "security_utils/pii_solution.py not found. Complete Notebook 2 and "
        "run its Section 5b cell to graduate your solution first.",
        allow_module_level=True,
    )

RECORD = (
    "Ticket #4471 from Jane Doe (jane.doe@northwind.com). "
    "Verified identity with SSN 123-45-6789. Callback number 555-123-4567. "
    "Corporate card on file 4111 1111 1111 1111. Last login from 10.0.0.42."
)


@pytest.mark.parametrize(
    "raw", ["123-45-6789", "jane.doe@northwind.com", "4111 1111 1111 1111"]
)
def test_structured_pii_is_removed(raw):
    assert raw not in redact(RECORD)


def test_full_coverage_on_record():
    assert coverage(RECORD, redact(RECORD)) == 1.0


def test_clean_text_is_unchanged_and_full_coverage():
    clean = "Remote work eligibility requires 12 months tenure."
    assert redact(clean) == clean
    assert coverage(clean, redact(clean)) == 1.0


def test_custom_employee_id_pattern_masks():
    """The stretch goal: a custom EMP-##### entity should be maskable."""
    patterns = dict(DEFAULT_PII_PATTERNS)
    patterns["EMPLOYEE_ID"] = re.compile(r"\bEMP-\d{5}\b")
    rr = RegexRecognizer(patterns=patterns)
    sample = "Escalating ticket for EMP-04471."
    assert "EMP-04471" not in mask_text(sample, rr.detect(sample))
