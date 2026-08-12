import uuid
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field

# Question Option Schemas
class QuestionOptionBase(BaseModel):
    text: str
    is_correct: bool = False
    display_order: int = 0

class QuestionOptionCreate(QuestionOptionBase):
    pass

class QuestionOptionUpdate(BaseModel):
    id: Optional[uuid.UUID] = None
    text: str
    is_correct: bool
    display_order: int = 0

class QuestionOptionResponse(QuestionOptionBase):
    id: uuid.UUID
    question_id: uuid.UUID
    
    model_config = ConfigDict(from_attributes=True)


# Question Schemas
class QuestionBase(BaseModel):
    text: str
    difficulty: str  # easy, medium, hard
    topic: str
    marks: int
    explanation: Optional[str] = None
    question_type: str = "multiple_choice"
    bloom_level: Optional[str] = None
    subtopic: Optional[str] = None
    estimated_time: Optional[int] = None  # in seconds
    negative_marks: float = 0.0
    hint: Optional[str] = None
    ai_generated: bool = False
    version: int = 1
    order_index: int = 0
    time_limit_seconds: Optional[int] = None
    
    # AI and Course Outcomes metadata
    course_outcome: Optional[str] = None
    reference: Optional[str] = None
    ai_provider: Optional[str] = None
    ai_model: Optional[str] = None
    generated_by_ai: bool = False
    generated_at: Optional[datetime] = None
    critic_score: Optional[float] = None
    is_user_modified: bool = False
    ai_original_json: Optional[str] = None
    shuffle_seed: Optional[int] = None

class QuestionCreate(QuestionBase):
    options: List[QuestionOptionCreate] = Field(default_factory=list)

class QuestionUpdate(BaseModel):
    id: Optional[uuid.UUID] = None
    text: Optional[str] = None
    difficulty: Optional[str] = None
    topic: Optional[str] = None
    marks: Optional[int] = None
    explanation: Optional[str] = None
    question_type: Optional[str] = None
    bloom_level: Optional[str] = None
    subtopic: Optional[str] = None
    estimated_time: Optional[int] = None
    negative_marks: Optional[float] = None
    hint: Optional[str] = None
    ai_generated: Optional[bool] = None
    version: Optional[int] = None
    order_index: Optional[int] = None
    time_limit_seconds: Optional[int] = None
    
    # AI and Course Outcomes metadata
    course_outcome: Optional[str] = None
    reference: Optional[str] = None
    ai_provider: Optional[str] = None
    ai_model: Optional[str] = None
    generated_by_ai: Optional[bool] = None
    generated_at: Optional[datetime] = None
    critic_score: Optional[float] = None
    is_user_modified: Optional[bool] = None
    ai_original_json: Optional[str] = None
    shuffle_seed: Optional[int] = None
    options: Optional[List[QuestionOptionUpdate]] = None

class QuestionResponse(QuestionBase):
    id: uuid.UUID
    quiz_id: uuid.UUID
    options: List[QuestionOptionResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


# Quiz Schemas
class QuizBase(BaseModel):
    title: str
    description: Optional[str] = None
    subject: str
    duration: int  # in minutes
    randomize_questions: bool = False
    randomize_options: bool = False
    anti_cheating_enabled: bool = False
    ai_feedback_enabled: bool = False
    department: Optional[str] = None
    semester: Optional[str] = None
    total_marks: int = 0
    pass_percentage: float = 40.0
    visibility: str = "public"
    status: str = "draft"
    language: str = "en"
    fullscreen_required: bool = False
    adaptive_mode: bool = False
    allow_review: bool = True
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    quiz_code: str
    published_at: Optional[datetime] = None
    max_attempts: int = 1
    timer_mode: str = "none"
    overall_time_limit_seconds: Optional[int] = None
    auto_submit_on_expiry: bool = True
    marks_mode: str = "default"
    default_marks: int = 1
    
    # Extended settings
    available_from: Optional[datetime] = None
    available_until: Optional[datetime] = None
    result_visibility: str = "immediate"
    show_score: bool = True
    show_answers: bool = True
    show_explanations: bool = True
    show_solutions: bool = True
    show_marks: bool = True
    shuffle_questions: bool = False
    shuffle_options: bool = False
    access_code: Optional[str] = None
    custom_instructions: Optional[str] = None
    
    # AI metadata settings
    ai_provider: Optional[str] = None
    ai_model: Optional[str] = None
    generation_prompt: Optional[str] = None
    generated_by_ai: bool = False
    generation_source: Optional[str] = None
    generated_at: Optional[datetime] = None

class QuizCreate(QuizBase):
    questions: List[QuestionCreate] = Field(default_factory=list)

class QuizUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    subject: Optional[str] = None
    duration: Optional[int] = None
    randomize_questions: Optional[bool] = None
    randomize_options: Optional[bool] = None
    anti_cheating_enabled: Optional[bool] = None
    ai_feedback_enabled: Optional[bool] = None
    department: Optional[str] = None
    semester: Optional[str] = None
    total_marks: Optional[int] = None
    pass_percentage: Optional[float] = None
    visibility: Optional[str] = None
    status: Optional[str] = None
    language: Optional[str] = None
    fullscreen_required: Optional[bool] = None
    adaptive_mode: Optional[bool] = None
    allow_review: Optional[bool] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    quiz_code: Optional[str] = None
    published_at: Optional[datetime] = None
    max_attempts: Optional[int] = None
    timer_mode: Optional[str] = None
    overall_time_limit_seconds: Optional[int] = None
    auto_submit_on_expiry: Optional[bool] = None
    marks_mode: Optional[str] = None
    default_marks: Optional[int] = None
    
    # Extended settings
    available_from: Optional[datetime] = None
    available_until: Optional[datetime] = None
    result_visibility: Optional[str] = None
    show_score: Optional[bool] = None
    show_answers: Optional[bool] = None
    show_explanations: Optional[bool] = None
    show_solutions: Optional[bool] = None
    show_marks: Optional[bool] = None
    shuffle_questions: Optional[bool] = None
    shuffle_options: Optional[bool] = None
    access_code: Optional[str] = None
    custom_instructions: Optional[str] = None
    
    # AI metadata settings
    ai_provider: Optional[str] = None
    ai_model: Optional[str] = None
    generation_prompt: Optional[str] = None
    generated_by_ai: Optional[bool] = None
    generation_source: Optional[str] = None
    generated_at: Optional[datetime] = None
    questions: Optional[List[QuestionUpdate]] = None

class QuizResponse(QuizBase):
    id: uuid.UUID
    created_by_id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    questions: List[QuestionResponse] = Field(default_factory=list)
    game_session_pin: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
