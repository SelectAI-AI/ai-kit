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
