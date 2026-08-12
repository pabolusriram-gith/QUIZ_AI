import uuid
from datetime import datetime
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field


class QuizAttemptCreate(BaseModel):
    access_code: Optional[str] = None


class QuizAttemptProgress(BaseModel):
    answers: Dict[str, List[str]] = Field(default_factory=dict)
    question_analytics: Dict[str, Any] = Field(default_factory=dict)
    time_spent_seconds: int = 0
    tab_switch_count: int = 0
    fullscreen_exit_count: int = 0
    copy_paste_count: int = 0


class QuizAttemptSubmit(BaseModel):
    answers: Dict[str, List[str]] = Field(default_factory=dict)
    question_analytics: Dict[str, Any] = Field(default_factory=dict)
    time_spent_seconds: int = 0
    tab_switch_count: int = 0
    fullscreen_exit_count: int = 0
    copy_paste_count: int = 0


class QuizAttemptResponse(BaseModel):
    id: uuid.UUID
    quiz_id: uuid.UUID
    user_id: uuid.UUID
    score: float
    percentage: float
    passed: bool
    time_spent_seconds: int
    answers: Optional[Dict[str, List[str]]] = None
    question_analytics: Optional[Dict[str, Any]] = None
    randomized_question_ids: Optional[List[str]] = None
    randomized_option_ids: Optional[Dict[str, List[str]]] = None
    tab_switch_count: int
    fullscreen_exit_count: int
    copy_paste_count: int
    started_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class QuizAttemptResultResponse(BaseModel):
    id: uuid.UUID
    quiz_id: uuid.UUID
    score: float
    percentage: float
    passed: bool
    time_spent_seconds: int
    completed_at: datetime
    
    # Permissions
    show_score: bool
    show_answers: bool
    show_explanations: bool
    show_solutions: bool
    show_marks: bool
    
    total_questions: int
    correct_count: int
    incorrect_count: int
    graded_questions: List[Dict[str, Any]]

    class Config:
        from_attributes = True
