from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database.db import UserProfile, Experience, Qualification, SchoolEducation, User


async def get_or_create_profile(session: AsyncSession, user_id) -> UserProfile:
    result = await session.execute(
        select(UserProfile).where(UserProfile.user_id == user_id)
    )
    profile = result.scalar_one_or_none()
    if profile is None:
        profile = UserProfile(user_id=user_id)
        session.add(profile)
        await session.commit()
        await session.refresh(profile)
    return profile


async def update_basic_info(session: AsyncSession, user: User, data: dict) -> UserProfile:
    # Update user-level fields
    if "first_name" in data:
        user.first_name = data["first_name"]
    if "last_name" in data:
        user.last_name = data["last_name"]
    session.add(user)

    # Update profile-level fields
    profile = await get_or_create_profile(session, user.id)
    profile_fields = ("bio", "contact", "location", "gender", "headline")
    for field in profile_fields:
        if field in data:
            setattr(profile, field, data[field])
    session.add(profile)

    await session.commit()
    await session.refresh(profile)
    return profile


async def add_experience(session: AsyncSession, user_id, data: dict) -> Experience:
    exp = Experience(
        user_id=user_id,
        company_name=data.get("company_name", ""),
        designation=data.get("designation", ""),
        years=data.get("years", 0),
        months=data.get("months", 0),
    )
    session.add(exp)
    await session.commit()
    await session.refresh(exp)
    return exp


async def update_experience(session: AsyncSession, user_id, exp_id: int, data: dict) -> Experience:
    result = await session.execute(
        select(Experience).where(Experience.id == exp_id, Experience.user_id == user_id)
    )
    exp = result.scalar_one_or_none()
    if exp is None:
        return None
    for field in ("company_name", "designation", "years", "months"):
        if field in data:
            setattr(exp, field, data[field])
    session.add(exp)
    await session.commit()
    await session.refresh(exp)
    return exp


async def delete_experience(session: AsyncSession, user_id, exp_id: int):
    result = await session.execute(
        select(Experience).where(Experience.id == exp_id, Experience.user_id == user_id)
    )
    exp = result.scalar_one_or_none()
    if exp is not None:
        await session.delete(exp)
        await session.commit()


async def add_qualification(session: AsyncSession, user_id, data: dict) -> Qualification:
    qual = Qualification(
        user_id=user_id,
        institution=data.get("institution", ""),
        degree=data.get("degree", ""),
        field_of_study=data.get("field_of_study"),
        year=data.get("year"),
    )
    session.add(qual)
    await session.commit()
    await session.refresh(qual)
    return qual


async def update_qualification(session: AsyncSession, user_id, qual_id: int, data: dict) -> Qualification:
    result = await session.execute(
        select(Qualification).where(Qualification.id == qual_id, Qualification.user_id == user_id)
    )
    qual = result.scalar_one_or_none()
    if qual is None:
        return None
    for field in ("institution", "degree", "field_of_study", "year"):
        if field in data:
            setattr(qual, field, data[field])
    session.add(qual)
    await session.commit()
    await session.refresh(qual)
    return qual


async def delete_qualification(session: AsyncSession, user_id, qual_id: int):
    result = await session.execute(
        select(Qualification).where(Qualification.id == qual_id, Qualification.user_id == user_id)
    )
    qual = result.scalar_one_or_none()
    if qual is not None:
        await session.delete(qual)
        await session.commit()


async def upsert_school(session: AsyncSession, user_id, grade: str, data: dict) -> SchoolEducation:
    result = await session.execute(
        select(SchoolEducation).where(
            SchoolEducation.user_id == user_id,
            SchoolEducation.grade == grade,
        )
    )
    school = result.scalar_one_or_none()
    if school is None:
        school = SchoolEducation(user_id=user_id, grade=grade)
        session.add(school)

    for field in ("school_name", "board", "percentage", "year"):
        if field in data:
            setattr(school, field, data[field])

    await session.commit()
    await session.refresh(school)
    return school


async def delete_school(session: AsyncSession, user_id, school_id: int):
    result = await session.execute(
        select(SchoolEducation).where(
            SchoolEducation.id == school_id,
            SchoolEducation.user_id == user_id,
        )
    )
    school = result.scalar_one_or_none()
    if school is not None:
        await session.delete(school)
        await session.commit()


async def get_full_profile(session: AsyncSession, user: User) -> dict:
    profile = await get_or_create_profile(session, user.id)

    exp_result = await session.execute(
        select(Experience).where(Experience.user_id == user.id)
    )
    experiences = exp_result.scalars().all()

    qual_result = await session.execute(
        select(Qualification).where(Qualification.user_id == user.id)
    )
    qualifications = qual_result.scalars().all()

    school_result = await session.execute(
        select(SchoolEducation).where(SchoolEducation.user_id == user.id)
    )
    schools = school_result.scalars().all()

    return {
        "id": str(user.id),
        "email": user.email,
        "role": user.role,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "is_active": user.is_active,
        "is_superuser": user.is_superuser,
        "profile": {
            "bio": profile.bio,
            "contact": profile.contact,
            "location": profile.location,
            "gender": profile.gender,
            "headline": profile.headline,
        },
        "experiences": [
            {
                "id": exp.id,
                "company_name": exp.company_name,
                "designation": exp.designation,
                "years": exp.years,
                "months": exp.months,
            }
            for exp in experiences
        ],
        "qualifications": [
            {
                "id": qual.id,
                "institution": qual.institution,
                "degree": qual.degree,
                "field_of_study": qual.field_of_study,
                "year": qual.year,
            }
            for qual in qualifications
        ],
        "school_education": [
            {
                "id": school.id,
                "grade": school.grade,
                "school_name": school.school_name,
                "board": school.board,
                "percentage": school.percentage,
                "year": school.year,
            }
            for school in schools
        ],
    }
