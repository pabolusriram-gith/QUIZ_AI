"""
Direct API test to see the full error from the 500
"""
import sys
sys.path.insert(0, '.')
import asyncio
import uuid

from fastapi.testclient import TestClient

# We can't use TestClient in async context, so let's just do the endpoint logic directly
async def test_quiz_api():
    from app.database.session import AsyncSessionLocal
    from app.models.quiz import Quiz, Question, QuestionOption
    from app.schemas.quiz import QuizCreate, QuizResponse
    from app.services.question_processor import QuestionProcessor
    from app.core.security import escape_html
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    from app.models.user import User

    quiz_in_data = {
        'title': 'Test Quiz With Questions',
        'description': 'Debug test',
        'subject': 'CS',
        'duration': 10,
        'quiz_code': f'DEBUG2-{uuid.uuid4().hex[:6].upper()}',
        'status': 'published',
        'marks_mode': 'default',
        'default_marks': 1,
        'questions': [{
            'text': 'What is 2+2?',
            'difficulty': 'easy',
            'topic': 'Math',
            'question_type': 'multiple_choice',
            'marks': 1,
            'options': [
                {'text': '4', 'is_correct': True, 'display_order': 0},
                {'text': '3', 'is_correct': False, 'display_order': 1}
            ]
        }]
    }

    quiz_in = QuizCreate(**quiz_in_data)
    
    async with AsyncSessionLocal() as db:
        user_r = await db.execute(select(User).limit(1))
        user = user_r.scalar_one()

        _marks_mode = quiz_in.marks_mode or "default"
        _default_marks = quiz_in.default_marks if quiz_in.default_marks is not None else 1

        db_quiz = Quiz(
            title=escape_html(quiz_in.title),
            description=escape_html(quiz_in.description),
            subject=escape_html(quiz_in.subject),
            duration=quiz_in.duration,
            randomize_questions=quiz_in.randomize_questions,
            randomize_options=quiz_in.randomize_options,
            anti_cheating_enabled=quiz_in.anti_cheating_enabled,
            ai_feedback_enabled=quiz_in.ai_feedback_enabled,
            department=escape_html(quiz_in.department),
            semester=escape_html(quiz_in.semester),
            total_marks=quiz_in.total_marks,
            pass_percentage=quiz_in.pass_percentage,
            visibility=quiz_in.visibility,
            status=quiz_in.status,
            language=escape_html(quiz_in.language),
            fullscreen_required=quiz_in.fullscreen_required,
            adaptive_mode=quiz_in.adaptive_mode,
            allow_review=quiz_in.allow_review,
            start_time=quiz_in.start_time,
            end_time=quiz_in.end_time,
            quiz_code=escape_html(quiz_in.quiz_code),
            published_at=quiz_in.published_at,
            max_attempts=quiz_in.max_attempts,
            timer_mode=quiz_in.timer_mode,
            overall_time_limit_seconds=quiz_in.overall_time_limit_seconds,
            auto_submit_on_expiry=quiz_in.auto_submit_on_expiry,
            available_from=quiz_in.available_from,
            available_until=quiz_in.available_until,
            result_visibility=quiz_in.result_visibility,
            show_score=quiz_in.show_score,
            show_answers=quiz_in.show_answers,
            show_explanations=quiz_in.show_explanations,
            show_solutions=quiz_in.show_solutions,
            show_marks=quiz_in.show_marks,
            shuffle_questions=quiz_in.shuffle_questions,
            shuffle_options=quiz_in.shuffle_options,
            access_code=escape_html(quiz_in.access_code),
            custom_instructions=escape_html(quiz_in.custom_instructions),
            ai_provider=escape_html(quiz_in.ai_provider),
            ai_model=escape_html(quiz_in.ai_model),
            generation_prompt=escape_html(quiz_in.generation_prompt),
            generated_by_ai=quiz_in.generated_by_ai,
            generation_source=escape_html(quiz_in.generation_source),
            generated_at=quiz_in.generated_at,
            created_by_id=user.id
        )
        
        db.add(db_quiz)

        for q_in in quiz_in.questions:
            q_dict = q_in.model_dump()
            processed_q, _ = QuestionProcessor.process_question(
                q_dict,
                marks_mode=_marks_mode,
                default_marks=_default_marks
            )
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
        print("DB commit succeeded")

        # Reload with selectin load to get full structure back
        result = await db.execute(
            select(Quiz)
            .where(Quiz.id == db_quiz.id)
            .options(
                selectinload(Quiz.questions).selectinload(Question.options)
            )
        )
        db_q = result.scalar_one()
        db_q.game_session_pin = None
        print("Reload succeeded, questions count:", len(db_q.questions))
        
        # Try serializing to QuizResponse
        try:
            resp = QuizResponse.model_validate(db_q)
            print("QuizResponse serialization SUCCEEDED")
            print("Questions in response:", len(resp.questions))
        except Exception as ex:
            import traceback
            print("QuizResponse serialization FAILED:")
            traceback.print_exc()

        # Cleanup
        await db.delete(db_q)
        await db.commit()
        print("Cleaned up")

asyncio.run(test_quiz_api())
