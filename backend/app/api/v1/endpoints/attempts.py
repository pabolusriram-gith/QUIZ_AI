import uuid
import random
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.database.session import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.quiz import Quiz, Question, QuestionOption, QuizAttempt, GameSession, Participant, GameSessionStatus
from app.schemas.attempt import (
    QuizAttemptCreate,
    QuizAttemptProgress,
    QuizAttemptSubmit,
    QuizAttemptResponse,
    QuizAttemptResultResponse
)

logger = logging.getLogger("attempts_api")
router = APIRouter()


@router.get("/student/dashboard", response_model=Dict[str, Any])
async def get_student_dashboard(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Retrieve quizzes grouped by status: available, completed, upcoming for student portal."""
    now = datetime.now(timezone.utc)
    
    # 1. Fetch all published quizzes
    quizzes_query = await db.execute(
        select(Quiz)
        .where(Quiz.status == "published")
        .options(selectinload(Quiz.questions))
    )
    all_quizzes = quizzes_query.scalars().all()
    
    # 2. Fetch all completed/in-progress attempts by this student
    attempts_query = await db.execute(
        select(QuizAttempt)
        .where(QuizAttempt.user_id == current_user.id)
    )
    user_attempts = attempts_query.scalars().all()
    
    # Map attempt counts and active statuses per quiz
    quiz_attempts_map: Dict[uuid.UUID, List[QuizAttempt]] = {}
    for att in user_attempts:
        quiz_attempts_map.setdefault(att.quiz_id, []).append(att)
        
    available_quizzes = []
    completed_quizzes = []
    upcoming_quizzes = []
    
    for quiz in all_quizzes:
        attempts_list = quiz_attempts_map.get(quiz.id, [])
        completed_attempts = [a for a in attempts_list if a.completed_at is not None]
        active_attempt = next((a for a in attempts_list if a.completed_at is None), None)
        
        attempts_count = len(completed_attempts)
        has_active = active_attempt is not None
        
        # Check window constraints
        from_time = quiz.available_from.replace(tzinfo=timezone.utc) if quiz.available_from else None
        until_time = quiz.available_until.replace(tzinfo=timezone.utc) if quiz.available_until else None
        
        is_before_window = from_time and now < from_time
        is_after_window = until_time and now > until_time
        
        # Structure payload
        quiz_info = {
            "id": quiz.id,
            "title": quiz.title,
            "description": quiz.description,
            "subject": quiz.subject,
            "duration": quiz.duration,
            "total_marks": quiz.total_marks,
            "timer_mode": quiz.timer_mode,
            "max_attempts": quiz.max_attempts,
            "attempts_taken": attempts_count,
            "available_from": quiz.available_from,
            "available_until": quiz.available_until,
            "custom_instructions": quiz.custom_instructions,
            "has_active_attempt": has_active,
            "active_attempt_id": active_attempt.id if has_active else None
        }
        
        # Determine grouping
        if attempts_count > 0 and not has_active and attempts_count >= quiz.max_attempts:
            # Quiz fully completed, no attempts left
            # Fetch highest score
            best_attempt = max(completed_attempts, key=lambda x: x.score)
            quiz_info["best_score"] = best_attempt.score
            quiz_info["best_percentage"] = best_attempt.percentage
            quiz_info["completed_at"] = best_attempt.completed_at
            quiz_info["attempt_id"] = best_attempt.id
            completed_quizzes.append(quiz_info)
        elif is_before_window:
            upcoming_quizzes.append(quiz_info)
        elif is_after_window:
            # Window elapsed - if they completed it show in completed, else they missed it.
            if attempts_count > 0:
                best_attempt = max(completed_attempts, key=lambda x: x.score)
                quiz_info["best_score"] = best_attempt.score
                quiz_info["best_percentage"] = best_attempt.percentage
                quiz_info["completed_at"] = best_attempt.completed_at
                quiz_info["attempt_id"] = best_attempt.id
                completed_quizzes.append(quiz_info)
            else:
                # Student missed the quiz
                quiz_info["missed"] = True
                completed_quizzes.append(quiz_info)
        else:
            # Active and available to take
            if attempts_count > 0:
                best_attempt = max(completed_attempts, key=lambda x: x.score)
                quiz_info["best_score"] = best_attempt.score
                quiz_info["best_percentage"] = best_attempt.percentage
                quiz_info["attempt_id"] = best_attempt.id
            available_quizzes.append(quiz_info)
            
    # 3. Compute student statistics overview across all attempts
    completed_user_attempts = [att for att in user_attempts if att.completed_at is not None]
    total_completed = len(completed_user_attempts)
    avg_percentage = round(sum(att.percentage for att in completed_user_attempts) / total_completed, 1) if total_completed > 0 else 0.0
    quizzes_passed = sum(1 for att in completed_user_attempts if att.passed)
    total_time_spent = sum(att.time_spent_seconds for att in completed_user_attempts)

    # 4. Compute performance trend mapping last 10 completed attempts sorted by completed_at
    sorted_attempts = sorted(completed_user_attempts, key=lambda x: x.completed_at)
    trend_list = []
    for att in sorted_attempts[-10:]:
        quiz_title = "Quiz"
        q_item = next((q for q in all_quizzes if q.id == att.quiz_id), None)
        if q_item:
            quiz_title = q_item.title
        trend_list.append({
            "quiz_title": quiz_title,
            "percentage": att.percentage,
            "date": att.completed_at.strftime("%b %d") if att.completed_at else ""
        })

    overview = {
        "total_completed": total_completed,
        "avg_percentage": avg_percentage,
        "quizzes_passed": quizzes_passed,
        "total_time_spent": total_time_spent,
        "trend": trend_list
    }

    return {
        "available": available_quizzes,
        "completed": completed_quizzes,
        "upcoming": upcoming_quizzes,
        "overview": overview
    }


@router.get("/{id}/instructions", response_model=Dict[str, Any])
async def get_quiz_instructions(
    id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Retrieve setup specifications and instructions for a quiz before starting."""
    quiz_query = await db.execute(
        select(Quiz)
        .where(Quiz.id == id, Quiz.status == "published")
    )
    quiz = quiz_query.scalar_one_or_none()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found or not published.")
        
    attempts_query = await db.execute(
        select(QuizAttempt)
        .where(QuizAttempt.quiz_id == id, QuizAttempt.user_id == current_user.id)
    )
    attempts = attempts_query.scalars().all()
    completed_attempts = [a for a in attempts if a.completed_at is not None]
    active_attempt = next((a for a in attempts if a.completed_at is None), None)
    
    now = datetime.now(timezone.utc)
    from_time = quiz.available_from.replace(tzinfo=timezone.utc) if quiz.available_from else None
    until_time = quiz.available_until.replace(tzinfo=timezone.utc) if quiz.available_until else None
    
    is_closed = until_time and now > until_time
    is_future = from_time and now < from_time
    
    return {
        "quiz_id": quiz.id,
        "title": quiz.title,
        "description": quiz.description,
        "duration": quiz.duration,
        "total_marks": quiz.total_marks,
        "pass_percentage": quiz.pass_percentage,
        "timer_mode": quiz.timer_mode,
        "overall_time_limit_seconds": quiz.overall_time_limit_seconds,
        "max_attempts": quiz.max_attempts,
        "attempts_taken": len(completed_attempts),
        "available_from": quiz.available_from,
        "available_until": quiz.available_until,
        "custom_instructions": quiz.custom_instructions,
        "requires_access_code": quiz.access_code is not None and len(quiz.access_code.strip()) > 0,
        "has_active_attempt": active_attempt is not None,
        "active_attempt_id": active_attempt.id if active_attempt else None,
        "is_closed": is_closed,
        "is_future": is_future
    }


@router.post("/{id}/attempts", response_model=QuizAttemptResponse)
async def start_quiz_attempt(
    id: uuid.UUID,
    payload: QuizAttemptCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Start or resume a quiz attempt session."""
    now = datetime.now(timezone.utc)
    
    # 1. Fetch quiz structure
    quiz_query = await db.execute(
        select(Quiz)
        .where(Quiz.id == id, Quiz.status == "published")
        .options(selectinload(Quiz.questions).selectinload(Question.options))
    )
    quiz = quiz_query.scalar_one_or_none()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found.")
        
    # 2. Check window bounds
    from_time = quiz.available_from.replace(tzinfo=timezone.utc) if quiz.available_from else None
    until_time = quiz.available_until.replace(tzinfo=timezone.utc) if quiz.available_until else None
    if from_time and now < from_time:
        raise HTTPException(status_code=400, detail="This quiz is not available yet.")
    if until_time and now > until_time:
        raise HTTPException(status_code=400, detail="This quiz availability window has closed.")
        
    # 3. Check for existing in-progress session
    active_query = await db.execute(
        select(QuizAttempt)
        .where(QuizAttempt.quiz_id == id, QuizAttempt.user_id == current_user.id, QuizAttempt.completed_at == None)
    )
    active_attempt = active_query.scalar_one_or_none()
    if active_attempt:
        return active_attempt
        
    # 4. Enforce attempt limits
    completed_query = await db.execute(
        select(func.count(QuizAttempt.id))
        .where(QuizAttempt.quiz_id == id, QuizAttempt.user_id == current_user.id, QuizAttempt.completed_at != None)
    )
    completed_count = completed_query.scalar() or 0
    if completed_count >= quiz.max_attempts:
        raise HTTPException(status_code=400, detail="Maximum attempts reached for this quiz.")
        
    # 5. Access code validation
    if quiz.access_code and len(quiz.access_code.strip()) > 0:
        if not payload.access_code or payload.access_code.strip() != quiz.access_code.strip():
            raise HTTPException(status_code=400, detail="Invalid quiz access code.")
            
    # 6. Question and Option Shuffling
    session_query = await db.execute(
        select(GameSession)
        .join(Participant, Participant.session_id == GameSession.id)
        .where(
            GameSession.quiz_id == id,
            GameSession.status.in_([GameSessionStatus.WAITING.value, GameSessionStatus.ACTIVE.value]),
            Participant.user_id == current_user.id
        )
    )
    game_session = session_query.scalar_one_or_none()
    
    if game_session and game_session.randomized_question_ids:
        randomized_question_ids = list(game_session.randomized_question_ids)
        q_order_map = {q_id: idx for idx, q_id in enumerate(randomized_question_ids)}
        questions = sorted(list(quiz.questions), key=lambda q: q_order_map.get(str(q.id), 99999))
    else:
        questions = list(quiz.questions)
        if quiz.shuffle_questions:
            random.shuffle(questions)
        randomized_question_ids = [str(q.id) for q in questions]
        
    randomized_option_ids = {}
    
    for q in questions:
        opts = list(q.options)
        if quiz.shuffle_options and q.question_type not in ["true_false", "fill_in_the_blank", "short_answer"]:
            seed_val = q.shuffle_seed
            if not seed_val:
                import hashlib
                seed_str = str(q.id)
                seed_val = int(hashlib.sha256(seed_str.encode('utf-8')).hexdigest(), 16)
            r = random.Random(seed_val)
            r.shuffle(opts)
        randomized_option_ids[str(q.id)] = [str(o.id) for o in opts]
        
    # Create the attempt record
    attempt = QuizAttempt(
        id=uuid.uuid4(),
        user_id=current_user.id,
        quiz_id=quiz.id,
        score=0.0,
        percentage=0.0,
        passed=False,
        time_spent_seconds=0,
        answers={},
        question_analytics={},
        randomized_question_ids=randomized_question_ids,
        randomized_option_ids=randomized_option_ids,
        tab_switch_count=0,
        fullscreen_exit_count=0,
        copy_paste_count=0,
        started_at=now,
        completed_at=None
    )
    
    db.add(attempt)
    await db.commit()
    await db.refresh(attempt)
    return attempt


@router.put("/{id}/attempts/{attempt_id}/save-progress", response_model=QuizAttemptResponse)
async def save_quiz_progress(
    id: uuid.UUID,
    attempt_id: uuid.UUID,
    payload: QuizAttemptProgress,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Autosave attempt progress state, logs, and basic anti-cheating counts."""
    try:
        # Lock QuizAttempt (Lock Order 1)
        attempt_query = await db.execute(
            select(QuizAttempt)
            .where(QuizAttempt.id == attempt_id, QuizAttempt.user_id == current_user.id, QuizAttempt.completed_at == None)
            .with_for_update()
        )
        attempt = attempt_query.scalar_one_or_none()
        if not attempt:
            raise HTTPException(status_code=404, detail="Active attempt session not found.")
            
        # Check if student is participating in an active live session for this quiz
        session_query = await db.execute(
            select(GameSession)
            .join(Participant, Participant.session_id == GameSession.id)
            .where(
                GameSession.quiz_id == id,
                GameSession.status == GameSessionStatus.ACTIVE.value,
                Participant.user_id == current_user.id
            )
        )
        game_session = session_query.scalar_one_or_none()
        if game_session:
            is_expired = False
            if game_session.current_question_end_time and not game_session.is_paused:
                now = datetime.now(timezone.utc)
                end_time = game_session.current_question_end_time.replace(tzinfo=timezone.utc) if game_session.current_question_end_time.tzinfo is None else game_session.current_question_end_time
                if now > end_time:
                    is_expired = True

            if game_session.answers_locked or is_expired:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Time expired. Submissions are closed for this question."
                )
            
        # Merge analytics and updates
        attempt.answers = payload.answers
        attempt.question_analytics = payload.question_analytics
        attempt.time_spent_seconds = payload.time_spent_seconds
        attempt.tab_switch_count += payload.tab_switch_count
        attempt.fullscreen_exit_count += payload.fullscreen_exit_count
        attempt.copy_paste_count += payload.copy_paste_count
        
        await db.commit()
        await db.refresh(attempt)

        # Check if student is participating in an active live session for this quiz
        session_query = await db.execute(
            select(GameSession)
            .join(Participant, Participant.session_id == GameSession.id)
            .where(
                GameSession.quiz_id == id,
                GameSession.status == GameSessionStatus.ACTIVE.value,
                Participant.user_id == current_user.id
            )
        )
        game_session = session_query.scalar_one_or_none()
        if game_session:
            # Check current question
            quiz_res = await db.execute(
                select(Quiz).where(Quiz.id == id).options(selectinload(Quiz.questions))
            )
            quiz = quiz_res.scalar_one_or_none()
            if quiz and game_session.current_question_index < len(quiz.questions):
                current_q = quiz.questions[game_session.current_question_index]
                current_q_id_str = str(current_q.id)
                
                # If they have selected choices for the current question
                user_selections = payload.answers.get(current_q_id_str, [])
                if user_selections and len(user_selections) > 0:
                    # Lock Participant (Lock Order 2)
                    part_res = await db.execute(
                        select(Participant).where(
                            Participant.session_id == game_session.id, 
                            Participant.user_id == current_user.id
                        )
                        .with_for_update()
                    )
                    participant = part_res.scalar_one_or_none()
                    if participant:
                        from app.services.connection_manager import manager
                        manager.add_answered_player(game_session.game_pin, participant.nickname)
                        
                        # Grade correctness and calculate points difference
                        q_analytics = attempt.question_analytics.get(current_q_id_str, {})
                        was_graded = q_analytics.get("graded", False)
                        was_correct = q_analytics.get("correct", False) if was_graded else False
                        old_points = 1000 if was_correct else 0
                        
                        # Grade correctness
                        correct_opt_ids = [str(o.id) for o in current_q.options if o.is_correct]
                        is_correct = False
                        if current_q.question_type in ["multiple_choice", "true_false"]:
                            is_correct = len(user_selections) > 0 and user_selections[0] in correct_opt_ids
                        elif current_q.question_type == "multiple_select":
                            is_correct = set(user_selections) == set(correct_opt_ids)
                        elif current_q.question_type in ["fill_in_the_blank", "short_answer"]:
                            correct_texts = [o.text.strip().lower() for o in current_q.options]
                            is_correct = len(user_selections) > 0 and user_selections[0].strip().lower() in correct_texts
                        
                        new_points = 1000 if is_correct else 0
                        points_diff = new_points - old_points
                        
                        participant.score += points_diff
                        
                        # Update attempt analytics to mark it graded
                        q_analytics["correct"] = is_correct
                        q_analytics["graded"] = True
                        attempt.question_analytics[current_q_id_str] = q_analytics
                        
                        from sqlalchemy.orm.attributes import flag_modified
                        flag_modified(attempt, "question_analytics")
                        await db.commit()
                        
                        answered_count = len(manager.get_answered_players(game_session.game_pin))
                        db_count_res = await db.execute(
                            select(func.count(Participant.id)).where(Participant.session_id == game_session.id)
                        )
                        total_players = db_count_res.scalar() or 0
                        
                        # Broadcast session update event only once
                        if points_diff != 0:
                            # Re-fetch all participants for stable leaderboard update
                            part_res_all = await db.execute(
                                select(Participant)
                                .where(Participant.session_id == game_session.id)
                                .order_by(Participant.score.desc(), Participant.joined_at.asc())
                            )
                            participants_all = part_res_all.scalars().all()
                            
                            await manager.broadcast(
                                pin=game_session.game_pin,
                                msg_type="session_update",
                                payload={
                                    "status": game_session.status,
                                    "current_question_index": game_session.current_question_index,
                                    "answered_count": answered_count,
                                    "total_players": total_players,
                                    "answered_players": list(manager.get_answered_players(game_session.game_pin)),
                                    "participants": [
                                        {
                                            "id": str(p.id),
                                            "nickname": p.nickname,
                                            "score": p.score,
                                            "connected": p.connected
                                        } for p in participants_all
                                    ]
                                }
                            )
                        else:
                            # Lightweight update broadcast (score did not change)
                            await manager.broadcast(
                                pin=game_session.game_pin,
                                msg_type="session_update",
                                payload={
                                    "status": game_session.status,
                                    "current_question_index": game_session.current_question_index,
                                    "answered_count": answered_count,
                                    "total_players": total_players,
                                    "answered_players": list(manager.get_answered_players(game_session.game_pin))
                                }
                            )

                        # Auto-advance checks under Auto Advance mode
                        if game_session.auto_advance and answered_count >= total_players:
                            total_qs = len(game_session.randomized_question_ids) if game_session.randomized_question_ids else len(quiz.questions)
                            if game_session.current_question_index + 1 < total_qs:
                                game_session.current_question_index += 1
                                game_session.answers_locked = False
                                game_session.is_paused = False
                                game_session.pause_started_at = None

                                # Next question duration from configured question or override
                                next_q_id = game_session.randomized_question_ids[game_session.current_question_index] if game_session.randomized_question_ids else None
                                next_q = next((q for q in quiz.questions if str(q.id) == next_q_id), None) if next_q_id else (quiz.questions[game_session.current_question_index] if game_session.current_question_index < len(quiz.questions) else None)
                                duration = game_session.question_timer_override or (next_q.time_limit_seconds if next_q and next_q.time_limit_seconds else 30) or 30
                                now_time = datetime.now(timezone.utc)
                                game_session.current_question_started_at = now_time
                                game_session.current_question_duration = duration
                                game_session.current_question_end_time = now_time + timedelta(seconds=duration)

                                manager.reset_question_state(game_session.game_pin)
                                await db.commit()
                                await manager.broadcast(game_session.game_pin, "next_question", {
                                    "current_question_index": game_session.current_question_index,
                                    "question_started_at": game_session.current_question_started_at.isoformat(),
                                    "question_end_time": game_session.current_question_end_time.isoformat(),
                                    "duration": duration,
                                    "server_time": now_time.isoformat(),
                                    "answers_locked": False,
                                    "is_paused": False
                                })
                                from app.api.v1.endpoints.sessions import broadcast_timer_sync
                                await broadcast_timer_sync(game_session.game_pin, game_session)
        return attempt
    except Exception as e:
        await db.rollback()
        logger.exception("Error processing save progress. Rolled back transaction.")
        raise e
    return attempt


@router.post("/{id}/attempts/{attempt_id}/submit", response_model=QuizAttemptResponse)
async def submit_quiz_attempt(
    id: uuid.UUID,
    attempt_id: uuid.UUID,
    payload: QuizAttemptSubmit,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Submit a completed attempt. Calculates marks with optional negative scoring."""
    now = datetime.now(timezone.utc)
    
    # 1. Fetch active attempt
    attempt_query = await db.execute(
        select(QuizAttempt)
        .where(QuizAttempt.id == attempt_id, QuizAttempt.user_id == current_user.id, QuizAttempt.completed_at == None)
    )
    attempt = attempt_query.scalar_one_or_none()
    if not attempt:
        raise HTTPException(status_code=404, detail="Active attempt session not found.")
        
    # 2. Fetch quiz details including all grading metrics
    quiz_query = await db.execute(
        select(Quiz)
        .where(Quiz.id == id)
        .options(selectinload(Quiz.questions).selectinload(Question.options))
    )
    quiz = quiz_query.scalar_one_or_none()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz metadata missing.")
        
    answers = payload.answers
    question_analytics = payload.question_analytics
    
    total_score = 0.0
    
    # Iterate and grade questions
    for q in quiz.questions:
        q_id_str = str(q.id)
        user_selection = answers.get(q_id_str, [])
        
        # Analytics template fallback
        q_analytics = question_analytics.setdefault(q_id_str, {})
        q_analytics.setdefault("time_spent_seconds", 0)
        q_analytics.setdefault("flagged", False)
        q_analytics["skipped"] = len(user_selection) == 0
        
        is_correct = False
        
        if q.question_type == "multiple_choice" or q.question_type == "true_false":
            correct_opt = next((o for o in q.options if o.is_correct), None)
            if correct_opt and len(user_selection) == 1 and user_selection[0] == str(correct_opt.id):
                is_correct = True
                
        elif q.question_type == "multiple_select":
            correct_ids = {str(o.id) for o in q.options if o.is_correct}
            user_ids = set(user_selection)
            if correct_ids == user_ids and len(correct_ids) > 0:
                is_correct = True
                
        elif q.question_type == "fill_in_the_blank" or q.question_type == "short_answer":
            # Check options for key phrases
            correct_keys = [o.text.strip().lower() for o in q.options if o.is_correct or True] # text grades
            user_text = user_selection[0].strip().lower() if len(user_selection) > 0 else ""
            if user_text and any(k == user_text for k in correct_keys if k):
                is_correct = True
                
        if is_correct:
            total_score += q.marks
            q_analytics["correct"] = True
        else:
            total_score -= q.negative_marks
            q_analytics["correct"] = False
            
    # Bound final score and pass values
    final_score = max(0.0, total_score)
    total_marks = quiz.total_marks or sum(q.marks for q in quiz.questions)
    percentage = (final_score / total_marks) * 100 if total_marks > 0 else 0.0
    passed = percentage >= quiz.pass_percentage
    
    # Save graded fields
    attempt.answers = answers
    attempt.question_analytics = question_analytics
    attempt.score = round(final_score, 2)
    attempt.percentage = round(percentage, 2)
    attempt.passed = passed
    attempt.time_spent_seconds = payload.time_spent_seconds
    attempt.tab_switch_count += payload.tab_switch_count
    attempt.fullscreen_exit_count += payload.fullscreen_exit_count
    attempt.copy_paste_count += payload.copy_paste_count
    attempt.completed_at = now
    
    await db.commit()
    await db.refresh(attempt)
    return attempt


@router.get("/attempts/{attempt_id}/results", response_model=QuizAttemptResultResponse)
async def get_attempt_results(
    attempt_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Retrieve details and student performance summaries filtered by instructor review visibility rules."""
    attempt_query = await db.execute(
        select(QuizAttempt)
        .where(QuizAttempt.id == attempt_id, QuizAttempt.user_id == current_user.id, QuizAttempt.completed_at != None)
    )
    attempt = attempt_query.scalar_one_or_none()
    if not attempt:
        raise HTTPException(status_code=404, detail="Completed attempt not found.")
        
    quiz_query = await db.execute(
        select(Quiz)
        .where(Quiz.id == attempt.quiz_id)
        .options(selectinload(Quiz.questions).selectinload(Question.options))
    )
    quiz = quiz_query.scalar_one_or_none()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz metadata missing.")
        
    # Check if part of a live session
    session_query = await db.execute(
        select(GameSession)
        .join(Participant, Participant.session_id == GameSession.id)
        .where(
            GameSession.quiz_id == attempt.quiz_id,
            Participant.user_id == current_user.id
        )
    )
    game_session = session_query.scalar_one_or_none()
    
    if game_session:
        show_score = True
        show_answers = False
        if game_session.correct_answer_visibility == "immediately":
            show_answers = True
        elif game_session.correct_answer_visibility == "after_quiz_ends":
            show_answers = (game_session.status == GameSessionStatus.FINISHED.value)
            
        show_explanations = show_answers
        show_solutions = show_answers
        show_marks = True
    else:
        # Check standard result visibility rules
        now = datetime.now(timezone.utc)
        vis = quiz.result_visibility
        
        if vis == "never":
            raise HTTPException(status_code=403, detail="Results visibility has been disabled by the instructor.")
        elif vis == "after_due_date":
            until_time = quiz.available_until.replace(tzinfo=timezone.utc) if quiz.available_until else None
            if until_time and now < until_time:
                raise HTTPException(status_code=403, detail="Results will become available once the quiz window has closed.")
        elif vis == "manual_release":
            # Allow review toggle acts as release trigger
            if not quiz.allow_review:
                raise HTTPException(status_code=403, detail="Results have not been released by the instructor yet.")
                
        show_score = quiz.show_score
        show_answers = quiz.show_answers
        show_explanations = quiz.show_explanations
        show_solutions = quiz.show_solutions
        show_marks = quiz.show_marks
            
    # Graded answers detail (filtered by show permission checkboxes)
    graded_questions = []
    correct_count = 0
    incorrect_count = 0
    
    # Restore randomized ordering saved in the attempt record
    order_ids = attempt.randomized_question_ids or [str(q.id) for q in quiz.questions]
    questions_map = {str(q.id): q for q in quiz.questions}
    
    for q_id_str in order_ids:
        q = questions_map.get(q_id_str)
        if not q:
            continue
            
        user_selection = attempt.answers.get(q_id_str, [])
        q_analytics = attempt.question_analytics.get(q_id_str, {})
        is_correct = q_analytics.get("correct", False)
        
        if is_correct:
            correct_count += 1
        else:
            incorrect_count += 1
            
        # Standard grading payload
        graded_q = {
            "id": q.id,
            "text": q.text,
            "question_type": q.question_type,
            "difficulty": q.difficulty,
            "bloom_level": q.bloom_level,
            "course_outcome": q.course_outcome,
            "selected_answers": user_selection,
            "is_correct": is_correct,
            "time_spent_seconds": q_analytics.get("time_spent_seconds", 0)
        }
        
        # Populate options (filtered by permissions)
        restored_opts_ids = (attempt.randomized_option_ids or {}).get(q_id_str) or [str(o.id) for o in q.options]
        opts_map = {str(o.id): o for o in q.options}
        
        opts_list = []
        for o_id_str in restored_opts_ids:
            o = opts_map.get(o_id_str)
            if not o:
                continue
            opt_payload = {
                "id": o.id,
                "text": o.text,
                "display_order": o.display_order
            }
            if show_answers:
                opt_payload["is_correct"] = o.is_correct
            opts_list.append(opt_payload)
            
        graded_q["options"] = opts_list
        
        # Explanations and solution keys mapping
        if show_explanations:
            graded_q["explanation"] = q.explanation
            graded_q["reference"] = q.reference
            
        if show_marks:
            graded_q["marks"] = q.marks
            graded_q["negative_marks"] = q.negative_marks
            
        graded_questions.append(graded_q)
        
    return {
        "id": attempt.id,
        "quiz_id": attempt.quiz_id,
        "score": attempt.score if show_score else 0.0,
        "percentage": attempt.percentage if show_score else 0.0,
        "passed": attempt.passed if show_score else False,
        "time_spent_seconds": attempt.time_spent_seconds,
        "completed_at": attempt.completed_at,
        "show_score": show_score,
        "show_answers": show_answers,
        "show_explanations": show_explanations,
        "show_solutions": show_solutions,
        "show_marks": show_marks,
        "total_questions": len(order_ids),
        "correct_count": correct_count,
        "incorrect_count": incorrect_count,
        "graded_questions": graded_questions
    }


@router.get("/{id}/instructor-reviews", response_model=List[Dict[str, Any]])
async def get_instructor_reviews(
    id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Retrieve all student completions for a quiz, showing durations, answers, and analytics (Educator Mode)."""
    # 1. Enforce instructor authorization check
    quiz_query = await db.execute(
        select(Quiz)
        .where(Quiz.id == id)
    )
    quiz = quiz_query.scalar_one_or_none()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found.")
        
    if quiz.created_by_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Access denied. Instructors only.")
        
    # 2. Fetch all completed attempts with user profiles
    attempts_query = await db.execute(
        select(QuizAttempt)
        .where(QuizAttempt.quiz_id == id, QuizAttempt.completed_at != None)
        .options(selectinload(QuizAttempt.user))
    )
    attempts = attempts_query.scalars().all()
    
    completions = []
    for att in attempts:
        completions.append({
            "attempt_id": att.id,
            "student_name": att.user.full_name or att.user.email,
            "student_email": att.user.email,
            "score": att.score,
            "percentage": att.percentage,
            "passed": att.passed,
            "time_spent_seconds": att.time_spent_seconds,
            "completed_at": att.completed_at,
            "tab_switches": att.tab_switch_count,
            "fullscreen_exits": att.fullscreen_exit_count,
            "copy_paste_count": att.copy_paste_count,
            "answers": att.answers,
            "question_analytics": att.question_analytics
        })
        
    return completions
