"""
OpenAI integration service
"""
import logging
from typing import List, Dict, Optional
from openai import AsyncOpenAI

from app.core.config import settings

logger = logging.getLogger(__name__)

# Initialize OpenAI client
client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)


class OpenAIService:
    """Service для работы с OpenAI API"""

    def __init__(self):
        self.client = client

    async def generate_summary(self, text: str, language: str = "auto") -> str:
        """
        Генерация краткого резюме материала.

        Args:
            text: Исходный текст
            language: Язык (auto - автоопределение)

        Returns:
            str: Резюме
        """
        try:
            # Ограничить длину текста (макс 50K символов)
            text_chunk = text[:50000]

            response = await self.client.chat.completions.create(
                model=settings.LLM_MODEL_MINI,  # gpt-4o-mini
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are an expert at creating concise summaries of educational materials. "
                            "Create a summary in the SAME LANGUAGE as the source text. "
                            "The summary should capture the main ideas and key points."
                        ),
                    },
                    {
                        "role": "user",
                        "content": f"Create a concise summary (3-5 paragraphs) of the following text:\n\n{text_chunk}",
                    },
                ],
                temperature=0.7,
                max_tokens=1500,
            )

            summary = response.choices[0].message.content.strip()
            logger.info(f"[OpenAI] Generated summary ({len(summary)} chars)")
            return summary

        except Exception as e:
            logger.error(f"[OpenAI] Error generating summary: {str(e)}")
            raise

    async def generate_notes(self, text: str) -> str:
        """
        Генерация структурированных конспектов.

        Args:
            text: Исходный текст

        Returns:
            str: Конспекты в markdown формате
        """
        try:
            text_chunk = text[:50000]

            response = await self.client.chat.completions.create(
                model=settings.LLM_MODEL_MINI,
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are an expert at creating structured study notes. "
                            "Create notes in the SAME LANGUAGE as the source text. "
                            "Use markdown format with headings, bullet points, and numbered lists. "
                            "Organize information hierarchically and highlight key concepts."
                        ),
                    },
                    {
                        "role": "user",
                        "content": f"Create detailed study notes from the following text:\n\n{text_chunk}",
                    },
                ],
                temperature=0.7,
                max_tokens=2000,
            )

            notes = response.choices[0].message.content.strip()
            logger.info(f"[OpenAI] Generated notes ({len(notes)} chars)")
            return notes

        except Exception as e:
            logger.error(f"[OpenAI] Error generating notes: {str(e)}")
            raise

    async def generate_flashcards(self, text: str, count: int = 10) -> List[Dict[str, str]]:
        """
        Генерация flashcards (вопрос-ответ).

        Args:
            text: Исходный текст
            count: Количество карточек

        Returns:
            List[Dict]: Список карточек [{"question": "...", "answer": "..."}]
        """
        try:
            text_chunk = text[:50000]

            response = await self.client.chat.completions.create(
                model=settings.LLM_MODEL,  # gpt-4o для лучшего качества
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are an expert at creating educational flashcards. "
                            "Generate flashcards in JSON format with 'flashcards' array. "
                            "Each flashcard must have 'question' and 'answer' fields. "
                            f"Create exactly {count} flashcards. "
                            "The questions and answers MUST be in the SAME LANGUAGE as the source text. "
                            "Return only valid JSON, no additional text."
                        ),
                    },
                    {
                        "role": "user",
                        "content": f"Create {count} flashcards based on this text:\n\n{text_chunk}",
                    },
                ],
                temperature=0.7,
                max_tokens=2000,
                response_format={"type": "json_object"},
            )

            content = response.choices[0].message.content
            import json
            data = json.loads(content)
            flashcards = data.get("flashcards", [])

            # Validate
            validated = []
            for card in flashcards:
                if "question" in card and "answer" in card:
                    validated.append({
                        "question": card["question"],
                        "answer": card["answer"]
                    })

            logger.info(f"[OpenAI] Generated {len(validated)} flashcards")
            return validated

        except Exception as e:
            logger.error(f"[OpenAI] Error generating flashcards: {str(e)}")
            raise

    async def generate_quiz(self, text: str, count: int = 10) -> List[Dict]:
        """
        Генерация quiz вопросов (multiple choice).

        Args:
            text: Исходный текст
            count: Количество вопросов

        Returns:
            List[Dict]: Вопросы с вариантами ответа
        """
        try:
            text_chunk = text[:50000]

            response = await self.client.chat.completions.create(
                model=settings.LLM_MODEL,
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are an expert at creating educational quiz questions. "
                            "Generate questions in JSON format with 'questions' array. "
                            "Each question must have: question (text), option_a, option_b, option_c, option_d (all text), "
                            "correct_option (the FULL TEXT of the correct answer, copied exactly from one of the options), "
                            "and explanation (1-2 short sentences explaining why the answer is correct). "
                            f"Create exactly {count} questions. "
                            "The questions and answers MUST be in the SAME LANGUAGE as the source text. "
                            "Return only valid JSON, no additional text."
                        ),
                    },
                    {
                        "role": "user",
                        "content": f"Create {count} multiple-choice quiz questions based on this text:\n\n{text_chunk}",
                    },
                ],
                temperature=0.7,
                max_tokens=3000,
                response_format={"type": "json_object"},
            )

            content = response.choices[0].message.content
            import json
            data = json.loads(content)
            questions = data.get("questions", [])

            # Validate
            validated = []
            for q in questions:
                required_keys = [
                    "question",
                    "option_a",
                    "option_b",
                    "option_c",
                    "option_d",
                    "correct_option",
                    "explanation",
                ]
                if all(k in q for k in required_keys):
                    # correct_option should be the full text matching one of the options
                    correct = q["correct_option"]
                    options = [q["option_a"], q["option_b"], q["option_c"], q["option_d"]]
                    # If AI returned a letter, convert to text
                    if correct in ["a", "b", "c", "d"]:
                        option_map = {"a": q["option_a"], "b": q["option_b"], "c": q["option_c"], "d": q["option_d"]}
                        q["correct_option"] = option_map[correct]
                    explanation = q.get("explanation")
                    if not isinstance(explanation, str):
                        continue
                    q["explanation"] = explanation.strip()

                    # Validate that correct_option matches one of the options and explanation exists
                    if q["correct_option"] in options and q["explanation"]:
                        validated.append(q)

            logger.info(f"[OpenAI] Generated {len(validated)} quiz questions")
            return validated

        except Exception as e:
            logger.error(f"[OpenAI] Error generating quiz: {str(e)}")
            raise

    async def create_embedding(self, text: str) -> List[float]:
        """
        Создание векторного embedding для текста.

        Args:
            text: Текст для embedding

        Returns:
            List[float]: Вектор (3072 dimensions)
        """
        try:
            response = await self.client.embeddings.create(
                model=settings.EMBEDDING_MODEL,  # text-embedding-3-large
                input=text,
                encoding_format="float",
            )

            embedding = response.data[0].embedding
            logger.debug(f"[OpenAI] Created embedding (dim={len(embedding)})")
            return embedding

        except Exception as e:
            logger.error(f"[OpenAI] Error creating embedding: {str(e)}")
            raise

    async def create_embeddings_batch(self, texts: List[str]) -> List[List[float]]:
        """
        Создание embeddings для нескольких текстов (batch).

        Args:
            texts: Список текстов

        Returns:
            List[List[float]]: Список векторов
        """
        try:
            response = await self.client.embeddings.create(
                model=settings.EMBEDDING_MODEL,
                input=texts,
                encoding_format="float",
            )

            embeddings = [item.embedding for item in response.data]
            logger.info(f"[OpenAI] Created {len(embeddings)} embeddings in batch")
            return embeddings

        except Exception as e:
            logger.error(f"[OpenAI] Error creating batch embeddings: {str(e)}")
            raise

    async def chat_with_context(
        self,
        question: str,
        context: str,
        conversation_history: Optional[List[Dict]] = None,
    ) -> str:
        """
        RAG chat с контекстом из материала.

        Args:
            question: Вопрос пользователя
            context: Релевантный контекст из документа
            conversation_history: История диалога

        Returns:
            str: Ответ AI тьютора
        """
        try:
            messages = [
                {
                    "role": "system",
                    "content": (
                        "You are an intelligent tutor helping students understand educational materials. "
                        "Answer questions based ONLY on the provided context from the document. "
                        "If the context doesn't contain the answer, say so. "
                        "Respond in the SAME LANGUAGE as the question. "
                        "Be concise but helpful."
                    ),
                }
            ]

            # Add conversation history
            if conversation_history:
                messages.extend(conversation_history[-10:])  # Last 10 messages

            # Add current question with context
            messages.append({
                "role": "user",
                "content": f"Context from document:\n{context}\n\nQuestion: {question}"
            })

            response = await self.client.chat.completions.create(
                model=settings.LLM_MODEL,
                messages=messages,
                temperature=0.7,
                max_tokens=1000,
            )

            answer = response.choices[0].message.content.strip()
            logger.info(f"[OpenAI] Generated RAG answer ({len(answer)} chars)")
            return answer

        except Exception as e:
            logger.error(f"[OpenAI] Error in RAG chat: {str(e)}")
            raise
