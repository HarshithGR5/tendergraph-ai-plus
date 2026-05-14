"""
KYC API Router
==============
Exposes KYC verification endpoints for use during bidder onboarding.
All endpoints run in sandbox mode unless PRODUCTION_KYC=true is set.
"""
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.api.auth import get_current_user, require_role
from backend.config import settings
from backend.database import get_db
from backend.models.tables import User, UserRole
from backend.services.kyc_service import (
    verify_gstin,
    verify_pan,
    check_debarment,
    run_full_kyc,
)

router = APIRouter(prefix="/kyc", tags=["kyc"])

SANDBOX_MODE = getattr(settings, "production_kyc", False) is False


class GSTINRequest(BaseModel):
    gstin: str


class PANRequest(BaseModel):
    pan: str


class DebarmentRequest(BaseModel):
    company_name: str


class FullKYCRequest(BaseModel):
    company_name: str
    gstin: Optional[str] = None
    pan: Optional[str] = None
    cin: Optional[str] = None


@router.post("/verify-gstin")
def verify_gstin_endpoint(
    payload: GSTINRequest,
    current_user: User = Depends(require_role(
        UserRole.PROCUREMENT_OFFICER, UserRole.SENIOR_OFFICER, UserRole.SYSTEM_ADMIN
    )),
):
    return verify_gstin(payload.gstin, sandbox=SANDBOX_MODE)


@router.post("/verify-pan")
def verify_pan_endpoint(
    payload: PANRequest,
    current_user: User = Depends(require_role(
        UserRole.PROCUREMENT_OFFICER, UserRole.SENIOR_OFFICER, UserRole.SYSTEM_ADMIN
    )),
):
    return verify_pan(payload.pan, sandbox=SANDBOX_MODE)


@router.post("/check-debarment")
def check_debarment_endpoint(
    payload: DebarmentRequest,
    current_user: User = Depends(require_role(
        UserRole.PROCUREMENT_OFFICER, UserRole.SENIOR_OFFICER, UserRole.SYSTEM_ADMIN
    )),
):
    return check_debarment(payload.company_name, sandbox=SANDBOX_MODE)


@router.post("/full-check")
def full_kyc_check(
    payload: FullKYCRequest,
    current_user: User = Depends(require_role(
        UserRole.PROCUREMENT_OFFICER, UserRole.SENIOR_OFFICER, UserRole.SYSTEM_ADMIN
    )),
):
    return run_full_kyc(
        company_name=payload.company_name,
        gstin=payload.gstin,
        pan=payload.pan,
        cin=payload.cin,
        sandbox=SANDBOX_MODE,
    )
