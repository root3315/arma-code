"""Quiz management endpoints."""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from uuid import UUID

from app.api.dependencies import get_db, get_current_active_user, verify_material_owner
from app.infrastructure.database.models.user import User
from app.infrastructure.database.models.quiz import QuizQuestion
from app.schemas.quiz import (
    QuizQuestionCreate,
    QuizQuestionResponse,
    QuizQuestionWithAnswerResponse,
    QuizListResponse,
    QuizListWithAnswersResponse,
    QuizAnswerRequest,
    QuizAnswerResponse,
    QuizAttemptRequest,
    QuizAttemptResponse,
    QuizAttemptSaveRequest,
    QuizAttemptHistoryResponse,
    QuizStatisticsResponse,
)
from app.schemas.common import MessageResponse


router = APIRouter()


def _fallback_explanation(question: QuizQuestion) -> str:
    """Return stored explanation when available, otherwise a safe fallback."""
    return question.explanation or f"Correct answer: {question.correct_option}"


@router.get("/materials/{material_id}/quiz", response_model=QuizListWithAnswersResponse)
async def get_quiz_questions(
    material_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get all quiz questions for a material with correct answers.

    Args:
        material_id: Material ID
        db: Database session
        current_user: Current authenticated user

    Returns:
        QuizListWithAnswersResponse: List of quiz questions with correct answers

    Raises:
        HTTPException: If material not found or access denied
    """
    await verify_material_owner(material_id, current_user, db)

    # Get questions
    result = await db.execute(
        select(QuizQuestion)
        .where(QuizQuestion.material_id == material_id)
        .order_by(QuizQuestion.created_at.asc())
    )
    questions = result.scalars().all()

    # Get total count
    count_result = await db.execute(
        select(func.count()).select_from(QuizQuestion).where(QuizQuestion.material_id == material_id)
    )
    total = count_result.scalar()

    return {"questions": questions, "total": total}


@router.get("/materials/{material_id}/quiz/exam", response_model=QuizListResponse)
async def get_exam_quiz_questions(
    material_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get quiz questions without correct answers for exam mode."""
    await verify_material_owner(material_id, current_user, db)

    result = await db.execute(
        select(QuizQuestion)
        .where(QuizQuestion.material_id == material_id)
        .order_by(QuizQuestion.created_at.asc())
    )
    questions = result.scalars().all()

    count_result = await db.execute(
        select(func.count()).select_from(QuizQuestion).where(QuizQuestion.material_id == material_id)
    )
    total = count_result.scalar()

    return {"questions": questions, "total": total}


@router.post("/quiz", response_model=QuizQuestionResponse, status_code=status.HTTP_201_CREATED)
async def create_quiz_question(
    question_data: QuizQuestionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Create a new quiz question.

    Args:
        question_data: Quiz question data
        db: Database session
        current_user: Current authenticated user

    Returns:
        QuizQuestionResponse: Created quiz question

    Raises:
        HTTPException: If material not found or access denied
    """
    await verify_material_owner(question_data.material_id, current_user, db)

    new_question = QuizQuestion(
        material_id=question_data.material_id,
        question=question_data.question,
        option_a=question_data.option_a,
        option_b=question_data.option_b,
        option_c=question_data.option_c,
        option_d=question_data.option_d,
        correct_option=question_data.correct_option
    )

    db.add(new_question)
    await db.commit()
    await db.refresh(new_question)

    return new_question


@router.get("/quiz/{question_id}", response_model=QuizQuestionResponse)
async def get_quiz_question(
    question_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get a specific quiz question (without correct answer).

    Args:
        question_id: Question ID
        db: Database session
        current_user: Current authenticated user

    Returns:
        QuizQuestionResponse: Question data

    Raises:
        HTTPException: If question not found or access denied
    """
    result = await db.execute(
        select(QuizQuestion).where(QuizQuestion.id == question_id)
    )
    question = result.scalar_one_or_none()

    if not question:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quiz question not found"
        )

    # Verify ownership through material
    await verify_material_owner(question.material_id, current_user, db)

    return question


@router.post("/quiz/check", response_model=QuizAnswerResponse)
async def check_answer(
    answer_data: QuizAnswerRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Check a single quiz answer.

    Args:
        answer_data: Answer data
        db: Database session
        current_user: Current authenticated user

    Returns:
        QuizAnswerResponse: Answer result

    Raises:
        HTTPException: If question not found or access denied
    """
    result = await db.execute(
        select(QuizQuestion).where(QuizQuestion.id == answer_data.question_id)
    )
    question = result.scalar_one_or_none()

    if not question:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quiz question not found"
        )

    # Verify ownership through material
    await verify_material_owner(question.material_id, current_user, db)

    # Check answer
    is_correct = answer_data.selected_option == question.correct_option

    return {
        "question_id": question.id,
        "question_text": question.question,
        "is_correct": is_correct,
        "correct_option": question.correct_option,
        "selected_option": answer_data.selected_option,
        "explanation": _fallback_explanation(question),
    }


@router.post("/quiz/attempt", response_model=QuizAttemptResponse)
async def submit_quiz_attempt(
    attempt_data: QuizAttemptRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Submit a full quiz attempt and get results.

    Args:
        attempt_data: Quiz attempt data with all answers
        db: Database session
        current_user: Current authenticated user

    Returns:
        QuizAttemptResponse: Quiz results

    Raises:
        HTTPException: If any question not found or access denied
    """
    if not attempt_data.answers:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No answers provided"
        )

    results = []
    correct_count = 0

    for answer in attempt_data.answers:
        # Get question
        result = await db.execute(
            select(QuizQuestion).where(QuizQuestion.id == answer.question_id)
        )
        question = result.scalar_one_or_none()

        if not question:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Quiz question {answer.question_id} not found"
            )

        # Verify ownership
        await verify_material_owner(question.material_id, current_user, db)

        # Check answer
        is_correct = answer.selected_option == question.correct_option
        if is_correct:
            correct_count += 1

        results.append({
            "question_id": question.id,
            "question_text": question.question,
            "is_correct": is_correct,
            "correct_option": question.correct_option,
            "selected_option": answer.selected_option,
            "explanation": _fallback_explanation(question),
        })

    # Calculate score
    total_questions = len(attempt_data.answers)
    score_percentage = (correct_count / total_questions) * 100 if total_questions > 0 else 0

    return {
        "total_questions": total_questions,
        "correct_answers": correct_count,
        "score_percentage": round(score_percentage, 2),
        "results": results
    }


@router.delete("/quiz/{question_id}", response_model=MessageResponse)
async def delete_quiz_question(
    question_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Delete a quiz question.

    Args:
        question_id: Question ID
        db: Database session
        current_user: Current authenticated user

    Returns:
        MessageResponse: Success message

    Raises:
        HTTPException: If question not found or access denied
    """
    result = await db.execute(
        select(QuizQuestion).where(QuizQuestion.id == question_id)
    )
    question = result.scalar_one_or_none()

    if not question:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quiz question not found"
        )

    # Verify ownership through material
    await verify_material_owner(question.material_id, current_user, db)

    await db.delete(question)
    await db.commit()

    return {"message": "Quiz question deleted successfully"}


# ===== Quiz Attempt Endpoints (Scoring System) =====

@router.post("/quiz/attempts/save", response_model=QuizAttemptHistoryResponse, status_code=status.HTTP_201_CREATED)
async def save_quiz_attempt(
    attempt_data: QuizAttemptSaveRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Save quiz attempt result to database.

    Args:
        attempt_data: Quiz attempt data with score and answers
        db: Database session
        current_user: Current authenticated user

    Returns:
        QuizAttemptHistoryResponse: Saved attempt

    Raises:
        HTTPException: If material not found or access denied
    """
    from app.domain.services.quiz_service import QuizService

    # Verify material ownership
    await verify_material_owner(attempt_data.material_id, current_user, db)

    # Save attempt through service
    service = QuizService(db)
    try:
        saved_attempt = await service.save_quiz_attempt(current_user.id, attempt_data)
        return saved_attempt
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save quiz attempt: {str(e)}"
        )


@router.get("/materials/{material_id}/quiz/attempts", response_model=List[QuizAttemptHistoryResponse])
async def get_quiz_attempts_history(
    material_id: UUID,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get quiz attempts history for a material.

    Args:
        material_id: Material ID
        limit: Maximum number of attempts to return
        db: Database session
        current_user: Current authenticated user

    Returns:
        List[QuizAttemptHistoryResponse]: List of attempts

    Raises:
        HTTPException: If material not found or access denied
    """
    from app.domain.services.quiz_service import QuizService

    await verify_material_owner(material_id, current_user, db)

    service = QuizService(db)
    attempts = await service.get_user_attempts(
        user_id=current_user.id,
        material_id=material_id,
        limit=limit
    )

    return attempts


@router.get("/materials/{material_id}/quiz/statistics", response_model=QuizStatisticsResponse)
async def get_quiz_statistics(
    material_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get quiz statistics for a material.

    Args:
        material_id: Material ID
        db: Database session
        current_user: Current authenticated user

    Returns:
        QuizStatisticsResponse: Statistics with best score, average, etc.

    Raises:
        HTTPException: If material not found or access denied
    """
    from app.domain.services.quiz_service import QuizService

    await verify_material_owner(material_id, current_user, db)

    service = QuizService(db)
    statistics = await service.get_quiz_statistics(
        user_id=current_user.id,
        material_id=material_id
    )

    return statistics


@router.delete("/quiz/attempts/{attempt_id}", response_model=MessageResponse)
async def delete_quiz_attempt(
    attempt_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Delete a quiz attempt.

    Args:
        attempt_id: Attempt ID
        db: Database session
        current_user: Current authenticated user

    Returns:
        MessageResponse: Success message

    Raises:
        HTTPException: If attempt not found or access denied
    """
    from app.domain.services.quiz_service import QuizService

    service = QuizService(db)
    try:
        success = await service.delete_attempt(attempt_id, current_user.id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Quiz attempt not found"
            )
        return {"message": "Quiz attempt deleted successfully"}
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )
