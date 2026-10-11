"""
Property test for the pure Razorpay callback signature helpers — Property 4.
Validates Requirements 6.2, 6.3
"""
from hypothesis import assume, given, settings as hyp_settings, strategies as st

from app.razorpay_signatures import callback_signature, verify_callback


# Arbitrary text including non-ASCII and empty strings, exercising the UTF-8
# encoding path in the helpers.
_text = st.text()


# Feature: kit-pricing-and-payments, Property 4: Callback signature
# verification round-trip and tamper rejection — for any order_id, payment_id,
# and key secret, a signature produced by the callback HMAC-SHA256 scheme over
# order_id + "|" + payment_id verifies as valid, and any alteration to a signed
# field (order_id or payment_id), the signature, or the key secret causes
# verification to fail.
@given(
    order_id=_text,
    payment_id=_text,
    key_secret=_text,
    alt_order_id=_text,
    alt_payment_id=_text,
    alt_key_secret=_text,
    tamper=st.text(alphabet="0123456789abcdef", min_size=1, max_size=8),
)
@hyp_settings(max_examples=200)
def test_signature_roundtrip_and_tamper_rejection(
    order_id,
    payment_id,
    key_secret,
    alt_order_id,
    alt_payment_id,
    alt_key_secret,
    tamper,
):
    """
    Property 4: Callback signature verification round-trip and tamper rejection.

    A correctly produced signature verifies; any alteration to order_id,
    payment_id, the signature, or the key secret fails verification.

    **Validates: Requirements 6.2, 6.3**
    """
    sig = callback_signature(order_id, payment_id, key_secret)

    # Round-trip: a correctly produced signature always verifies (Req 6.2).
    assert verify_callback(order_id, payment_id, sig, key_secret) is True

    # Tamper with order_id: verification must fail whenever the message bytes
    # actually change. Because the signed message is "order_id|payment_id", a
    # different (order_id, payment_id) pair can collide only if it yields the
    # same joined string; guard against that aliasing before asserting failure.
    if f"{alt_order_id}|{payment_id}" != f"{order_id}|{payment_id}":
        assert verify_callback(alt_order_id, payment_id, sig, key_secret) is False

    # Tamper with payment_id (Req 6.3).
    if f"{order_id}|{alt_payment_id}" != f"{order_id}|{payment_id}":
        assert verify_callback(order_id, alt_payment_id, sig, key_secret) is False

    # Tamper with the key secret: a different secret yields a different HMAC.
    # (HMAC collisions across distinct keys are cryptographically negligible.)
    if alt_key_secret != key_secret:
        assert verify_callback(order_id, payment_id, sig, alt_key_secret) is False

    # Tamper with the signature itself by appending extra hex characters; the
    # altered signature can never equal the genuine fixed-length hex digest.
    # (Tamper stays within the hex alphabet so this exercises the real
    # signature comparison rather than compare_digest's non-ASCII guard.)
    tampered_sig = sig + tamper
    assert verify_callback(order_id, payment_id, tampered_sig, key_secret) is False

    # Tamper by mutating a single hex character of the signature.
    assume(len(sig) > 0)
    first = sig[0]
    replacement = "0" if first != "0" else "1"
    mutated_sig = replacement + sig[1:]
    assert verify_callback(order_id, payment_id, mutated_sig, key_secret) is False
