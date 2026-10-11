"""Pure Razorpay signature helpers.

This module contains no network I/O. It implements the Razorpay Standard
Checkout callback signature scheme as documented by Razorpay:

    HMAC_SHA256(order_id + "|" + payment_id, key_secret)

Verification uses a constant-time comparison (`hmac.compare_digest`). The
server-side payment-status fetch (`client.payment.fetch(...)`) deliberately
lives elsewhere (the Payment_Service) so these helpers stay pure and fully
property-testable.

Requirements: 6.2, 6.3
"""

import hashlib
import hmac


def callback_signature(order_id: str, payment_id: str, key_secret: str) -> str:
    """Compute the Standard Checkout callback signature.

    Returns the lowercase hex digest of
    ``HMAC_SHA256(order_id + "|" + payment_id, key_secret)`` (Req 6.2).
    """
    msg = f"{order_id}|{payment_id}".encode("utf-8")
    return hmac.new(key_secret.encode("utf-8"), msg, hashlib.sha256).hexdigest()


def verify_callback(
    order_id: str, payment_id: str, signature: str, key_secret: str
) -> bool:
    """Verify a Standard Checkout callback signature.

    Recomputes the expected signature and compares it to ``signature`` using a
    constant-time comparison. Any alteration to ``order_id``, ``payment_id``,
    ``signature``, or ``key_secret`` causes verification to fail (Req 6.3).
    """
    expected = callback_signature(order_id, payment_id, key_secret)
    return hmac.compare_digest(expected, signature)
