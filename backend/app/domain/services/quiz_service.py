"""
Service для бизнес-логики Quiz Scoring
"""
from typing import List, Optional
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.models.quiz import QuizQuestion
from app.infrastructure.database.models.quiz_attempt import QuizAttempt
from app.infrastructure.repositories.quiz_attempt_repository import QuizAttemptRepository
from app.schemas.quiz import (
    QuizAnswerRequest,
    QuizAnswerResponse,
    QuizAttemptResponse,
    QuizAttemptSaveRequest,
    QuizAttemptHistoryResponse,
    QuizStatisticsResponse,
    QuizAttemptAnswerDetail,
)


class QuizService:
    """Service для работы с quiz и подсчета результатов."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self.repository = QuizAttemptRepository(session)

    async def check_answer(
        self, question_id: UUID, selected_option: str
    ) -> QuizAnswerResponse:
        """
        Проверить одиночный ответ на вопрос.

        Args:
            question_id: ID вопроса
            selected_option: Выбранный вариант (a/b/c/d)

        Returns:
            QuizAnswerResponse с результатом
        """
        # Получить вопрос
        result = await self.session.execute(
            select(QuizQuestion).where(QuizQuestion.id == question_id)
        )
        question = result.scalar_one_or_none()

        if not question:
            raise ValueError(f"Question {question_id} not found")

        is_correct = selected_option == question.correct_option
        explanation = question.explanation.strip() if question.explanation else f"Correct answer: {question.correct_option}"

        return QuizAnswerResponse(
            question_id=question_id,
            question_text=question.question,
            is_correct=is_correct,
            correct_option=question.correct_option,
            selected_option=selected_option,
            explanation=explanation,
        )

    async def check_quiz_attempt(
        self, answers: List[QuizAnswerRequest]
    ) -> QuizAttemptResponse:
        """
        Проверить полную попытку прохождения quiz.

        Args:
            answers: Список ответов пользователя

        Returns:
            QuizAttemptResponse с результатами
        """
        if not answers:
            raise ValueError("No answers provided")

        results = []
        correct_count = 0

        for answer in answers:
            result = await self.check_answer(answer.question_id, answer.selected_option)
            results.append(result)
            if result.is_correct:
                correct_count += 1

        total = len(answers)
        percentage = round((correct_count / total) * 100, 2) if total > 0 else 0.0

        return QuizAttemptResponse(
            total_questions=total,
            correct_answers=correct_count,
            score_percentage=percentage,
            results=results,
        )

    async def save_quiz_attempt(
        self, user_id: UUID, request: QuizAttemptSaveRequest
    ) -> QuizAttemptHistoryResponse:
        """
        Сохранить результат quiz попытки в БД.

        Args:
            user_id: ID пользователя
            request: Данные попытки

        Returns:
            QuizAttemptHistoryResponse с сохраненной попыткой
        """
        # Конвертировать answers в dict для JSON column
        answers_json = [answer.model_dump() for answer in request.answers]

        # Создать попытку через repository
        attempt = await self.repository.create(
            user_id=user_id,
            material_id=request.material_id,
            score=request.score,
            total_questions=request.total_questions,
            percentage=request.percentage,
            answers=answers_json,
        )

        # Конвертировать в response schema
        return QuizAttemptHistoryResponse.model_validate(attempt)

    async def get_user_attempts(
        self, user_id: UUID, material_id: Optional[UUID] = None, limit: int = 100
    ) -> List[QuizAttemptHistoryResponse]:
        """
        Получить историю попыток пользователя.

        Args:
            user_id: ID пользователя
            material_id: ID материала (опционально)
            limit: Максимум записей

        Returns:
            Список попыток
        """
        attempts = await self.repository.get_user_attempts(
            user_id=user_id, material_id=material_id, limit=limit
        )

        return [QuizAttemptHistoryResponse.model_validate(a) for a in attempts]

    async def get_quiz_statistics(
        self, user_id: UUID, material_id: UUID
    ) -> QuizStatisticsResponse:
        """
        Получить статистику по quiz для материала.

        Args:
            user_id: ID пользователя
            material_id: ID материала

        Returns:
            QuizStatisticsResponse со статистикой
        """
        # Получить статистику
        stats = await self.repository.get_statistics(user_id, material_id)

        # Получить все попытки
        attempts = await self.repository.get_material_attempts(
            material_id=material_id, user_id=user_id
        )

        # Последняя попытка
        last_attempt = None
        if attempts:
            last_attempt = QuizAttemptHistoryResponse.model_validate(attempts[0])

        # Конвертировать все попытки
        attempts_list = [QuizAttemptHistoryResponse.model_validate(a) for a in attempts]

        return QuizStatisticsResponse(
            total_attempts=stats["total_attempts"],
            best_score=stats["best_score"],
            best_percentage=stats["best_percentage"],
            average_score=stats["average_score"],
            average_percentage=stats["average_percentage"],
            last_attempt=last_attempt,
            attempts=attempts_list,
        )

    async def get_best_attempt(
        self, user_id: UUID, material_id: UUID
    ) -> Optional[QuizAttemptHistoryResponse]:
        """
        Получить лучшую попытку пользователя.

        Args:
            user_id: ID пользователя
            material_id: ID материала

        Returns:
            Лучшая попытка или None
        """
        attempt = await self.repository.get_best_attempt(user_id, material_id)

        if not attempt:
            return None

        return QuizAttemptHistoryResponse.model_validate(attempt)

    async def delete_attempt(self, attempt_id: UUID, user_id: UUID) -> bool:
        """
        Удалить попытку (только владелец).

        Args:
            attempt_id: ID попытки
            user_id: ID пользователя

        Returns:
            True если удалено
        """
        # Проверить владение
        attempt = await self.repository.get_by_id(attempt_id)
        if not attempt or attempt.user_id != user_id:
            raise ValueError("Attempt not found or access denied")

        return await self.repository.delete(attempt_id)

    async def calculate_score_from_answers(
        self, answers: List[QuizAnswerRequest]
    ) -> tuple[int, int, int, List[QuizAttemptAnswerDetail]]:
        """
        Вспомогательная функция для подсчета score и подготовки деталей.

        Args:
            answers: Список ответов

        Returns:
            Tuple: (score, total, percentage, answer_details)
        """
        answer_details = []
        correct_count = 0

        for answer in answers:
            result = await self.check_answer(answer.question_id, answer.selected_option)

            answer_detail = QuizAttemptAnswerDetail(
                question_id=answer.question_id,
                selected=answer.selected_option,
                correct=result.is_correct,
                correct_option=result.correct_option,
                explanation=result.explanation,
            )
            answer_details.append(answer_detail)

            if result.is_correct:
                correct_count += 1

        total = len(answers)
        percentage = round((correct_count / total) * 100) if total > 0 else 0

        return correct_count, total, percentage, answer_details
