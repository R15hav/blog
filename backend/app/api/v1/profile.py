from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.users import current_active_user
from app.database.db import User, get_async_session
from app.services.profile import (
    get_full_profile,
    update_basic_info,
    add_experience,
    update_experience,
    delete_experience,
    add_qualification,
    update_qualification,
    delete_qualification,
    upsert_school,
    delete_school,
)

router = APIRouter()


# ── Pydantic schemas ───────────────────────────────────────────────────────────

class BasicInfoUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    contact: Optional[str] = None
    location: Optional[str] = None
    gender: Optional[str] = None
    headline: Optional[str] = None
    bio: Optional[str] = None


class ExperienceCreate(BaseModel):
    company_name: str
    designation: str
    years: int = 0
    months: int = 0


class QualificationCreate(BaseModel):
    institution: str
    degree: str
    field_of_study: Optional[str] = None
    year: Optional[int] = None


class SchoolCreate(BaseModel):
    grade: str  # "10th" or "12th"
    school_name: Optional[str] = None
    board: Optional[str] = None
    percentage: Optional[str] = None
    year: Optional[int] = None


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.get("/profile/me")
async def get_my_profile(
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    return await get_full_profile(session, user)


@router.put("/profile/me")
async def update_my_profile(
    data: BasicInfoUpdate,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    await update_basic_info(session, user, data.model_dump(exclude_none=False))
    return await get_full_profile(session, user)


@router.post("/profile/experience")
async def create_experience(
    data: ExperienceCreate,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    exp = await add_experience(session, user.id, data.model_dump())
    return {"id": exp.id, "company_name": exp.company_name, "designation": exp.designation,
            "years": exp.years, "months": exp.months}


@router.put("/profile/experience/{exp_id}")
async def edit_experience(
    exp_id: int,
    data: ExperienceCreate,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    exp = await update_experience(session, user.id, exp_id, data.model_dump())
    if exp is None:
        raise HTTPException(status_code=404, detail="Experience not found")
    return {"id": exp.id, "company_name": exp.company_name, "designation": exp.designation,
            "years": exp.years, "months": exp.months}


@router.delete("/profile/experience/{exp_id}")
async def remove_experience(
    exp_id: int,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    await delete_experience(session, user.id, exp_id)
    return {"detail": "deleted"}


@router.post("/profile/qualification")
async def create_qualification(
    data: QualificationCreate,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    qual = await add_qualification(session, user.id, data.model_dump())
    return {"id": qual.id, "institution": qual.institution, "degree": qual.degree,
            "field_of_study": qual.field_of_study, "year": qual.year}


@router.put("/profile/qualification/{qual_id}")
async def edit_qualification(
    qual_id: int,
    data: QualificationCreate,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    qual = await update_qualification(session, user.id, qual_id, data.model_dump())
    if qual is None:
        raise HTTPException(status_code=404, detail="Qualification not found")
    return {"id": qual.id, "institution": qual.institution, "degree": qual.degree,
            "field_of_study": qual.field_of_study, "year": qual.year}


@router.delete("/profile/qualification/{qual_id}")
async def remove_qualification(
    qual_id: int,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    await delete_qualification(session, user.id, qual_id)
    return {"detail": "deleted"}


@router.post("/profile/school")
async def create_or_update_school(
    data: SchoolCreate,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    payload = data.model_dump()
    grade = payload.pop("grade")
    school = await upsert_school(session, user.id, grade, payload)
    return {"id": school.id, "grade": school.grade, "school_name": school.school_name,
            "board": school.board, "percentage": school.percentage, "year": school.year}


@router.delete("/profile/school/{school_id}")
async def remove_school(
    school_id: int,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    await delete_school(session, user.id, school_id)
    return {"detail": "deleted"}
