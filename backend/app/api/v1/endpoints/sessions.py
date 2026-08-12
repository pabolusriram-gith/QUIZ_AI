import re
import uuid
import random
import logging
import json
from datetime import datetime, timezone, timedelta
from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query, status
from pydantic import BaseModel as PydanticBaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user, check_role
from app.database.session import get_db
from app.models.user import User
from app.models.quiz import Quiz, QuizAttempt, GameSession, Participant, GameSessionStatus
from app.schemas.game_session import GameSessionCreate, GameSessionResponse, ParticipantResponse
from app.services.connection_manager import manager
from app.core.security import decode_token

logger = logging.getLogger("sessions_api")
router = APIRouter()

async def broadcast_session_update(pin: str, session_id: uuid.UUID, session_status: str, db: AsyncSession):
    res = await db.execute(
        select(Participant)
        .where(Participant.session_id == session_id)
        .order_by(Participant.joined_at)
    )
    participants = res.scalars().all()
    payload = {
        "status": session_status,
        "participants": [
            {
                "id": str(p.id),
                "nickname": p.nickname,
                "score": p.score,
                "connected": p.connected
            } for p in participants
        ]
    }
    await manager.broadcast(pin, "session_update", payload)


class JoinSessionRequest(PydanticBaseModel):
    nickname: str

@router.post("/{pin}/join")
async def join_session(
    pin: str,
    payload: JoinSessionRequest,
    token: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """Register a student nickname in the session before connecting to the WebSocket.

    Guards (in order):
    1. Nickname format validation
    2. Token decoding (so user_id is available for all subsequent checks)
    3. Session existence and status check — returns 410 Gone for finished sessions
    4. Cross-session duplicate guard — rejects users already connected in another
       live session for the same quiz (e.g. duplicate tabs or stale sessions)
    5. In-session nickname guard — rejects truly live duplicate nicknames;
       allows re-join when the existing participant's WebSocket is no longer tracked
    6. Capacity check
    7. Late-join policy check
    8. Participant record creation
    """

    # ── 1. Validate nickname ───────────────────────────────────────────────
    nickname = payload.nickname.strip()
    if not nickname:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nickname is required."
        )
    if not (3 <= len(nickname) <= 20):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nickname must be between 3 and 20 characters."
        )
    if not re.match("^[a-zA-Z0-9_-]+$", nickname):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nickname can only contain alphanumeric characters, underscores, and hyphens."
        )

    # ── 2. Parse token early so user_id is available for all guards ────────
    student_user_id = None
    if token:
        try:
            decoded = decode_token(token)
            student_user_id = uuid.UUID(decoded.get("sub"))
        except Exception:
            pass  # Anonymous / invalid token — continue as guest

    # ── 3. Session lookup — two-phase for descriptive errors ───────────────
    # Phase A: find the session by PIN regardless of status
    raw_res = await db.execute(
        select(GameSession).where(GameSession.game_pin == pin)
    )
    session = raw_res.scalar_one_or_none()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Game session not found. Check your PIN and try again."
        )

    # Phase B: check whether the session is still open
    if session.status == GameSessionStatus.FINISHED.value:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="This game session has already ended."
        )
    if session.status not in [GameSessionStatus.WAITING.value, GameSessionStatus.ACTIVE.value]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Game session is not currently accepting players."
        )

    # ── 4. Cross-session duplicate guard ──────────────────────────────────
    # If we have a verified user_id, make sure they are not already connected
    # to a *different* live session for the same quiz. This catches the case
    # where a host ended one session, started a fresh one, and the student's
    # old PIN still points to an active predecessor session.
    if student_user_id:
        other_res = await db.execute(
            select(Participant)
            .join(GameSession, GameSession.id == Participant.session_id)
            .where(
                Participant.user_id == student_user_id,
                Participant.connected == True,               # noqa: E712
                GameSession.quiz_id == session.quiz_id,
                GameSession.id != session.id,
                GameSession.status.in_([
                    GameSessionStatus.WAITING.value,
                    GameSessionStatus.ACTIVE.value,
                ])
            )
        )
        if other_res.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "You are already connected to another live session for this quiz. "
                    "Please leave that session before joining a new one."
                )
            )

    # ── 5. In-session nickname guard with stale-connection detection ────────
    nick_res = await db.execute(
        select(Participant)
        .where(
            Participant.session_id == session.id,
            Participant.nickname == nickname
        )
    )
    existing_participant = nick_res.scalar_one_or_none()

    if existing_participant:
        if existing_participant.connected:
            # Check whether the WebSocket manager still has a live socket for
            # this nickname. If the WS was lost without a proper disconnect
            # event, the DB flag stays True but the socket is gone (zombie).
            active_nicknames_in_ws = manager.session_nicknames.get(pin, set())
            if nickname in active_nicknames_in_ws:
                # Truly live connection — reject
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Nickname is already taken by an active player in this session."
                )
            # Zombie participant — the WS is gone but the flag wasn't cleared.
            # Allow the student to reclaim their nickname and reconnect.
            logger.warning(
                "[join] Zombie participant detected for nickname=%s in session=%s. "
                "Allowing reclaim.",
                nickname, pin
            )
        # Either disconnected or zombie → treat as re-join
        token_str = str(uuid.uuid4())
        existing_participant.connection_token = token_str
        await db.commit()
        return {
            "status": "rejoined",
            "session_id": str(session.id),
            "quiz_id": str(session.quiz_id),
            "connection_token": token_str
        }

    # ── 6. Capacity check ──────────────────────────────────────────────────
    count_res = await db.execute(
        select(func.count(Participant.id))
        .where(Participant.session_id == session.id)
    )
    current_count = count_res.scalar() or 0
    if current_count >= session.max_players:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This lobby is full. No more players can join."
        )

    # ── 7. Late-join policy check ──────────────────────────────────────────
    if session.status == GameSessionStatus.ACTIVE.value:
        policy = session.late_join_policy
        should_reject = False
        if policy == "disable_after_start":
            should_reject = True
        elif policy == "until_q1_ends":
            if session.current_question_index > 0:
                should_reject = True
        elif policy == "until_q3":
            if session.current_question_index >= 3:
                should_reject = True

        if should_reject:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Late joining is not allowed for this session."
            )

    # ── 8. Create participant record ───────────────────────────────────────
    # connected=False: the participant is pre-registered but the actual
    # WebSocket connection (and the connected=True flip) happens next.
    token_str = str(uuid.uuid4())
    new_participant = Participant(
        session_id=session.id,
        user_id=student_user_id,
        nickname=nickname,
        connected=False,
        connection_token=token_str
    )
    db.add(new_participant)
    await db.commit()

    return {
        "status": "joined",
        "session_id": str(session.id),
        "quiz_id": str(session.quiz_id),
        "connection_token": token_str
    }


@router.get("", response_model=dict)
async def list_host_sessions(
    current_user: User = Depends(check_role(["teacher", "admin"])),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Retrieve lists of active, waiting, and recent sessions hosted by the current user, along with quick statistics."""
    # Fetch all sessions hosted by this user
    res = await db.execute(
        select(GameSession)
        .where(GameSession.host_id == current_user.id)
        .options(selectinload(GameSession.quiz), selectinload(GameSession.participants))
        .order_by(GameSession.created_at.desc())
    )
    sessions = res.scalars().all()

    active = []
    waiting = []
    recent = []

    total_participants_all_time = 0
    total_finished_sessions = 0

    for s in sessions:
        participants_list = s.participants or []
        connected_count = sum(1 for p in participants_list if p.connected)
        waiting_count = sum(1 for p in participants_list if not p.connected)
        total_p = len(participants_list)

        session_data = {
            "id": str(s.id),
            "quiz_id": str(s.quiz_id),
            "quiz_title": s.quiz.title if s.quiz else "Deleted Quiz",
            "game_pin": s.game_pin,
            "status": s.status,
            "created_at": s.created_at.isoformat() if s.created_at else None,
            "started_at": s.started_at.isoformat() if s.started_at else None,
            "ended_at": s.ended_at.isoformat() if s.ended_at else None,
            "max_players": s.max_players,
            "connected_participant_count": connected_count,
            "waiting_participant_count": waiting_count,
            "total_participant_count": total_p,
            "is_paused": s.is_paused,
            "late_join_policy": s.late_join_policy,
            "question_order": s.question_order,
            "option_order": s.option_order,
            "leaderboard_mode": s.leaderboard_mode,
            "question_timer_override": s.question_timer_override,
            "current_question_index": s.current_question_index
        }

        if s.status == GameSessionStatus.ACTIVE.value:
            active.append(session_data)
        elif s.status == GameSessionStatus.WAITING.value:
            waiting.append(session_data)
        elif s.status == GameSessionStatus.FINISHED.value:
            recent.append(session_data)
            total_finished_sessions += 1
            total_participants_all_time += total_p

    # Compute quick stats
    stats = {
        "total_sessions": len(sessions),
        "active_sessions_count": len(active),
        "waiting_sessions_count": len(waiting),
        "recent_sessions_count": len(recent),
        "total_participants_all_time": total_participants_all_time,
        "avg_participants_per_session": round(total_participants_all_time / total_finished_sessions, 1) if total_finished_sessions > 0 else 0.0
    }

    return {
        "active": active,
        "waiting": waiting,
        "recent": recent,
        "stats": stats
    }


@router.post("/create", response_model=GameSessionResponse)
async def create_session(
    session_in: GameSessionCreate,
    current_user: User = Depends(check_role(["teacher", "admin"])),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Create a new live session or retrieve an existing active/waiting session for a published quiz."""
    # Check if a waiting or active session already exists for this quiz
    existing_res = await db.execute(
        select(GameSession)
        .where(
            GameSession.quiz_id == session_in.quiz_id,
            GameSession.status.in_([GameSessionStatus.WAITING.value, GameSessionStatus.ACTIVE.value])
        )
    )
    existing_session = existing_res.scalar_one_or_none()
    
    if existing_session:
        # Load the quiz to enrich title
        quiz_res = await db.execute(select(Quiz).where(Quiz.id == existing_session.quiz_id))
        quiz = quiz_res.scalar_one_or_none()
        
        # Attach dynamic property
        existing_session.quiz_title = quiz.title if quiz else None
        return existing_session

    # Verify quiz exists and is published
    quiz_res = await db.execute(
        select(Quiz).where(Quiz.id == session_in.quiz_id).options(selectinload(Quiz.questions))
    )
    quiz = quiz_res.scalar_one_or_none()
    if not quiz:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quiz not found"
        )
    if quiz.status != "published":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot host a session for a draft quiz. Please publish it first."
        )

    # Set or generate a unique PIN
    if session_in.game_pin and session_in.game_pin.strip():
        pin = session_in.game_pin.strip()
        pin_check = await db.execute(
            select(GameSession)
            .where(
                GameSession.game_pin == pin,
                GameSession.status.in_([GameSessionStatus.WAITING.value, GameSessionStatus.ACTIVE.value])
            )
        )
        if pin_check.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="The PIN you entered is already in use by an active/waiting game session. Please choose a different PIN."
            )
    else:
        while True:
            pin = f"{random.randint(100000, 999999)}"
            pin_check = await db.execute(
                select(GameSession)
                .where(
                    GameSession.game_pin == pin,
                    GameSession.status.in_([GameSessionStatus.WAITING.value, GameSessionStatus.ACTIVE.value])
                )
            )
            if not pin_check.scalar_one_or_none():
                break

    # Seed randomized question IDs
    questions = list(quiz.questions)
    if quiz.randomize_questions or quiz.shuffle_questions or session_in.question_order == "randomized":
        random.shuffle(questions)
    randomized_ids = [str(q.id) for q in questions]

    db_session = GameSession(
        quiz_id=session_in.quiz_id,
        host_id=current_user.id,
        game_pin=pin,
        status=GameSessionStatus.WAITING.value,
        max_players=session_in.max_players or 50,
        require_host_to_start=session_in.require_host_to_start if session_in.require_host_to_start is not None else True,
        leaderboard_mode=session_in.leaderboard_mode or "final_results_only",
        quiz_end_mode=session_in.quiz_end_mode or "auto_end",
        correct_answer_visibility=session_in.correct_answer_visibility or "immediately",
        question_navigation_mode=session_in.question_navigation_mode or "host_controlled",
        question_order=session_in.question_order or "same_for_everyone",
        option_order=session_in.option_order or "same_for_everyone",
        late_join_policy=session_in.late_join_policy or "disable_after_start",
        question_timer_override=session_in.question_timer_override,
        randomized_question_ids=randomized_ids
    )
    db.add(db_session)
    await db.commit()
    await db.refresh(db_session)

    db_session.quiz_title = quiz.title
    db_session.host_name = current_user.full_name
    return db_session


@router.get("/{pin}", response_model=GameSessionResponse)
async def get_session(
    pin: str,
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Retrieve game session details by PIN."""
    res = await db.execute(
        select(GameSession)
        .where(
            GameSession.game_pin == pin,
            GameSession.status.in_([GameSessionStatus.WAITING.value, GameSessionStatus.ACTIVE.value])
        )
    )
    db_session = res.scalar_one_or_none()
    if not db_session:
        # Check if a finished session exists with this PIN to give a better error
        finished_res = await db.execute(
            select(GameSession)
            .where(
                GameSession.game_pin == pin,
                GameSession.status == GameSessionStatus.FINISHED.value
            )
        )
        if finished_res.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_410_GONE,
                detail="This game session has already ended."
            )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Game session not found or already finished."
        )

    # Get quiz details
    quiz_res = await db.execute(select(Quiz).where(Quiz.id == db_session.quiz_id))
    quiz = quiz_res.scalar_one_or_none()
    
    # Get host details
    host_res = await db.execute(select(User).where(User.id == db_session.host_id))
    host = host_res.scalar_one_or_none()
    
    db_session.quiz_title = quiz.title if quiz else None
    db_session.host_name = host.full_name if host else None
    return db_session


@router.get("/{pin}/participants", response_model=List[ParticipantResponse])
async def get_session_participants(
    pin: str,
    db: AsyncSession = Depends(get_db)
) -> Any:
    """List all participants inside a live session."""
    res = await db.execute(
        select(GameSession)
        .where(
            GameSession.game_pin == pin,
            GameSession.status.in_([GameSessionStatus.WAITING.value, GameSessionStatus.ACTIVE.value])
        )
    )
    db_session = res.scalar_one_or_none()
    if not db_session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Game session not found."
        )

    part_res = await db.execute(
        select(Participant)
        .where(Participant.session_id == db_session.id)
        .order_by(Participant.joined_at)
    )
    return part_res.scalars().all()


@router.post("/{pin}/start-countdown")
async def start_session_countdown(
    pin: str,
    current_user: User = Depends(check_role(["teacher", "admin"])),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Broadcast start countdown event to all connected players."""
    res = await db.execute(
        select(GameSession)
        .where(
            GameSession.game_pin == pin,
            GameSession.status == GameSessionStatus.WAITING.value
        )
    )
    db_session = res.scalar_one_or_none()
    if not db_session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Waiting game session not found."
        )

    if db_session.host_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the session host can start the quiz."
        )

    # Broadcast countdown event
    await manager.broadcast(
        pin=pin,
        msg_type="start_countdown",
        payload={
            "quiz_id": str(db_session.quiz_id),
            "start_timestamp": datetime.now(timezone.utc).isoformat()
        }
    )
    return {"status": "countdown_started"}


@router.post("/{pin}/start", response_model=GameSessionResponse)
async def start_session(
    pin: str,
    current_user: User = Depends(check_role(["teacher", "admin"])),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Start the live quiz assessment session for all players."""
    res = await db.execute(
        select(GameSession)
        .where(
            GameSession.game_pin == pin,
            GameSession.status == GameSessionStatus.WAITING.value
        )
    )
    db_session = res.scalar_one_or_none()
    if not db_session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Waiting game session not found."
        )

    if db_session.host_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the session host can start the quiz."
        )

    db_session.status = GameSessionStatus.ACTIVE.value
    db_session.started_at = datetime.now(timezone.utc)
    db_session.current_question_index = 0
    db_session.current_question_started_at = datetime.now(timezone.utc)
    db_session.current_question_end_time = None

    if not db_session.randomized_question_ids:
        quiz_res = await db.execute(
            select(Quiz).where(Quiz.id == db_session.quiz_id).options(selectinload(Quiz.questions))
        )
        quiz = quiz_res.scalar_one_or_none()
        questions = list(quiz.questions) if quiz else []
        if quiz and (quiz.randomize_questions or quiz.shuffle_questions or db_session.question_order == "randomized"):
            random.shuffle(questions)
        db_session.randomized_question_ids = [str(q.id) for q in questions]
    await db.commit()
    await db.refresh(db_session)

    # Broadcast start countdown event to all connected players (both host and students run locally)
    await manager.broadcast(
        pin=pin,
        msg_type="start_countdown",
        payload={
            "quiz_id": str(db_session.quiz_id),
            "start_timestamp": datetime.now(timezone.utc).isoformat()
        }
    )

    # Broadcast updated state
    await broadcast_session_update(pin, db_session.id, db_session.status, db)

    quiz_res = await db.execute(select(Quiz).where(Quiz.id == db_session.quiz_id))
    quiz = quiz_res.scalar_one_or_none()
    db_session.quiz_title = quiz.title if quiz else None
    return db_session


@router.post("/{pin}/end", response_model=GameSessionResponse)
async def end_session(
    pin: str,
    current_user: User = Depends(check_role(["teacher", "admin"])),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """End the live session."""
    res = await db.execute(
        select(GameSession)
        .where(
            GameSession.game_pin == pin,
            GameSession.status == GameSessionStatus.ACTIVE.value
        )
    )
    db_session = res.scalar_one_or_none()
    if not db_session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Active game session not found."
        )

    if db_session.host_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the session host can end the quiz."
        )

    db_session.status = GameSessionStatus.FINISHED.value
    db_session.ended_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(db_session)

    # Broadcast ending events
    await manager.broadcast(
        pin=pin,
        msg_type="session_finished",
        payload={}
    )
    await manager.broadcast(
        pin=pin,
        msg_type="end_game",
        payload={}
    )

    quiz_res = await db.execute(select(Quiz).where(Quiz.id == db_session.quiz_id))
    quiz = quiz_res.scalar_one_or_none()
    db_session.quiz_title = quiz.title if quiz else None
    return db_session


@router.post("/{pin}/pause", response_model=GameSessionResponse)
async def pause_session(
    pin: str,
    current_user: User = Depends(check_role(["teacher", "admin"])),
    db: AsyncSession = Depends(get_db)
) -> Any:
    res = await db.execute(
        select(GameSession).where(GameSession.game_pin == pin, GameSession.status == GameSessionStatus.ACTIVE.value)
    )
    session = res.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Active game session not found.")
    if session.host_id != current_user.id:
        raise HTTPException(status_code=403, detail="Unauthorized host account.")

    session.is_paused = True
    session.pause_started_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(session)
    
    await manager.broadcast(pin, "pause_game", {})
    await broadcast_timer_sync(pin, session)
    return session


@router.post("/{pin}/resume", response_model=GameSessionResponse)
async def resume_session(
    pin: str,
    current_user: User = Depends(check_role(["teacher", "admin"])),
    db: AsyncSession = Depends(get_db)
) -> Any:
    res = await db.execute(
        select(GameSession).where(GameSession.game_pin == pin, GameSession.status == GameSessionStatus.ACTIVE.value)
    )
    session = res.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Active game session not found.")
    if session.host_id != current_user.id:
        raise HTTPException(status_code=403, detail="Unauthorized host account.")

    session.is_paused = False
    if session.pause_started_at and session.current_question_end_time:
        now = datetime.now(timezone.utc)
        pause_start = session.pause_started_at.replace(tzinfo=timezone.utc) if session.pause_started_at.tzinfo is None else session.pause_started_at
        paused_duration = (now - pause_start).total_seconds()
        session.current_question_end_time += timedelta(seconds=paused_duration)
    session.pause_started_at = None
    await db.commit()
    await db.refresh(session)
    
    await manager.broadcast(pin, "resume_game", {})
    await broadcast_timer_sync(pin, session)
    return session


@router.post("/{pin}/next-question", response_model=GameSessionResponse)
async def next_question_session(
    pin: str,
    current_user: User = Depends(check_role(["teacher", "admin"])),
    db: AsyncSession = Depends(get_db)
) -> Any:
    res = await db.execute(
        select(GameSession).where(GameSession.game_pin == pin, GameSession.status == GameSessionStatus.ACTIVE.value)
    )
    session = res.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Active game session not found.")
    if session.host_id != current_user.id:
        raise HTTPException(status_code=403, detail="Unauthorized host account.")

    # Get total questions count
    quiz_res = await db.execute(
        select(Quiz).where(Quiz.id == session.quiz_id).options(selectinload(Quiz.questions))
    )
    quiz = quiz_res.scalar_one_or_none()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found.")

    if session.current_question_index + 1 >= len(quiz.questions):
        raise HTTPException(status_code=400, detail="No more questions left.")

    session.current_question_index += 1
    session.answers_locked = False
    session.current_question_started_at = None
    session.current_question_end_time = None
    
    # Reset in-memory trackers on manager
    manager.reset_question_state(pin)

    await db.commit()
    await db.refresh(session)
    
    await manager.broadcast(pin, "next_question", {
        "current_question_index": session.current_question_index
    })
    return session


@router.post("/{pin}/start-timer", response_model=GameSessionResponse)
async def start_timer_session(
    pin: str,
    current_user: User = Depends(check_role(["teacher", "admin"])),
    db: AsyncSession = Depends(get_db)
) -> Any:
    res = await db.execute(
        select(GameSession).where(GameSession.game_pin == pin, GameSession.status == GameSessionStatus.ACTIVE.value)
    )
    session = res.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Active game session not found.")
    if session.host_id != current_user.id:
        raise HTTPException(status_code=403, detail="Unauthorized host account.")

    # Get current question limit
    quiz_res = await db.execute(
        select(Quiz).where(Quiz.id == session.quiz_id).options(selectinload(Quiz.questions))
    )
    quiz = quiz_res.scalar_one_or_none()
    if not quiz or session.current_question_index >= len(quiz.questions):
         raise HTTPException(status_code=400, detail="Invalid current question state.")

    q = quiz.questions[session.current_question_index]
    duration = session.question_timer_override or q.time_limit_seconds or 30

    now = datetime.now(timezone.utc)
    session.current_question_started_at = now
    session.current_question_duration = duration
    session.current_question_end_time = now + timedelta(seconds=duration)
    session.answers_locked = False

    await db.commit()
    await db.refresh(session)

    await manager.broadcast(pin, "start_timer", {
        "current_question_index": session.current_question_index,
        "current_question_started_at": session.current_question_started_at.isoformat(),
        "current_question_end_time": session.current_question_end_time.isoformat()
    })
    await broadcast_timer_sync(pin, session)
    return session


@router.post("/{pin}/skip-question", response_model=GameSessionResponse)
async def skip_question_session(
    pin: str,
    current_user: User = Depends(check_role(["teacher", "admin"])),
    db: AsyncSession = Depends(get_db)
) -> Any:
    res = await db.execute(
        select(GameSession).where(GameSession.game_pin == pin, GameSession.status == GameSessionStatus.ACTIVE.value)
    )
    session = res.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Active game session not found.")
    if session.host_id != current_user.id:
        raise HTTPException(status_code=403, detail="Unauthorized host account.")

    await manager.broadcast(pin, "question_skipped", {
        "current_question_index": session.current_question_index
    })
    return session


@router.post("/{pin}/end-question", response_model=GameSessionResponse)
async def end_question_session(
    pin: str,
    current_user: User = Depends(check_role(["teacher", "admin"])),
    db: AsyncSession = Depends(get_db)
) -> Any:
    res = await db.execute(
        select(GameSession).where(GameSession.game_pin == pin, GameSession.status == GameSessionStatus.ACTIVE.value)
    )
    session = res.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Active game session not found.")
    if session.host_id != current_user.id:
        raise HTTPException(status_code=403, detail="Unauthorized host account.")

    await manager.broadcast(pin, "question_finished", {
        "current_question_index": session.current_question_index
    })
    return session


@router.post("/{pin}/extend-timer", response_model=GameSessionResponse)
async def extend_timer_session(
    pin: str,
    current_user: User = Depends(check_role(["teacher", "admin"])),
    db: AsyncSession = Depends(get_db)
) -> Any:
    res = await db.execute(
        select(GameSession).where(GameSession.game_pin == pin, GameSession.status == GameSessionStatus.ACTIVE.value)
    )
    session = res.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Active game session not found.")
    if session.host_id != current_user.id:
        raise HTTPException(status_code=403, detail="Unauthorized host account.")

    if session.current_question_end_time:
        session.current_question_end_time += timedelta(seconds=30)
        await db.commit()
        await db.refresh(session)
        
        await manager.broadcast(pin, "timer_extended", {
            "seconds": 30,
            "current_question_end_time": session.current_question_end_time.isoformat()
        })
    return session


@router.post("/{pin}/lock", response_model=GameSessionResponse)
async def lock_answers_session(
    pin: str,
    current_user: User = Depends(check_role(["teacher", "admin"])),
    db: AsyncSession = Depends(get_db)
) -> Any:
    res = await db.execute(
        select(GameSession).where(GameSession.game_pin == pin, GameSession.status == GameSessionStatus.ACTIVE.value)
    )
    session = res.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Active game session not found.")
    if session.host_id != current_user.id:
        raise HTTPException(status_code=403, detail="Unauthorized host account.")

    session.answers_locked = True
    await db.commit()
    await db.refresh(session)

    await manager.broadcast(pin, "answer_locked", {})
    return session


@router.post("/{pin}/unlock", response_model=GameSessionResponse)
async def unlock_answers_session(
    pin: str,
    current_user: User = Depends(check_role(["teacher", "admin"])),
    db: AsyncSession = Depends(get_db)
) -> Any:
    res = await db.execute(
        select(GameSession).where(GameSession.game_pin == pin, GameSession.status == GameSessionStatus.ACTIVE.value)
    )
    session = res.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Active game session not found.")
    if session.host_id != current_user.id:
        raise HTTPException(status_code=403, detail="Unauthorized host account.")

    session.answers_locked = False
    await db.commit()
    await db.refresh(session)

    await manager.broadcast(pin, "answer_unlocked", {})
    return session


@router.get("/{pin}/leaderboard", response_model=List[ParticipantResponse])
async def get_session_leaderboard(
    pin: str,
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Retrieve participant ranking list by score descending."""
    sess_res = await db.execute(
        select(GameSession).where(GameSession.game_pin == pin)
    )
    session = sess_res.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Game session not found.")
        
    part_res = await db.execute(
        select(Participant)
        .where(Participant.session_id == session.id)
        .order_by(Participant.score.desc())
    )
    return part_res.scalars().all()


@router.post("/{pin}/broadcast-leaderboard")
async def broadcast_leaderboard(
    pin: str,
    current_user: User = Depends(check_role(["teacher", "admin"])),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Broadcast show leaderboard event to all connected clients."""
    sess_res = await db.execute(
        select(GameSession).where(GameSession.game_pin == pin)
    )
    session = sess_res.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Game session not found.")
    if session.host_id != current_user.id:
        raise HTTPException(status_code=403, detail="Unauthorized host account.")

    await manager.broadcast(pin, "show_leaderboard", {})
    return {"status": "broadcasted"}


@router.post("/{pin}/hide-leaderboard")
async def hide_leaderboard(
    pin: str,
    current_user: User = Depends(check_role(["teacher", "admin"])),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Broadcast hide leaderboard event to all connected clients."""
    sess_res = await db.execute(
        select(GameSession).where(GameSession.game_pin == pin)
    )
    session = sess_res.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Game session not found.")
    if session.host_id != current_user.id:
        raise HTTPException(status_code=403, detail="Unauthorized host account.")

    await manager.broadcast(pin, "hide_leaderboard", {})
    return {"status": "hidden"}


@router.post("/{pin}/restart", response_model=GameSessionResponse)
async def restart_game_session(
    pin: str,
    current_user: User = Depends(check_role(["teacher", "admin"])),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Restart game session: reset status to WAITING, scores to 0, current question index to 0, and broadcast restart."""
    res = await db.execute(
        select(GameSession).where(GameSession.game_pin == pin)
    )
    session = res.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Game session not found.")
    if session.host_id != current_user.id:
        raise HTTPException(status_code=403, detail="Unauthorized host account.")

    session.status = GameSessionStatus.WAITING.value
    session.current_question_index = 0
    session.current_question_started_at = None
    session.current_question_end_time = None
    session.is_paused = False
    session.answers_locked = False
    
    # Reset participant scores
    part_res = await db.execute(
        select(Participant).where(Participant.session_id == session.id)
    )
    participants = part_res.scalars().all()
    for p in participants:
        p.score = 0
        
    await db.commit()
    await db.refresh(session)
    
    from app.services.connection_manager import manager
    manager.reset_question_state(pin)
    await manager.broadcast(pin, "restart_game", {})
    return session


@router.post("/{pin}/restart-question", response_model=GameSessionResponse)
async def restart_current_question(
    pin: str,
    current_user: User = Depends(check_role(["teacher", "admin"])),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Reset the current question timer and lock state without changing question index or scores."""
    res = await db.execute(
        select(GameSession).where(
            GameSession.game_pin == pin,
            GameSession.status == GameSessionStatus.ACTIVE.value
        )
    )
    session = res.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Active game session not found.")
    if session.host_id != current_user.id:
        raise HTTPException(status_code=403, detail="Unauthorized host account.")

    session.current_question_started_at = None
    session.current_question_end_time = None
    session.answers_locked = False
    session.is_paused = False

    await db.commit()
    await db.refresh(session)

    manager.reset_question_state(pin)

    await manager.broadcast(pin, "restart_question", {
        "current_question_index": session.current_question_index
    })
    return session


@router.get("/{pin}/analytics")
async def get_session_analytics(
    pin: str,
    current_user: User = Depends(check_role(["teacher", "admin"])),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Retrieve summarized question analysis and scorecard matrices for this finished session."""
    sess_res = await db.execute(
        select(GameSession).where(GameSession.game_pin == pin)
    )
    session = sess_res.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Game session not found.")
    if session.host_id != current_user.id:
        raise HTTPException(status_code=403, detail="Unauthorized host account.")
        
    # Get host details
    host_res = await db.execute(select(User).where(User.id == session.host_id))
    host = host_res.scalar_one_or_none()

    # Get all participants
    part_res = await db.execute(
        select(Participant).where(Participant.session_id == session.id)
    )
    participants = part_res.scalars().all()
    total_participants = len(participants)

    # Get all attempts
    user_ids = [p.user_id for p in participants if p.user_id is not None]
    attempts = []
    if user_ids:
        attempts_res = await db.execute(
            select(QuizAttempt)
            .where(
                QuizAttempt.quiz_id == session.quiz_id,
                QuizAttempt.user_id.in_(user_ids)
            )
        )
        attempts = attempts_res.scalars().all()

    attempts_by_user = {att.user_id: att for att in attempts}
    
    # Get quiz structure
    quiz_res = await db.execute(
        select(Quiz).where(Quiz.id == session.quiz_id).options(selectinload(Quiz.questions))
    )
    quiz = quiz_res.scalar_one_or_none()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found.")

    # 1. Final Leaderboard (Rank, Student, Score, Accuracy, Avg Time)
    leaderboard_data = []
    sorted_parts = sorted(participants, key=lambda x: x.score, reverse=True)
    for idx, p in enumerate(sorted_parts):
        att = attempts_by_user.get(p.user_id)
        accuracy = att.percentage if att else 0.0
        total_qs = len(att.question_analytics) if att and att.question_analytics else 0
        avg_time = (att.time_spent_seconds / total_qs) if att and total_qs > 0 else 0.0
        leaderboard_data.append({
            "rank": idx + 1,
            "nickname": p.nickname,
            "score": p.score,
            "accuracy": round(accuracy, 1),
            "average_time": round(avg_time, 1)
        })

    # 2. Class Statistics
    scores = [p.score for p in participants]
    avg_score = round(sum(scores) / len(scores), 1) if scores else 0.0
    highest_score = max(scores) if scores else 0.0
    lowest_score = min(scores) if scores else 0.0

    accuracies = [att.percentage for att in attempts if att]
    avg_accuracy = round(sum(accuracies) / len(accuracies), 1) if accuracies else 0.0

    total_time = sum([att.time_spent_seconds for att in attempts if att])
    total_qs_answered = sum([len(att.question_analytics) for att in attempts if att and att.question_analytics])
    avg_response_time = round(total_time / total_qs_answered, 1) if total_qs_answered > 0 else 0.0

    has_answered = sum(1 for att in attempts if att and len(att.question_analytics) > 0)
    participation_rate = round(has_answered / total_participants * 100, 1) if total_participants > 0 else 0.0

    completions = sum(1 for att in attempts if att and att.completed_at is not None)
    completion_rate = round(completions / total_participants * 100, 1) if total_participants > 0 else 0.0

    # 3. Score Distribution Histogram
    score_distribution = {"0-20": 0, "21-40": 0, "41-60": 0, "61-80": 0, "81-100": 0}
    for att in attempts:
        pct = att.percentage
        if pct <= 20:
            score_distribution["0-20"] += 1
        elif pct <= 40:
            score_distribution["21-40"] += 1
        elif pct <= 60:
            score_distribution["41-60"] += 1
        elif pct <= 80:
            score_distribution["61-80"] += 1
        else:
            score_distribution["81-100"] += 1

    # 4. Question-wise Stats
    question_stats = []
    for q in quiz.questions:
        q_id_str = str(q.id)
        correct_count = 0
        incorrect_count = 0
        skipped_count = 0
        q_times = []

        for att in attempts:
            q_an = att.question_analytics.get(q_id_str, {}) if att and att.question_analytics else {}
            if q_an:
                q_times.append(q_an.get("time_spent_seconds", 0))
                if q_an.get("skipped", False):
                    skipped_count += 1
                elif q_an.get("correct", False):
                    correct_count += 1
                else:
                    incorrect_count += 1
            else:
                skipped_count += 1

        total_resp = len(attempts)
        correct_pct = round(correct_count / total_resp * 100, 1) if total_resp > 0 else 0.0
        incorrect_pct = round(incorrect_count / total_resp * 100, 1) if total_resp > 0 else 0.0
        skipped_pct = round(skipped_count / total_resp * 100, 1) if total_resp > 0 else 0.0
        avg_q_time = round(sum(q_times) / len(q_times), 1) if q_times else 0.0

        if correct_pct >= 70.0:
            diff_ind = "Easy"
        elif correct_pct >= 40.0:
            diff_ind = "Medium"
        else:
            diff_ind = "Hard"

        question_stats.append({
            "id": str(q.id),
            "text": q.text,
            "correct_pct": correct_pct,
            "incorrect_pct": incorrect_pct,
            "skipped_pct": skipped_pct,
            "avg_time": avg_q_time,
            "difficulty": diff_ind
        })

    duration_seconds = 0
    if session.ended_at and session.started_at:
        duration_seconds = int((session.ended_at - session.started_at).total_seconds())

    return {
        "summary": {
            "quiz_title": session.quiz_title,
            "game_pin": session.game_pin,
            "host_name": host.full_name if host else "Unknown",
            "created_at": session.created_at,
            "started_at": session.started_at,
            "ended_at": session.ended_at,
            "duration_seconds": duration_seconds,
            "total_participants": total_participants,
            "completion_rate": completion_rate
        },
        "class_stats": {
            "average_score": avg_score,
            "average_accuracy": avg_accuracy,
            "average_response_time": avg_response_time,
            "highest_score": highest_score,
            "lowest_score": lowest_score,
            "participation_rate": participation_rate
        },
        "leaderboard": leaderboard_data,
        "question_stats": question_stats,
        "score_distribution": score_distribution
    }


async def broadcast_timer_sync(pin: str, session: GameSession):
    if session.current_question_started_at and session.current_question_end_time:
        payload = {
            "server_time": datetime.now(timezone.utc).isoformat(),
            "question_started_at": session.current_question_started_at.isoformat(),
            "question_end_time": session.current_question_end_time.isoformat(),
            "duration": session.current_question_duration or 30,
            "question_index": session.current_question_index,
            "is_paused": session.is_paused
        }
        await manager.broadcast(pin, "timer_sync", payload)


@router.get("/{pin}/state")
async def get_session_state(
    pin: str,
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Retrieve the complete live session state snapshot for reconnection recovery."""
    res = await db.execute(
        select(GameSession).where(GameSession.game_pin == pin)
    )
    session = res.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Game session not found.")
        
    # Connected count from db
    part_count_res = await db.execute(
        select(func.count(Participant.id))
        .where(Participant.session_id == session.id, Participant.connected == True)
    )
    connected_count = part_count_res.scalar() or 0
    
    # Answered count from connection manager
    from app.services.connection_manager import manager
    answered_count = len(manager.get_answered_players(pin))
    
    # Calculate remaining time
    remaining_time = 0
    if session.current_question_end_time and not session.is_paused:
        now = datetime.now(timezone.utc)
        end_time = session.current_question_end_time.replace(tzinfo=timezone.utc)
        remaining_time = max(0, int((end_time - now).total_seconds()))
        
    return {
        "status": session.status,
        "current_question_index": session.current_question_index,
        "current_question_started_at": session.current_question_started_at,
        "current_question_end_time": session.current_question_end_time,
        "remaining_time": remaining_time,
        "is_paused": session.is_paused,
        "answers_locked": session.answers_locked,
        "navigation_mode": session.question_navigation_mode,
        "leaderboard_mode": session.leaderboard_mode,
        "quiz_end_mode": session.quiz_end_mode,
        "connected_participant_count": connected_count,
        "answered_participant_count": answered_count,
        "late_join_policy": session.late_join_policy
    }


class SessionSettingsUpdatePayload(PydanticBaseModel):
    policy: Optional[str] = None
    auto_advance: Optional[bool] = None

@router.post("/{pin}/settings", response_model=GameSessionResponse)
async def update_session_settings(
    pin: str,
    payload: SessionSettingsUpdatePayload,
    current_user: User = Depends(check_role(["teacher", "admin"])),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Update game session policies and settings."""
    res = await db.execute(
        select(GameSession).where(GameSession.game_pin == pin)
    )
    session = res.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Game session not found.")
    if session.host_id != current_user.id:
        raise HTTPException(status_code=403, detail="Unauthorized host account.")

    if payload.policy is not None:
        session.late_join_policy = payload.policy
    if payload.auto_advance is not None:
        session.auto_advance = payload.auto_advance

    await db.commit()
    await db.refresh(session)

    # Broadcast settings_updated event to notify clients
    await manager.broadcast(pin, "settings_updated", {
        "late_join_policy": session.late_join_policy,
        "auto_advance": session.auto_advance
    })
    return session

@router.post("/{pin}/late-join", response_model=GameSessionResponse)
async def update_late_join_policy(
    pin: str,
    payload: SessionSettingsUpdatePayload,
    current_user: User = Depends(check_role(["teacher", "admin"])),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Update the session late join policy (retained for backward compatibility)."""
    return await update_session_settings(pin, payload, current_user, db)


class KickPlayerPayload(PydanticBaseModel):
    nickname: str

@router.post("/{pin}/kick")
async def kick_player_session(
    pin: str,
    payload: KickPlayerPayload,
    current_user: User = Depends(check_role(["teacher", "admin"])),
    db: AsyncSession = Depends(get_db)
):
    """Kick a participant from the session and notify them via WebSocket."""
    sess_res = await db.execute(
        select(GameSession).where(GameSession.game_pin == pin)
    )
    session = sess_res.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Game session not found.")
    if session.host_id != current_user.id:
        raise HTTPException(status_code=403, detail="Unauthorized host account.")
        
    part_res = await db.execute(
        select(Participant)
        .where(Participant.session_id == session.id, Participant.nickname == payload.nickname)
    )
    participant = part_res.scalar_one_or_none()
    if not participant:
        raise HTTPException(status_code=404, detail="Participant not found.")
        
    # Delete participant from DB so they cannot reconnect
    await db.delete(participant)
    await db.commit()
    
    # Broadcast kick event
    await manager.broadcast(
        pin=pin,
        msg_type="player_kicked",
        payload={"nickname": payload.nickname}
    )
    return {"status": "kicked"}


@router.delete("/{pin}")
async def delete_game_session(
    pin: str,
    current_user: User = Depends(check_role(["teacher", "admin"])),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Delete a finished or inactive game session."""
    res = await db.execute(
        select(GameSession).where(GameSession.game_pin == pin)
    )
    session = res.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Game session not found.")
    if session.host_id != current_user.id:
        raise HTTPException(status_code=403, detail="Unauthorized host account.")

    await db.delete(session)
    await db.commit()
    return {"status": "success", "message": "Game session deleted successfully."}


@router.websocket("/ws/session/{pin}")
async def websocket_endpoint(
    websocket: WebSocket,
    pin: str,
    role: str = Query("student"),
    nickname: Optional[str] = Query(None),
    token: Optional[str] = Query(None),
    connection_token: Optional[str] = Query(None)
):
    import re
    from app.database.session import AsyncSessionLocal

    # 1. Short-lived session lookup phase
    async with AsyncSessionLocal() as db:
        res = await db.execute(
            select(GameSession)
            .where(
                GameSession.game_pin == pin,
                GameSession.status.in_([GameSessionStatus.WAITING.value, GameSessionStatus.ACTIVE.value])
            )
        )
        session = res.scalar_one_or_none()
        
        if not session:
            # Close connection: Game Session not found
            await websocket.accept()
            await websocket.close(code=4001, reason="Game session not found.")
            return

        if session.status == GameSessionStatus.FINISHED.value:
            await websocket.accept()
            await websocket.close(code=4002, reason="Game session has finished.")
            return

        # Cache session scalar properties locally in function scope
        session_id = session.id
        session_status = session.status
        session_host_id = session.host_id
        session_current_question_index = session.current_question_index
        session_current_question_started_at = session.current_question_started_at
        session_current_question_end_time = session.current_question_end_time
        session_is_paused = session.is_paused
        session_answers_locked = session.answers_locked
        session_question_navigation_mode = session.question_navigation_mode
        session_leaderboard_mode = session.leaderboard_mode
        session_quiz_end_mode = session.quiz_end_mode
        session_late_join_policy = session.late_join_policy
        session_max_players = session.max_players

        # Role validation
        if role == "host":
            if not token:
                await websocket.accept()
                await websocket.close(code=4003, reason="Host authentication token required.")
                return
            
            try:
                payload = decode_token(token)
                user_id_str = payload.get("sub")
                user_id = uuid.UUID(user_id_str)
                
                # Check admin bypass
                is_admin = False
                user_res = await db.execute(select(User).where(User.id == user_id))
                user = user_res.scalar_one_or_none()
                if user and user.role == "admin":
                    is_admin = True

                if user_id != session_host_id and not is_admin:
                    await websocket.accept()
                    await websocket.close(code=4003, reason="Unauthorized host account.")
                    return
            except Exception:
                await websocket.accept()
                await websocket.close(code=4003, reason="Invalid host token.")
                return

            # Connect Host
            await manager.connect(pin, websocket)
            
            # Send timer_sync before session_state if a question is active
            if session_current_question_started_at and session_current_question_end_time:
                await websocket.send_json({
                    "type": "timer_sync",
                    "version": 1,
                    "payload": {
                        "server_time": datetime.now(timezone.utc).isoformat(),
                        "question_started_at": session_current_question_started_at.isoformat(),
                        "question_end_time": session_current_question_end_time.isoformat(),
                        "duration": session.current_question_duration or 30,
                        "question_index": session_current_question_index,
                        "is_paused": session_is_paused
                    }
                })

            # Calculate remaining time
            remaining_time = 0
            if session_current_question_end_time and not session_is_paused:
                now = datetime.now(timezone.utc)
                end_time = session_current_question_end_time.replace(tzinfo=timezone.utc)
                remaining_time = max(0, int((end_time - now).total_seconds()))

            # Send catchup session_state immediately
            await websocket.send_json({
                "type": "session_state",
                "version": 1,
                "payload": {
                    "status": session_status,
                    "server_time": datetime.now(timezone.utc).isoformat(),
                    "current_question_index": session_current_question_index,
                    "current_question_started_at": session_current_question_started_at.isoformat() if session_current_question_started_at else None,
                    "current_question_end_time": session_current_question_end_time.isoformat() if session_current_question_end_time else None,
                    "remaining_time": remaining_time,
                    "is_paused": session_is_paused,
                    "answers_locked": session_answers_locked,
                    "navigation_mode": session_question_navigation_mode,
                    "leaderboard_mode": session_leaderboard_mode,
                    "quiz_end_mode": session_quiz_end_mode,
                    "connected_participant_count": 0,
                    "answered_participant_count": len(manager.get_answered_players(pin))
                }
            })
            
            # Send initial list of participants immediately to host
            part_res = await db.execute(
                select(Participant)
                .where(Participant.session_id == session_id)
                .order_by(Participant.joined_at)
            )
            participants = part_res.scalars().all()
            await websocket.send_json({
                "type": "session_update",
                "version": 1,
                "payload": {
                    "status": session_status,
                    "participants": [
                        {
                            "id": str(p.id),
                            "nickname": p.nickname,
                            "score": p.score,
                            "connected": p.connected
                        } for p in participants
                    ]
                }
            })

        elif role == "student":
            if not nickname or not nickname.strip():
                await websocket.accept()
                await websocket.close(code=4004, reason="Nickname is required.")
                return
            
            nickname_clean = nickname.strip()
            
            # Enforce same validation rules as the HTTP join endpoint
            if not (3 <= len(nickname_clean) <= 20):
                await websocket.accept()
                await websocket.close(code=4004, reason="Nickname must be between 3 and 20 characters.")
                return
            if not re.match("^[a-zA-Z0-9_-]+$", nickname_clean):
                await websocket.accept()
                await websocket.close(code=4004, reason="Nickname contains invalid characters.")
                return
            
            # Check nickname uniqueness in this session
            nick_check = await db.execute(
                select(Participant)
                .where(
                    Participant.session_id == session_id,
                    Participant.nickname == nickname_clean
                )
            )
            participant = nick_check.scalar_one_or_none()

            if participant:
                # ── Secure connection token and nickname validation ──
                # Reject if provided connection token does not match the participant connection token
                if not connection_token or participant.connection_token != connection_token:
                    await websocket.accept()
                    await websocket.close(code=4003, reason="Invalid connection token.")
                    return

                if participant.connected:
                    # Cross-check against the in-memory live set.
                    # If the DB flag is True but there is no live WebSocket tracked for
                    # this nickname (zombie participant), allow the student to reclaim it.
                    if manager.is_nickname_live(pin, nickname_clean):
                        # Reconnect handoff: Since the connection token matches, allow the new connection
                        # to replace the old stale socket (which is closed asynchronously inside manager.connect)
                        pass
                    else:
                        # Zombie: DB says connected but no live WS exists — allow reclaim
                        logger.warning(
                            "[WS] Zombie participant detected for nickname=%s in session=%s. "
                            "Allowing WebSocket reclaim.",
                            nickname_clean, pin
                        )
                    participant.connected = True
                    await db.commit()
                else:
                    # Disconnected participant reconnecting normally
                    participant.connected = True
                    await db.commit()
            else:
                # Student must join via POST /join first
                await websocket.accept()
                await websocket.close(code=4003, reason="Must join the session via HTTP registration first.")
                return

            # Connect Student — registers websocket AND adds nickname to the live set atomically
            await manager.connect(pin, websocket, nickname=nickname_clean)
            
            # Send timer_sync before session_state if a question is active
            if session_current_question_started_at and session_current_question_end_time:
                await websocket.send_json({
                    "type": "timer_sync",
                    "version": 1,
                    "payload": {
                        "server_time": datetime.now(timezone.utc).isoformat(),
                        "question_started_at": session_current_question_started_at.isoformat(),
                        "question_end_time": session_current_question_end_time.isoformat(),
                        "duration": session.current_question_duration or 30,
                        "question_index": session_current_question_index,
                        "is_paused": session_is_paused
                    }
                })

            # Calculate remaining time
            remaining_time = 0
            if session_current_question_end_time and not session_is_paused:
                now = datetime.now(timezone.utc)
                end_time = session_current_question_end_time.replace(tzinfo=timezone.utc)
                remaining_time = max(0, int((end_time - now).total_seconds()))

            # Send catchup session_state immediately to student
            await websocket.send_json({
                "type": "session_state",
                "version": 1,
                "payload": {
                    "status": session_status,
                    "server_time": datetime.now(timezone.utc).isoformat(),
                    "current_question_index": session_current_question_index,
                    "current_question_started_at": session_current_question_started_at.isoformat() if session_current_question_started_at else None,
                    "current_question_end_time": session_current_question_end_time.isoformat() if session_current_question_end_time else None,
                    "remaining_time": remaining_time,
                    "is_paused": session_is_paused,
                    "answers_locked": session_answers_locked,
                    "navigation_mode": session_question_navigation_mode,
                    "leaderboard_mode": session_leaderboard_mode,
                    "quiz_end_mode": session_quiz_end_mode,
                    "connected_participant_count": 0,
                    "answered_participant_count": len(manager.get_answered_players(pin))
                }
            })

            # Broadcast player_joined event
            await manager.broadcast(
                pin=pin,
                msg_type="player_joined",
                payload={
                    "nickname": nickname_clean,
                    "participant_id": str(participant.id)
                }
            )
            
            # Broadcast full update
            await broadcast_session_update(pin, session_id, session_status, db)

        else:
            await websocket.accept()
            await websocket.close(code=4008, reason="Invalid role.")
            return

    # Keep connection alive
    try:
        while True:
            data_str = await websocket.receive_text()
            try:
                msg = json.loads(data_str)
                msg_type = msg.get("type")
                payload = msg.get("payload") or {}

                if msg_type == "ping":
                    await websocket.send_json({"type": "pong", "payload": {}})
                elif msg_type == "request_timer_sync":
                    async with AsyncSessionLocal() as fresh_db:
                        db_sess_res = await fresh_db.execute(select(GameSession).where(GameSession.id == session_id))
                        db_sess = db_sess_res.scalar_one_or_none()
                        if db_sess and db_sess.current_question_started_at and db_sess.current_question_end_time:
                            await websocket.send_json({
                                "type": "timer_sync",
                                "version": 1,
                                "payload": {
                                    "server_time": datetime.now(timezone.utc).isoformat(),
                                    "question_started_at": db_sess.current_question_started_at.isoformat(),
                                    "question_end_time": db_sess.current_question_end_time.isoformat(),
                                    "duration": db_sess.current_question_duration or 30,
                                    "question_index": db_sess.current_question_index,
                                    "is_paused": db_sess.is_paused
                                }
                            })
                elif msg_type == "question_loaded" and role == "student":
                    student_nickname = payload.get("nickname") or nickname_clean
                    if student_nickname:
                        manager.add_loaded_player(pin, student_nickname)
                        
                        # Get total participants registered using short-lived db
                        async with AsyncSessionLocal() as fresh_db:
                            db_count_res = await fresh_db.execute(
                                select(func.count(Participant.id)).where(Participant.session_id == session_id)
                            )
                            total_players = db_count_res.scalar() or 0
                        
                        # Broadcast question_loaded to host/players
                        await manager.broadcast(
                            pin=pin,
                            msg_type="question_loaded",
                            payload={
                                "nickname": student_nickname,
                                "loaded_count": len(manager.get_loaded_players(pin)),
                                "total_players": total_players,
                                "loaded_players": list(manager.get_loaded_players(pin))
                            }
                        )
            except Exception as e:
                logger.error(f"[WS] Error processing client message: {e}")
    except WebSocketDisconnect:
        # Deregister WebSocket and remove nickname from live set in one call
        if role == "student":
            is_stale = manager.is_stale(websocket)
            if is_stale:
                logger.info(
                    "[WS] Stale socket disconnected for nickname=%s session=%s. Skipping cleanup to preserve the new connection.",
                    nickname_clean, pin
                )
                manager.disconnect_stale(pin, websocket)
            else:
                manager.disconnect(pin, websocket, nickname=nickname_clean)
                # Persist the disconnected state and notify other clients.
                # Use a fresh short-lived DB session
                try:
                    async with AsyncSessionLocal() as fresh_db:
                        part_res = await fresh_db.execute(
                            select(Participant).where(
                                Participant.session_id == session_id,
                                Participant.nickname == nickname_clean
                            )
                        )
                        p_instance = part_res.scalar_one_or_none()
                        if p_instance:
                            p_instance.connected = False
                            await fresh_db.commit()
                            # Broadcast player_left event
                            await manager.broadcast(
                                pin=pin,
                                msg_type="player_left",
                                payload={"nickname": nickname_clean}
                            )
                            # Broadcast updated participant list
                            await broadcast_session_update(pin, session_id, session_status, fresh_db)
                except Exception as exc:
                    logger.error(
                        "[WS] Error persisting disconnect for nickname=%s session=%s: %s",
                        nickname_clean, pin, exc
                    )
        else:
            # Host disconnect — no nickname to remove
            manager.disconnect(pin, websocket)
