"""
Debug the 500 error on quiz creation with questions
"""
import sys
sys.path.insert(0, '.')
import asyncio
import uuid

async def test_create_quiz_with_question():
    from app.database.session import AsyncSessionLocal
    from app.models.quiz import Quiz, Question, QuestionOption
    from app.services.question_processor import QuestionProcessor
    from app.core.security import escape_html

    q_in = {
        'text': 'What is 2+2?',
        'difficulty': 'easy',
        'topic': 'Math',
        'question_type': 'multiple_choice',
        'marks': 1,
        'options': [
            {'text': '4', 'is_correct': True, 'display_order': 0},
            {'text': '3', 'is_correct': False, 'display_order': 1}
        ]
    }

    try:
        processed_q, count = QuestionProcessor.process_question(
            q_in, marks_mode='default', default_marks=1
        )
        print("QuestionProcessor OK:", processed_q.keys())
    except Exception as ex:
        print("QuestionProcessor FAIL:", ex)
        return

    async with AsyncSessionLocal() as db:
        # Get a user to use as creator
        from sqlalchemy import select
        from app.models.user import User
        r = await db.execute(select(User).limit(1))
        user = r.scalar_one_or_none()
        if not user:
            print("No user found!")
            return

        db_quiz = Quiz(
            title="Debug Test Quiz",
            subject="Test",
            duration=10,
            quiz_code=f"DEBUG-{uuid.uuid4().hex[:6].upper()}",
            status="published",
            marks_mode="default",
            default_marks=1,
            created_by_id=user.id
        )
        db.add(db_quiz)

        try:
            db_question = Question(
                text=escape_html(processed_q.get("text")),
                difficulty=escape_html(processed_q.get("difficulty")),
                topic=escape_html(processed_q.get("topic")),
                marks=processed_q.get("marks"),
                explanation=escape_html(processed_q.get("explanation")),
                question_type=escape_html(processed_q.get("question_type")),
                bloom_level=escape_html(processed_q.get("bloom_level")),
                subtopic=escape_html(processed_q.get("subtopic")),
                estimated_time=processed_q.get("estimated_time"),
                negative_marks=processed_q.get("negative_marks"),
                hint=escape_html(processed_q.get("hint")),
                ai_generated=processed_q.get("ai_generated"),
                version=processed_q.get("version"),
                order_index=processed_q.get("order_index"),
                time_limit_seconds=processed_q.get("time_limit_seconds"),
                course_outcome=escape_html(processed_q.get("course_outcome")),
                reference=escape_html(processed_q.get("reference")),
                ai_provider=escape_html(processed_q.get("ai_provider")),
                ai_model=escape_html(processed_q.get("ai_model")),
                generated_by_ai=processed_q.get("generated_by_ai"),
                generated_at=processed_q.get("generated_at"),
                critic_score=processed_q.get("critic_score"),
                is_user_modified=processed_q.get("is_user_modified", False),
                quiz=db_quiz
            )
            db.add(db_question)

            for opt_in in processed_q.get("options", []):
                db_option = QuestionOption(
                    text=escape_html(opt_in.get("text")),
                    is_correct=opt_in.get("is_correct"),
                    display_order=opt_in.get("display_order"),
                    question=db_question
                )
                db.add(db_option)

            await db.commit()
            print("SUCCESS! Quiz + question + options created")
            # Rollback test data
            await db.delete(db_quiz)
            await db.commit()
            print("Cleaned up test data")
        except Exception as ex:
            import traceback
            print("FAIL at DB commit:")
            traceback.print_exc()
            await db.rollback()

asyncio.run(test_create_quiz_with_question())
