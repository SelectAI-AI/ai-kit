"""Entitlement_Service.

Grants and evaluates entitlements for paid/bulk orders. An entitlement records a
*snapshot* of the module slugs covered by the originating order's selection at
grant time (Req 8.3), so later catalog changes never retroactively alter what a
purchase granted. Granting is idempotent: at most one active entitlement exists
per ``(user, order)`` (enforced both here and by the DB uniqueness constraint
``uq_entitlement_user_order``), so replayed payment confirmations grant exactly
once (Req 7.3, 8.1).
"""

from sqlalchemy.orm import Session

from . import pricing_catalog
from .models import Entitlement
from .pricing_catalog import BUNDLE_SELECTION


def _slugs_for_selection(selection: str) -> list[str]:
    """Covered slugs for a selection snapshot.

    For a kit selection the slugs come from ``get_kit(selection).slugs``; for the
    bundle they come from ``bundle_slugs()`` (all sellable slugs plus the
    capstone). An unknown selection yields an empty list.
    """
    if selection == BUNDLE_SELECTION:
        return list(pricing_catalog.bundle_slugs())
    kit = pricing_catalog.get_kit(selection)
    if kit is None:
        return []
    return list(kit.slugs)


def _slugs_to_csv(slugs: list[str]) -> str:
    return ",".join(slugs)


def _csv_to_slugs(slugs_csv: str | None) -> list[str]:
    if not slugs_csv:
        return []
    return [s for s in slugs_csv.split(",") if s]


def grant_for_order(db: Session, order) -> Entitlement:
    """Idempotently grant one active entitlement for ``order`` (Req 8.1-8.3).

    Creates a single active entitlement for the order's buyer covering a snapshot
    of the selection's slugs. If an entitlement already exists for
    ``(order.user_id, order.id)`` this is a no-op and the existing entitlement is
    returned, guaranteeing exactly-once granting under replayed confirmations
    (Req 7.3).
    """
    existing = (
        db.query(Entitlement)
        .filter(
            Entitlement.user_id == order.user_id,
            Entitlement.order_id == order.id,
        )
        .first()
    )
    if existing is not None:
        return existing

    slugs = _slugs_for_selection(order.selection)
    entitlement = Entitlement(
        user_id=order.user_id,
        order_id=order.id,
        selection=order.selection,
        slugs_csv=_slugs_to_csv(slugs),
        active=True,
    )
    db.add(entitlement)
    db.commit()
    db.refresh(entitlement)
    return entitlement


def grant_bulk(db: Session, order, user_ids: list[str]) -> list[Entitlement]:
    """Grant each listed user an active entitlement for a bulk ``order`` (Req 10.5).

    Each user gets a snapshot of the order's selection slugs. Granting per user is
    idempotent: a user who already holds an entitlement for this order keeps their
    existing one. The ``(user, order)`` uniqueness constraint still holds because
    each granted entitlement is keyed on a distinct user id for the same order.
    """
    slugs = _slugs_for_selection(order.selection)
    slugs_csv = _slugs_to_csv(slugs)

    granted: list[Entitlement] = []
    for user_id in user_ids:
        existing = (
            db.query(Entitlement)
            .filter(
                Entitlement.user_id == user_id,
                Entitlement.order_id == order.id,
            )
            .first()
        )
        if existing is not None:
            granted.append(existing)
            continue
        entitlement = Entitlement(
            user_id=user_id,
            order_id=order.id,
            selection=order.selection,
            slugs_csv=slugs_csv,
            active=True,
        )
        db.add(entitlement)
        granted.append(entitlement)

    db.commit()
    for entitlement in granted:
        db.refresh(entitlement)
    return granted


def covered_slugs_for_user(db: Session, user_id: str) -> set[str]:
    """Union of covered slugs across the user's active entitlements (Req 8.4, 9.1)."""
    rows = (
        db.query(Entitlement)
        .filter(
            Entitlement.user_id == user_id,
            Entitlement.active.is_(True),
        )
        .all()
    )
    covered: set[str] = set()
    for row in rows:
        covered.update(_csv_to_slugs(row.slugs_csv))
    return covered
