from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    email: EmailStr
    full_name: str
    password: str = Field(min_length=6)
    instructor_code: Optional[str] = None


class UserOut(BaseModel):
    id: str
    email: EmailStr
    full_name: str
    role: str

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class NotebookOut(BaseModel):
    filename: str
    title: str
    description: Optional[str] = None
    order: int
    unlocked: bool
    completed: bool
    question_type: str  # reflection | quiz | self_attest
    prompt: Optional[str] = None
    status: str = "not_submitted"  # not_submitted | pending | approved | rejected
    submission_text: Optional[str] = None
    review_note: Optional[str] = None


class ModuleSummary(BaseModel):
    slug: str
    title: str
    total_notebooks: int
    completed_notebooks: int
    percent_complete: float


class ModuleDetail(BaseModel):
    slug: str
    title: str
    intro_markdown: str
    notebooks: List[NotebookOut]
    percent_complete: float


class UnlockSubmission(BaseModel):
    response: str = ""
    self_attest: bool = False


class UnlockResult(BaseModel):
    success: bool
    message: str
    next_unlocked: Optional[str] = None


class ProgressOverview(BaseModel):
    modules: List[ModuleSummary]
    overall_percent: float
    eligible_for_certificate: bool


class CertificateRequestIn(BaseModel):
    confirm_identity: bool
    legal_name: str


class CertificateOut(BaseModel):
    id: str
    status: str
    issued_at: Optional[datetime] = None
    revoked_at: Optional[datetime] = None
    revoked_reason: Optional[str] = None

    class Config:
        from_attributes = True


class StudentSummary(BaseModel):
    id: str
    email: EmailStr
    full_name: str
    overall_percent: float
    pending_certificate: Optional[str] = None


class PendingSubmissionOut(BaseModel):
    progress_id: int
    user_id: str
    user_name: str
    user_email: EmailStr
    module_slug: str
    module_title: str
    notebook_file: str
    notebook_title: str
    question_type: Optional[str] = None
    submission_text: str
    submitted_at: Optional[datetime] = None


class ReviewIn(BaseModel):
    note: Optional[str] = None


class NotebookReviewResult(BaseModel):
    progress_id: int
    status: str
    next_unlocked: Optional[str] = None


# --- Kit pricing and payments (feature: kit-pricing-and-payments) ----------
# All monetary amounts are integer paise (INR only). No schema below exposes
# `razorpay_key_secret` — only `key_id` is ever returned to the client (Req 12.3, 12.4).


class KitView(BaseModel):
    """A single kit in the public catalog (Req 1.2, 1.6)."""

    kit_id: str
    name: str
    slugs: List[str]
    base_price_paise: int
    purchasable: bool

    class Config:
        from_attributes = True


class CatalogOut(BaseModel):
    """Public pricing catalog response (Req 1.6, 11.1)."""

    kits: List[KitView]
    bundle_slugs: List[str]
    bundle_base_paise: int

    class Config:
        from_attributes = True


class DiscountRequestIn(BaseModel):
    """Student-submitted discount eligibility request (Req 2.1)."""

    details: Optional[str] = None


class DiscountRequestOut(BaseModel):
    """Discount request status view (Req 2.4, 3.1)."""

    id: str
    user_id: str
    details: Optional[str] = None
    status: str  # pending | approved | rejected
    granted_tier: Optional[str] = None  # student_t1 | student_t2 when approved
    created_at: Optional[datetime] = None
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class OrderCreateIn(BaseModel):
    """Purchase intent. The client supplies only a selection; any client-supplied
    amount is ignored and the server computes the authoritative amount (Req 4.7, 5.1)."""

    selection: str  # kit id | "bundle"


class OrderCreateOut(BaseModel):
    """Razorpay order creation response. Exposes `key_id` only — never the key
    secret (Req 5.3, 12.4)."""

    razorpay_order_id: str
    amount_paise: int
    currency: str = "INR"
    key_id: str

    class Config:
        from_attributes = True


class CallbackIn(BaseModel):
    """Razorpay Standard Checkout success payload (Req 6.2)."""

    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


class BulkOrderIn(BaseModel):
    """Admin-created college/corporate bulk order (Req 10.1, 10.4)."""

    user_ids: List[str]
    seats: Optional[int] = None  # corporate per-kit seat count


class EntitlementOut(BaseModel):
    """Granted entitlement view (Req 8.3)."""

    id: str
    user_id: str
    order_id: str
    selection: str  # kit id | "bundle"
    slugs_csv: str  # snapshot of covered slugs at grant time
    active: bool
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AccessDecisionOut(BaseModel):
    """Access-gating decision for a module slug (Req 9.1, 9.2)."""

    allowed: bool
    required_kit_id: Optional[str] = None

    class Config:
        from_attributes = True
