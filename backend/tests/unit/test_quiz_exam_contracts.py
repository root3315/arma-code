from app.api.v1.endpoints.quiz import _fallback_explanation
from app.infrastructure.database.models.quiz import QuizQuestion
from app.schemas.quiz import QuizAnswerResponse, QuizAttemptAnswerDetail


def test_fallback_explanation_uses_saved_text() -> None:
    question = QuizQuestion(
        question='Q',
        option_a='A',
        option_b='B',
        option_c='C',
        option_d='D',
        correct_option='B',
        explanation='Because B matches the definition.',
    )

    assert _fallback_explanation(question) == 'Because B matches the definition.'


def test_fallback_explanation_uses_default_when_missing() -> None:
    question = QuizQuestion(
        question='Q',
        option_a='A',
        option_b='B',
        option_c='C',
        option_d='D',
        correct_option='B',
        explanation=None,
    )

    assert _fallback_explanation(question) == 'Correct answer: B'


def test_quiz_answer_response_requires_explanation_fields() -> None:
    response = QuizAnswerResponse(
        question_id='123e4567-e89b-12d3-a456-426614174000',
        question_text='What is Python?',
        is_correct=True,
        correct_option='A programming language',
        selected_option='A programming language',
        explanation='Python is used to write software.',
    )

    assert response.question_text == 'What is Python?'
    assert response.explanation == 'Python is used to write software.'


def test_attempt_detail_allows_optional_explanation() -> None:
    detail = QuizAttemptAnswerDetail(
        question_id='123e4567-e89b-12d3-a456-426614174000',
        selected='A programming language',
        correct=True,
        correct_option='A programming language',
    )

    assert detail.explanation is None
