import uuid
from datetime import datetime
from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, or_, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user, check_role
from app.database.session import get_db
from app.models.user import User
from app.models.quiz import Quiz, Question, QuestionOption, QuizAttempt, GameSession, GameSessionStatus
from app.schemas.quiz import QuizCreate, QuizUpdate, QuizResponse, QuestionResponse, QuestionUpdate

router = APIRouter()

async def get_active_session_pin(quiz_id: uuid.UUID, db: AsyncSession) -> Optional[str]:
    res = await db.execute(
        select(GameSession.game_pin)
        .where(
            GameSession.quiz_id == quiz_id,
            GameSession.status.in_([GameSessionStatus.WAITING.value, GameSessionStatus.ACTIVE.value])
        )
        .limit(1)
    )
    return res.scalar_one_or_none()


from app.services.question_processor import QuestionProcessor

# ---------------------------------------------------------------------------
# Question Bank Endpoints
# ---------------------------------------------------------------------------

@router.get("/questions", response_model=dict)
async def list_all_questions(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None, description="Search in question text or topic"),
    difficulty: Optional[str] = Query(None, description="Filter by difficulty: easy, medium, hard"),
    question_type: Optional[str] = Query(None, description="Filter by question type"),
    quiz_id: Optional[uuid.UUID] = Query(None, description="Filter by quiz ID"),
    current_user: User = Depends(check_role(["teacher", "admin"])),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """List all questions across all quizzes (teachers/admins only), with search/filter/pagination."""

    # Count query
    count_q = select(func.count()).select_from(Question).join(Quiz, Question.quiz_id == Quiz.id)
    # Data query
    data_q = (
        select(Question)
        .join(Quiz, Question.quiz_id == Quiz.id)
        .options(selectinload(Question.options))
    )

    # Apply filters
    filters = []
    if search:
        like_pat = f"%{search}%"
        filters.append(or_(Question.text.ilike(like_pat), Question.topic.ilike(like_pat)))
    if difficulty:
        filters.append(Question.difficulty == difficulty)
    if question_type:
        filters.append(Question.question_type == question_type)
    if quiz_id:
        filters.append(Question.quiz_id == quiz_id)

    if filters:
        from sqlalchemy import and_
        combined = and_(*filters)
        count_q = count_q.where(combined)
        data_q = data_q.where(combined)

    total_result = await db.execute(count_q)
    total = total_result.scalar_one()

    data_q = data_q.order_by(Question.created_at.desc()).offset(skip).limit(limit)
    questions_result = await db.execute(data_q)
    questions = questions_result.scalars().all()

    # Build enriched response with quiz title
    quiz_ids = list({q.quiz_id for q in questions})
    quizzes_result = await db.execute(select(Quiz).where(Quiz.id.in_(quiz_ids)))
    quizzes_map = {q.id: q for q in quizzes_result.scalars().all()}

    items = []
    for q in questions:
        quiz = quizzes_map.get(q.quiz_id)
        item = {
            "id": str(q.id),
            "quiz_id": str(q.quiz_id),
            "quiz_title": quiz.title if quiz else "Unknown",
            "quiz_subject": quiz.subject if quiz else "",
            "text": q.text,
            "difficulty": q.difficulty,
            "topic": q.topic,
            "marks": q.marks,
            "explanation": q.explanation,
            "question_type": q.question_type,
            "bloom_level": q.bloom_level,
            "subtopic": q.subtopic,
            "estimated_time": q.estimated_time,
            "negative_marks": q.negative_marks,
            "hint": q.hint,
            "ai_generated": q.ai_generated,
            "generated_by_ai": q.generated_by_ai,
            "order_index": q.order_index,
            "created_at": q.created_at.isoformat() if q.created_at else None,
            "updated_at": q.updated_at.isoformat() if q.updated_at else None,
            "options": [
                {
                    "id": str(o.id),
                    "text": o.text,
                    "is_correct": o.is_correct,
                    "display_order": o.display_order,
                }
                for o in sorted(q.options, key=lambda o: o.display_order)
            ],
        }
        items.append(item)

    return {"total": total, "skip": skip, "limit": limit, "items": items}


@router.patch("/{quiz_id}/questions/{question_id}", response_model=dict)
async def update_question(
    quiz_id: uuid.UUID,
    question_id: uuid.UUID,
    question_in: QuestionUpdate,
    current_user: User = Depends(check_role(["teacher", "admin"])),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Update a single question (and its options) within a quiz. Teachers/admins only."""
    result = await db.execute(
        select(Question)
        .where(Question.id == question_id, Question.quiz_id == quiz_id)
        .options(selectinload(Question.options))
    )
    db_question = result.scalar_one_or_none()
    if not db_question:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")

    # Quiz ownership check
    quiz_res = await db.execute(select(Quiz).where(Quiz.id == quiz_id))
    db_quiz = quiz_res.scalar_one_or_none()
    if not db_quiz:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quiz not found")
    if db_quiz.created_by_id != current_user.id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. You do not own this quiz."
        )

    # Update scalar fields
    update_data = question_in.model_dump(exclude_unset=True, exclude={"options", "id"})
    for field, value in update_data.items():
        setattr(db_question, field, value)

    # Reconcile options if provided
    if question_in.options is not None:
        existing_options = {o.id: o for o in db_question.options}
        updated_ids = set()
        for opt_in in question_in.options:
            if opt_in.id and opt_in.id in existing_options:
                db_opt = existing_options[opt_in.id]
                opt_data = opt_in.model_dump(exclude_unset=True, exclude={"id"})
                for field, value in opt_data.items():
                    setattr(db_opt, field, value)
                updated_ids.add(db_opt.id)
            else:
                db_opt = QuestionOption(
                    text=opt_in.text,
                    is_correct=opt_in.is_correct,
                    display_order=opt_in.display_order,
                    question=db_question,
                )
                db.add(db_opt)
        for opt_id, db_opt in existing_options.items():
            if opt_id not in updated_ids:
                await db.delete(db_opt)

    await db.commit()

    result2 = await db.execute(
        select(Question)
        .where(Question.id == question_id)
        .options(selectinload(Question.options))
    )
    q = result2.scalar_one()
    return {
        "id": str(q.id),
        "quiz_id": str(q.quiz_id),
        "text": q.text,
        "difficulty": q.difficulty,
        "topic": q.topic,
        "marks": q.marks,
        "explanation": q.explanation,
        "question_type": q.question_type,
        "bloom_level": q.bloom_level,
        "subtopic": q.subtopic,
        "estimated_time": q.estimated_time,
        "negative_marks": q.negative_marks,
        "hint": q.hint,
        "ai_generated": q.ai_generated,
        "generated_by_ai": q.generated_by_ai,
        "order_index": q.order_index,
        "options": [
            {
                "id": str(o.id),
                "text": o.text,
                "is_correct": o.is_correct,
                "display_order": o.display_order,
            }
            for o in sorted(q.options, key=lambda o: o.display_order)
        ],
    }


@router.delete("/{quiz_id}/questions/{question_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_question(
    quiz_id: uuid.UUID,
    question_id: uuid.UUID,
    current_user: User = Depends(check_role(["teacher", "admin"])),
    db: AsyncSession = Depends(get_db)
) -> None:
    """Delete a single question from a quiz. Cascades to options. Teachers/admins only."""
    result = await db.execute(
        select(Question).where(Question.id == question_id, Question.quiz_id == quiz_id)
    )
    db_question = result.scalar_one_or_none()
    if not db_question:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")

    # Quiz ownership check
    quiz_res = await db.execute(select(Quiz).where(Quiz.id == quiz_id))
    db_quiz = quiz_res.scalar_one_or_none()
    if not db_quiz:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quiz not found")
    if db_quiz.created_by_id != current_user.id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. You do not own this quiz."
        )
    await db.delete(db_question)
    await db.commit()
    return None


@router.post("", response_model=QuizResponse, status_code=status.HTTP_201_CREATED)
async def create_quiz(
    quiz_in: QuizCreate,
    current_user: User = Depends(check_role(["teacher", "admin"])),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Create a new quiz, including its questions and options. Protected for teachers and admins."""
    # Check if quiz_code is unique
    code_result = await db.execute(select(Quiz).where(Quiz.quiz_code == quiz_in.quiz_code))
    if code_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Quiz with code '{quiz_in.quiz_code}' already exists."
        )

    from app.core.security import escape_html

    # Create quiz with escaped fields
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
        created_by_id=current_user.id
    )
    
    db.add(db_quiz)

    # Add questions with escaped fields
    # Use quiz_in values directly: db_quiz.default_marks/marks_mode may be None before
    # the row is flushed because the DB default=1 is server-side, not a Python default.
    _marks_mode = quiz_in.marks_mode or "default"
    _default_marks = quiz_in.default_marks if quiz_in.default_marks is not None else 1
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
        
        # Add options with escaped fields
        for opt_in in processed_q.get("options", []):
            db_option = QuestionOption(
                text=escape_html(opt_in.get("text")),
                is_correct=opt_in.get("is_correct"),
                display_order=opt_in.get("display_order"),
                question=db_question
            )
            db.add(db_option)

    await db.commit()
    
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
    return db_q


@router.get("", response_model=dict)
async def read_quizzes(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None, description="Search in title, subject, or description"),
    status: Optional[str] = Query(None, description="Filter by status: draft, published, archived"),
    subject: Optional[str] = Query(None, description="Filter by subject"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Retrieve quizzes. Accessible to all logged-in students, teachers, and admins with pagination, search, and filters."""
    query = select(Quiz).options(
        selectinload(Quiz.questions),
        selectinload(Quiz.attempts)
    )
    count_query = select(func.count()).select_from(Quiz)

    filters = []
    if current_user.role == "student":
        # Students should only see published, non-archived quizzes
        filters.append(Quiz.status == "published")
    elif status:
        filters.append(Quiz.status == status)

    if search:
        like_pat = f"%{search}%"
        filters.append(or_(
            Quiz.title.ilike(like_pat),
            Quiz.subject.ilike(like_pat),
            Quiz.description.ilike(like_pat)
        ))

    if subject:
        filters.append(Quiz.subject == subject)

    if filters:
        from sqlalchemy import and_
        query = query.where(and_(*filters))
        count_query = count_query.where(and_(*filters))

    # Count total
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    # Get page
    query = query.order_by(Quiz.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    quizzes = result.scalars().all()

    items = []
    for quiz in quizzes:
        session_result = await db.execute(
            select(GameSession.game_pin)
            .where(
                GameSession.quiz_id == quiz.id,
                GameSession.status.in_([GameSessionStatus.WAITING.value, GameSessionStatus.ACTIVE.value])
            )
            .limit(1)
        )
        session_pin = session_result.scalar_one_or_none()

        items.append({
            "id": str(quiz.id),
            "title": quiz.title,
            "description": quiz.description,
            "subject": quiz.subject,
            "duration": quiz.duration,
            "status": quiz.status,
            "quiz_code": quiz.quiz_code,
            "created_at": quiz.created_at.isoformat() if quiz.created_at else None,
            "updated_at": quiz.updated_at.isoformat() if quiz.updated_at else None,
            "question_count": len(quiz.questions),
            "attempt_count": len(quiz.attempts),
            "total_marks": quiz.total_marks,
            "pass_percentage": quiz.pass_percentage,
            "visibility": quiz.visibility,
            "max_attempts": quiz.max_attempts,
            "anti_cheating_enabled": quiz.anti_cheating_enabled,
            "timer_mode": quiz.timer_mode,
            "overall_time_limit_seconds": quiz.overall_time_limit_seconds,
            "department": quiz.department,
            "semester": quiz.semester,
            "language": quiz.language,
            "fullscreen_required": quiz.fullscreen_required,
            "adaptive_mode": quiz.adaptive_mode,
            "allow_review": quiz.allow_review,
            "game_session_pin": session_pin
        })

    return {"total": total, "items": items}


@router.get("/reports", response_model=dict)
async def get_classroom_reports(
    subject: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    semester: Optional[str] = Query(None),
    quiz_id: Optional[uuid.UUID] = Query(None),
    student_id: Optional[uuid.UUID] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    current_user: User = Depends(check_role(["teacher", "admin"])),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Retrieve detailed tabular data of quizzes, student leaderboards, and raw attempts for custom report generation."""
    if quiz_id:
        quiz_check_res = await db.execute(select(Quiz).where(Quiz.id == quiz_id))
        quiz_check = quiz_check_res.scalar_one_or_none()
        if quiz_check and quiz_check.created_by_id != current_user.id and current_user.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. You do not own this quiz."
            )

    # 1. Fetch Quizzes matching filters
    quiz_select = select(Quiz)
    quiz_filters = []
    if current_user.role != "admin":
        quiz_filters.append(Quiz.created_by_id == current_user.id)
    if subject:
        quiz_filters.append(Quiz.subject == subject)
    if department:
        quiz_filters.append(Quiz.department == department)
    if semester:
        quiz_filters.append(Quiz.semester == semester)
    if quiz_id:
        quiz_filters.append(Quiz.id == quiz_id)
    if quiz_filters:
        from sqlalchemy import and_
        quiz_select = quiz_select.where(and_(*quiz_filters))

    quiz_res = await db.execute(quiz_select)
    quizzes = quiz_res.scalars().all()
    quiz_ids = [q.id for q in quizzes]

    if not quiz_ids:
        return {"quizzes": [], "students": [], "attempts": []}

    # 2. Fetch attempts matching quizzes and date filters
    attempt_select = select(QuizAttempt).where(QuizAttempt.quiz_id.in_(quiz_ids), QuizAttempt.completed_at != None)
    if student_id:
        attempt_select = attempt_select.where(QuizAttempt.user_id == student_id)
    if start_date:
        attempt_select = attempt_select.where(QuizAttempt.completed_at >= start_date)
    if end_date:
        attempt_select = attempt_select.where(QuizAttempt.completed_at <= end_date)

    attempt_select = attempt_select.options(
        selectinload(QuizAttempt.user),
        selectinload(QuizAttempt.quiz)
    )
    attempt_res = await db.execute(attempt_select)
    attempts = attempt_res.scalars().all()

    # 3. Format Attempts List
    attempts_out = []
    for a in attempts:
        attempts_out.append({
            "id": str(a.id),
            "student_name": a.user.full_name or "Unknown Student",
            "student_email": a.user.email,
            "quiz_title": a.quiz.title,
            "subject": a.quiz.subject,
            "score": a.score,
            "percentage": a.percentage,
            "passed": a.passed,
            "time_spent_seconds": a.time_spent_seconds,
            "completed_at": a.completed_at.isoformat() if a.completed_at else None,
            "violations": a.tab_switch_count + a.fullscreen_exit_count + a.copy_paste_count
        })

    # 4. Format Quizzes List
    quiz_attempts_map = {}
    for a in attempts:
        quiz_attempts_map.setdefault(a.quiz_id, []).append(a)

    quizzes_out = []
    for q in quizzes:
        q_attempts = quiz_attempts_map.get(q.id, [])
        att_count = len(q_attempts)
        avg_score = sum(a.percentage for a in q_attempts) / att_count if att_count > 0 else 0.0
        passed_count = sum(1 for a in q_attempts if a.passed)
        pass_rate = (passed_count / att_count) * 100 if att_count > 0 else 0.0

        quizzes_out.append({
            "id": str(q.id),
            "title": q.title,
            "subject": q.subject,
            "duration": q.duration,
            "status": q.status,
            "quiz_code": q.quiz_code,
            "department": q.department,
            "semester": q.semester,
            "created_at": q.created_at.isoformat() if q.created_at else None,
            "attempts_count": att_count,
            "avg_score": round(avg_score, 2),
            "pass_rate": round(pass_rate, 2)
        })

    # 5. Format Students List
    student_attempts_map = {}
    for a in attempts:
        student_attempts_map.setdefault(a.user_id, []).append(a)

    students_out = []
    student_ids = list(student_attempts_map.keys())
    if student_ids:
        users_res = await db.execute(select(User).where(User.id.in_(student_ids)))
        users_map = {u.id: u for u in users_res.scalars().all()}
        for s_id, s_attempts in student_attempts_map.items():
            user = users_map.get(s_id)
            if not user:
                continue
            att_count = len(s_attempts)
            avg_score = sum(a.percentage for a in s_attempts) / att_count if att_count > 0 else 0.0
            passed_count = sum(1 for a in s_attempts if a.passed)
            pass_rate = (passed_count / att_count) * 100 if att_count > 0 else 0.0
            total_violations = sum(a.tab_switch_count + a.fullscreen_exit_count + a.copy_paste_count for a in s_attempts)

            students_out.append({
                "id": str(s_id),
                "name": user.full_name or "Unknown Student",
                "email": user.email,
                "department": getattr(user, "department", None) or "General",
                "semester": getattr(user, "semester", None) or "General",
                "attempts_count": att_count,
                "avg_score": round(avg_score, 2),
                "pass_rate": round(pass_rate, 2),
                "total_violations": total_violations
            })

    return {
        "quizzes": quizzes_out,
        "students": students_out,
        "attempts": attempts_out
    }


@router.get("/analytics", response_model=dict)
async def get_classroom_analytics(
    subject: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    semester: Optional[str] = Query(None),
    quiz_id: Optional[uuid.UUID] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    current_user: User = Depends(check_role(["teacher", "admin"])),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Retrieve detailed classroom quiz analytics with trends, scores, completions, and difficulties."""
    if quiz_id:
        quiz_check_res = await db.execute(select(Quiz).where(Quiz.id == quiz_id))
        quiz_check = quiz_check_res.scalar_one_or_none()
        if quiz_check and quiz_check.created_by_id != current_user.id and current_user.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. You do not own this quiz."
            )

    # 1. Query Quizzes with filters
    quiz_select = select(Quiz)
    quiz_filters = []
    if current_user.role != "admin":
        quiz_filters.append(Quiz.created_by_id == current_user.id)
    if subject:
        quiz_filters.append(Quiz.subject == subject)
    if department:
        quiz_filters.append(Quiz.department == department)
    if semester:
        quiz_filters.append(Quiz.semester == semester)
    if quiz_id:
        quiz_filters.append(Quiz.id == quiz_id)
    if quiz_filters:
        from sqlalchemy import and_
        quiz_select = quiz_select.where(and_(*quiz_filters))

    quiz_res = await db.execute(quiz_select)
    quizzes = quiz_res.scalars().all()
    quiz_ids = [q.id for q in quizzes]

    if not quiz_ids:
        return {
            "overview": {"total_quizzes": 0, "total_attempts": 0, "avg_score": 0.0, "pass_rate": 0.0},
            "trends": [],
            "quiz_performance": [],
            "student_performance": [],
            "question_difficulty": []
        }

    # 2. Query attempts matching those quizzes
    attempt_select = select(QuizAttempt).where(QuizAttempt.quiz_id.in_(quiz_ids), QuizAttempt.completed_at != None)
    if start_date:
        attempt_select = attempt_select.where(QuizAttempt.completed_at >= start_date)
    if end_date:
        attempt_select = attempt_select.where(QuizAttempt.completed_at <= end_date)

    attempt_select = attempt_select.options(
        selectinload(QuizAttempt.user),
        selectinload(QuizAttempt.quiz).selectinload(Quiz.questions)
    )
    attempt_res = await db.execute(attempt_select)
    attempts = attempt_res.scalars().all()

    # 3. Compute stats
    total_attempts = len(attempts)
    avg_score = sum(a.percentage for a in attempts) / total_attempts if total_attempts > 0 else 0.0
    passed_attempts = sum(1 for a in attempts if a.passed)
    pass_rate = (passed_attempts / total_attempts) * 100 if total_attempts > 0 else 0.0

    # Trends (Attempts by Date)
    trend_dict = {}
    for a in attempts:
        date_str = a.completed_at.strftime("%Y-%m-%d") if a.completed_at else None
        if date_str:
            trend_dict[date_str] = trend_dict.get(date_str, 0) + 1

    trends = [{"date": d, "count": trend_dict[d]} for d in sorted(trend_dict.keys())]

    # Quiz Performance
    quiz_stats = {}
    for a in attempts:
        q_id = a.quiz_id
        if q_id not in quiz_stats:
            quiz_stats[q_id] = {
                "title": a.quiz.title,
                "subject": a.quiz.subject,
                "attempts": 0,
                "score_sum": 0.0,
                "passed": 0,
                "max_score": 0.0
            }
        stat = quiz_stats[q_id]
        stat["attempts"] += 1
        stat["score_sum"] += a.percentage
        if a.passed:
            stat["passed"] += 1
        if a.score > stat["max_score"]:
            stat["max_score"] = a.score

    quiz_performance = []
    for q_id, s in quiz_stats.items():
        quiz_performance.append({
            "id": str(q_id),
            "title": s["title"],
            "subject": s["subject"],
            "attempts": s["attempts"],
            "avg_score": round(s["score_sum"] / s["attempts"], 2) if s["attempts"] > 0 else 0.0,
            "pass_rate": round((s["passed"] / s["attempts"]) * 100, 2) if s["attempts"] > 0 else 0.0,
            "max_score": s["max_score"]
        })

    # Student Performance
    student_stats = {}
    for a in attempts:
        u_id = a.user_id
        if u_id not in student_stats:
            student_stats[u_id] = {
                "name": a.user.full_name or "Unknown Student",
                "email": a.user.email,
                "attempts": 0,
                "score_sum": 0.0,
                "passed": 0
            }
        s = student_stats[u_id]
        s["attempts"] += 1
        s["score_sum"] += a.percentage
        if a.passed:
            s["passed"] += 1

    student_performance = []
    for u_id, s in student_stats.items():
        student_performance.append({
            "id": str(u_id),
            "name": s["name"],
            "email": s["email"],
            "attempts": s["attempts"],
            "avg_score": round(s["score_sum"] / s["attempts"], 2) if s["attempts"] > 0 else 0.0,
            "pass_rate": round((s["passed"] / s["attempts"]) * 100, 2) if s["attempts"] > 0 else 0.0
        })

    # Question Difficulty Analysis
    question_stats = {}
    for q in quizzes:
        for question in q.questions:
            question_stats[question.id] = {
                "text": question.text,
                "difficulty": question.difficulty,
                "topic": question.topic,
                "total": 0,
                "correct": 0
            }

    for a in attempts:
        q_analytics = a.question_analytics or {}
        for q_id_str, q_an in q_analytics.items():
            try:
                q_id = uuid.UUID(q_id_str)
            except ValueError:
                continue
            if q_id in question_stats:
                question_stats[q_id]["total"] += 1
                if q_an.get("correct", False):
                    question_stats[q_id]["correct"] += 1

    question_difficulty = []
    for q_id, s in question_stats.items():
        if s["total"] > 0:
            correct_pct = round((s["correct"] / s["total"]) * 100, 2)
            question_difficulty.append({
                "id": str(q_id),
                "text": s["text"],
                "difficulty": s["difficulty"],
                "topic": s["topic"],
                "attempts": s["total"],
                "correct_rate": correct_pct
            })

    question_difficulty.sort(key=lambda x: x["correct_rate"])

    return {
        "overview": {
            "total_quizzes": len(quiz_ids),
            "total_attempts": total_attempts,
            "avg_score": round(avg_score, 2),
            "pass_rate": round(pass_rate, 2)
        },
        "trends": trends,
        "quiz_performance": quiz_performance,
        "student_performance": student_performance,
        "question_difficulty": question_difficulty[:15]
    }


@router.get("/code/{quiz_code}", response_model=QuizResponse)
async def get_quiz_by_code(
    quiz_code: str,
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Retrieve a published quiz by its unique quiz_code (PIN)."""
    search_codes = [quiz_code, quiz_code.upper()]
    if quiz_code.isdigit():
        search_codes.extend([f"QZ-{quiz_code}", f"AI-QZ-{quiz_code}", f"AI-QB-{quiz_code}"])
        
    result = await db.execute(
        select(Quiz)
        .where(Quiz.quiz_code.in_(search_codes), Quiz.status == "published")
        .options(selectinload(Quiz.questions).selectinload(Question.options))
    )
    quiz = result.scalar_one_or_none()
    if not quiz:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Quiz with code '{quiz_code}' not found or is not published."
        )
    quiz.game_session_pin = await get_active_session_pin(quiz.id, db)
    return quiz


@router.get("/{id}", response_model=QuizResponse)
async def read_quiz(
    id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Get a specific quiz by ID. Accessible to all logged-in students, teachers, and admins."""
    result = await db.execute(
        select(Quiz)
        .where(Quiz.id == id)
        .options(selectinload(Quiz.questions).selectinload(Question.options))
    )
    db_quiz = result.scalar_one_or_none()
    if not db_quiz:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quiz not found"
        )
    db_quiz.game_session_pin = await get_active_session_pin(db_quiz.id, db)
    return db_quiz


@router.put("/{id}", response_model=QuizResponse)
async def update_quiz(
    id: uuid.UUID,
    quiz_in: QuizUpdate,
    current_user: User = Depends(check_role(["teacher", "admin"])),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Update a quiz, including nested questions and options.
    Protected for teachers and admins.
    """
    # Fetch quiz with questions and options loaded
    result = await db.execute(
        select(Quiz)
        .where(Quiz.id == id)
        .options(selectinload(Quiz.questions).selectinload(Question.options))
    )
    db_quiz = result.scalar_one_or_none()
    if not db_quiz:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quiz not found"
        )

    # Ownership check
    if db_quiz.created_by_id != current_user.id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. You do not own this quiz."
        )

    # Check unique quiz code if it's changing
    if quiz_in.quiz_code is not None and quiz_in.quiz_code != db_quiz.quiz_code:
        code_result = await db.execute(select(Quiz).where(Quiz.quiz_code == quiz_in.quiz_code))
        if code_result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Quiz with code '{quiz_in.quiz_code}' already exists."
            )

    from app.core.security import escape_html

    # Update simple fields on Quiz
    update_data = quiz_in.model_dump(exclude_unset=True, exclude={"questions"})
    for field, value in update_data.items():
        if isinstance(value, str):
            value = escape_html(value)
        setattr(db_quiz, field, value)

    # Update nested questions if provided
    if quiz_in.questions is not None:
        existing_questions = {q.id: q for q in db_quiz.questions}
        updated_question_ids = set()

        for q_in in quiz_in.questions:
            if q_in.id and q_in.id in existing_questions:
                # Get existing db_question
                db_question = existing_questions[q_in.id]
                
                # Construct merged dict representing the updated question
                merged_dict = {
                    "id": str(db_question.id),
                    "text": q_in.text if q_in.text is not None else db_question.text,
                    "difficulty": q_in.difficulty if q_in.difficulty is not None else db_question.difficulty,
                    "topic": q_in.topic if q_in.topic is not None else db_question.topic,
                    "marks": q_in.marks if q_in.marks is not None else db_question.marks,
                    "explanation": q_in.explanation if q_in.explanation is not None else db_question.explanation,
                    "question_type": q_in.question_type if q_in.question_type is not None else db_question.question_type,
                    "bloom_level": q_in.bloom_level if q_in.bloom_level is not None else db_question.bloom_level,
                    "subtopic": q_in.subtopic if q_in.subtopic is not None else db_question.subtopic,
                    "estimated_time": q_in.estimated_time if q_in.estimated_time is not None else db_question.estimated_time,
                    "negative_marks": q_in.negative_marks if q_in.negative_marks is not None else db_question.negative_marks,
                    "hint": q_in.hint if q_in.hint is not None else db_question.hint,
                    "ai_generated": q_in.ai_generated if q_in.ai_generated is not None else db_question.ai_generated,
                    "version": q_in.version if q_in.version is not None else db_question.version,
                    "order_index": q_in.order_index if q_in.order_index is not None else db_question.order_index,
                    "time_limit_seconds": q_in.time_limit_seconds if q_in.time_limit_seconds is not None else db_question.time_limit_seconds,
                    "course_outcome": q_in.course_outcome if q_in.course_outcome is not None else db_question.course_outcome,
                    "reference": q_in.reference if q_in.reference is not None else db_question.reference,
                    "ai_provider": q_in.ai_provider if q_in.ai_provider is not None else db_question.ai_provider,
                    "ai_model": q_in.ai_model if q_in.ai_model is not None else db_question.ai_model,
                    "generated_by_ai": q_in.generated_by_ai if q_in.generated_by_ai is not None else db_question.generated_by_ai,
                    "generated_at": q_in.generated_at if q_in.generated_at is not None else db_question.generated_at,
                    "critic_score": q_in.critic_score if q_in.critic_score is not None else db_question.critic_score,
                    "is_user_modified": q_in.is_user_modified if q_in.is_user_modified is not None else db_question.is_user_modified,
                }
                
                # Track if user modified it
                is_modified = False
                sent_data = q_in.model_dump(exclude_unset=True, exclude={"options", "id"})
                for f, val in sent_data.items():
                    if getattr(db_question, f) != val:
                        is_modified = True
                        
                if q_in.options is not None:
                     is_modified = True
                     merged_dict["options"] = [{"text": o.text, "is_correct": o.is_correct, "display_order": o.display_order} for o in q_in.options]
                else:
                     merged_dict["options"] = [{"text": o.text, "is_correct": o.is_correct, "display_order": o.display_order} for o in db_question.options]
                
                if is_modified:
                     merged_dict["is_user_modified"] = True
                     
                # Run processed pipeline
                processed_q, _ = QuestionProcessor.process_question(
                     merged_dict,
                     marks_mode=db_quiz.marks_mode,
                     default_marks=db_quiz.default_marks
                )
                
                # Update question
                for field, val in processed_q.items():
                     if field not in ["options", "id"]:
                         if isinstance(val, str):
                             val = escape_html(val)
                         setattr(db_question, field, val)
                         
                updated_question_ids.add(db_question.id)
                
                # Reconcile options
                existing_options = {o.id: o for o in db_question.options}
                updated_option_ids = set()
                
                for opt_dict in processed_q.get("options", []):
                     db_option = None
                     for o_id, o_obj in existing_options.items():
                         if o_obj.text.strip().lower() == opt_dict.get("text", "").strip().lower():
                             db_option = o_obj
                             break
                             
                     if db_option:
                         db_option.text = escape_html(opt_dict.get("text"))
                         db_option.is_correct = opt_dict.get("is_correct")
                         db_option.display_order = opt_dict.get("display_order")
                         updated_option_ids.add(db_option.id)
                     else:
                         db_option = QuestionOption(
                             text=escape_html(opt_dict.get("text")),
                             is_correct=opt_dict.get("is_correct"),
                             display_order=opt_dict.get("display_order"),
                             question=db_question
                         )
                         db.add(db_option)
                         
                for o_id, o_obj in existing_options.items():
                     if o_id not in updated_option_ids:
                         await db.delete(o_obj)
            else:
                # Create a completely new question
                q_dict = q_in.model_dump()
                processed_q, _ = QuestionProcessor.process_question(
                    q_dict,
                    marks_mode=db_quiz.marks_mode,
                    default_marks=db_quiz.default_marks
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

                # Add options for the new question
                for opt_dict in processed_q.get("options", []):
                    db_option = QuestionOption(
                        text=escape_html(opt_dict.get("text")),
                        is_correct=opt_dict.get("is_correct"),
                        display_order=opt_dict.get("display_order"),
                        question=db_question
                    )
                    db.add(db_option)

        # Delete existing questions that are not in the update payload
        for q_id, db_q in existing_questions.items():
            if q_id not in updated_question_ids:
                await db.delete(db_q)

    await db.commit()

    # Re-retrieve complete quiz representation
    final_result = await db.execute(
        select(Quiz)
        .where(Quiz.id == id)
        .options(selectinload(Quiz.questions).selectinload(Question.options))
    )
    db_q = final_result.scalar_one()
    db_q.game_session_pin = await get_active_session_pin(db_q.id, db)
    return db_q


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_quiz(
    id: uuid.UUID,
    current_user: User = Depends(check_role(["teacher", "admin"])),
    db: AsyncSession = Depends(get_db)
) -> None:
    """Delete a quiz. Cascades to questions and options. Protected for teachers and admins."""
    result = await db.execute(select(Quiz).where(Quiz.id == id))
    db_quiz = result.scalar_one_or_none()
    if not db_quiz:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quiz not found"
        )

    # Ownership check
    if db_quiz.created_by_id != current_user.id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. You do not own this quiz."
        )
    await db.delete(db_quiz)
    await db.commit()
    return None


@router.get("/teacher/dashboard", response_model=dict)
async def get_teacher_dashboard(
    current_user: User = Depends(check_role(["teacher", "admin"])),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Retrieve dynamic aggregated statistics, activity history, and monthly performance data for the teacher dashboard."""
    from datetime import timezone, datetime as dt_pkg
    
    # 1. Quizzes count created by this teacher (distinguishing Manual vs AI-generated)
    manual_count_query = await db.execute(
        select(func.count(Quiz.id)).where(Quiz.created_by_id == current_user.id, Quiz.generated_by_ai == False)
    )
    manual_count = manual_count_query.scalar() or 0

    ai_count_query = await db.execute(
        select(func.count(Quiz.id)).where(Quiz.created_by_id == current_user.id, Quiz.generated_by_ai == True)
    )
    ai_count = ai_count_query.scalar() or 0

    # 2. Total questions count belonging to quizzes created by this teacher
    questions_count_query = await db.execute(
        select(func.count(Question.id))
        .join(Quiz, Question.quiz_id == Quiz.id)
        .where(Quiz.created_by_id == current_user.id)
    )
    questions_count = questions_count_query.scalar() or 0

    # 3. Total plays (completed attempts) across quizzes created by this teacher
    plays_count_query = await db.execute(
        select(func.count(QuizAttempt.id))
        .join(Quiz, QuizAttempt.quiz_id == Quiz.id)
        .where(Quiz.created_by_id == current_user.id, QuizAttempt.completed_at != None)
    )
    plays_count = plays_count_query.scalar() or 0

    # 4. Monthly performance data for the past 6 months (Jan to Dec format)
    now = dt_pkg.now(timezone.utc)
    months = []
    for i in range(5, -1, -1):
        m = (now.month - 1 - i) % 12 + 1
        y = now.year + (now.month - 1 - i) // 12
        months.append((y, m))
        
    month_names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    
    performance_map = {}
    for y, m in months:
        label = f"{month_names[m-1]}"
        performance_map[(y, m)] = {
            "name": label,
            "Manual": 0,
            "AI": 0,
            "Plays": 0
        }
        
    start_date = dt_pkg(months[0][0], months[0][1], 1, tzinfo=timezone.utc)
    quizzes_query = await db.execute(
        select(Quiz.created_at, Quiz.generated_by_ai)
        .where(Quiz.created_by_id == current_user.id, Quiz.created_at >= start_date)
    )
    quizzes_rows = quizzes_query.all()
    for created_at, generated_by_ai in quizzes_rows:
        if created_at:
            # Normalize created_at timezone
            c_at = created_at.replace(tzinfo=timezone.utc) if created_at.tzinfo is None else created_at.astimezone(timezone.utc)
            key = (c_at.year, c_at.month)
            if key in performance_map:
                if generated_by_ai:
                    performance_map[key]["AI"] += 1
                else:
                    performance_map[key]["Manual"] += 1
                
    attempts_query = await db.execute(
        select(QuizAttempt.completed_at)
        .join(Quiz, QuizAttempt.quiz_id == Quiz.id)
        .where(Quiz.created_by_id == current_user.id, QuizAttempt.completed_at >= start_date)
    )
    attempts_rows = attempts_query.all()
    for (completed_at,) in attempts_rows:
        if completed_at:
            c_at = completed_at.replace(tzinfo=timezone.utc) if completed_at.tzinfo is None else completed_at.astimezone(timezone.utc)
            key = (c_at.year, c_at.month)
            if key in performance_map:
                performance_map[key]["Plays"] += 1
                
    performance_data = [performance_map[k] for k in sorted(performance_map.keys())]

    # 5. Recent Activity combining quiz creation and student attempts
    activities = []
    
    # Last 5 quizzes
    recent_quizzes_query = await db.execute(
        select(Quiz)
        .where(Quiz.created_by_id == current_user.id)
        .order_by(Quiz.updated_at.desc())
        .limit(5)
    )
    recent_quizzes = recent_quizzes_query.scalars().all()
    for q in recent_quizzes:
        activities.append({
            "id": f"quiz-{q.id}",
            "type": "ai" if q.generated_by_ai else "manual",
            "title": q.title,
            "timestamp": q.updated_at.isoformat() if q.updated_at else (q.created_at.isoformat() if q.created_at else ""),
            "status": "AI Generated" if q.generated_by_ai else "Manual Creation"
        })
        
    # Last 5 attempts
    recent_attempts_query = await db.execute(
        select(QuizAttempt)
        .join(Quiz, QuizAttempt.quiz_id == Quiz.id)
        .where(Quiz.created_by_id == current_user.id, QuizAttempt.completed_at != None)
        .options(selectinload(QuizAttempt.user))
        .order_by(QuizAttempt.completed_at.desc())
        .limit(5)
    )
    recent_attempts = recent_attempts_query.scalars().all()
    for a in recent_attempts:
        activities.append({
            "id": f"attempt-{a.id}",
            "type": "play",
            "title": f"{a.user.full_name or 'A student'} completed '{a.quiz.title}'",
            "timestamp": a.completed_at.isoformat() if a.completed_at else (a.started_at.isoformat() if a.started_at else ""),
            "status": f"Score: {a.percentage}%"
        })
        
    # Sort activities by timestamp desc and keep top 5
    activities = [a for a in activities if a["timestamp"]]
    activities.sort(key=lambda x: x["timestamp"], reverse=True)
    recent_activities = activities[:5]

    return {
        "manual_quizzes": manual_count,
        "ai_quizzes": ai_count,
        "question_bank": questions_count,
        "total_plays": plays_count,
        "performance_data": performance_data,
        "recent_activities": recent_activities
    }

