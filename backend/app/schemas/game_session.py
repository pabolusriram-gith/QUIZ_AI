import json
import uuid
from datetime import datetime
from typing import Optional, List, Any
from pydantic import BaseModel, ConfigDict, field_validator
from app.models.quiz import GameSessionStatus

class ParticipantBase(BaseModel):
    nickname: str
    score: float = 0.0
    connected: bool = True

class ParticipantCreate(ParticipantBase):
    pass

class ParticipantResponse(ParticipantBase):
    id: uuid.UUID
    session_id: uuid.UUID
    user_id: Optional[uuid.UUID] = None
    joined_at: datetime

    model_config = ConfigDict(from_attributes=True)

class GameSessionBase(BaseModel):
    quiz_id: uuid.UUID
    game_pin: str
    status: GameSessionStatus
    max_players: int = 50
    require_host_to_start: bool = True
    leaderboard_mode: str = "final_results_only"
    quiz_end_mode: str = "auto_end"
    correct_answer_visibility: str = "immediately"
    question_navigation_mode: str = "host_controlled"
    question_order: str = "same_for_everyone"
    option_order: str = "same_for_everyone"
    late_join_policy: str = "disable_after_start"
    is_paused: bool = False
    answers_locked: bool = False
    auto_advance: bool = False
    randomized_question_ids: Optional[List[str]] = None
    current_question_index: int = 0
    question_timer_override: Optional[int] = None

    @field_validator("randomized_question_ids", mode="before")
    @classmethod
    def coerce_randomized_question_ids(cls, v: Any) -> Optional[List[str]]:
        """Coerce the field from a JSON-encoded string to a list if needed.
        
        SQLAlchemy's asyncpg driver can sometimes return JSON columns as
        serialized strings rather than parsed Python objects, causing a
        Pydantic ResponseValidationError. This validator handles both cases.
        """
        if v is None:
            return None
        if isinstance(v, list):
            return v
        if isinstance(v, str):
            try:
                parsed = json.loads(v)
                if isinstance(parsed, list):
                    return parsed
            except (json.JSONDecodeError, ValueError):
                pass
        return v

class GameSessionCreate(BaseModel):
    quiz_id: uuid.UUID
    game_pin: Optional[str] = None
    max_players: Optional[int] = 50
    require_host_to_start: Optional[bool] = True
    leaderboard_mode: Optional[str] = "final_results_only"
    quiz_end_mode: Optional[str] = "auto_end"
    correct_answer_visibility: Optional[str] = "immediately"
    question_navigation_mode: Optional[str] = "host_controlled"
    question_order: Optional[str] = "same_for_everyone"
    option_order: Optional[str] = "same_for_everyone"
    late_join_policy: Optional[str] = "disable_after_start"
    auto_advance: Optional[bool] = False
    randomized_question_ids: Optional[List[str]] = None
    question_timer_override: Optional[int] = None

class GameSessionResponse(GameSessionBase):
    id: uuid.UUID
    host_id: uuid.UUID
    created_at: datetime
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    quiz_title: Optional[str] = None
    current_question_started_at: Optional[datetime] = None
    current_question_end_time: Optional[datetime] = None
    current_question_duration: Optional[int] = None
    pause_started_at: Optional[datetime] = None
    host_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
