import uuid
import enum
from datetime import datetime, timezone
from sqlalchemy import String, Boolean, DateTime, Integer, Float, Text, ForeignKey, JSON, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.session import Base
from app.models.user import User


class QuizStatus(str, enum.Enum):
    DRAFT = "draft"
    PUBLISHED = "published"


class QuestionType(str, enum.Enum):
    MULTIPLE_CHOICE = "multiple_choice"
    MULTIPLE_SELECT = "multiple_select"
    TRUE_FALSE = "true_false"
    FILL_IN_THE_BLANK = "fill_in_the_blank"
    SHORT_ANSWER = "short_answer"


class TimerMode(str, enum.Enum):
    NONE = "none"
    OVERALL = "overall"
    PER_QUESTION = "per_question"
    BOTH = "both"


class Quiz(Base):
    __tablename__ = "quizzes"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    subject: Mapped[str] = mapped_column(String(255), nullable=False)
    duration: Mapped[int] = mapped_column(Integer, nullable=False)  # in minutes
    randomize_questions: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    randomize_options: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    anti_cheating_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    ai_feedback_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    
    # Advanced / AI Fields
    department: Mapped[str | None] = mapped_column(String(255), nullable=True)
    semester: Mapped[str | None] = mapped_column(String(50), nullable=True)
    total_marks: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    pass_percentage: Mapped[float] = mapped_column(Float, default=40.0, nullable=False)
    visibility: Mapped[str] = mapped_column(String(50), default="public", nullable=False)
    status: Mapped[str] = mapped_column(String(50), default=QuizStatus.DRAFT.value, nullable=False)
    language: Mapped[str] = mapped_column(String(50), default="en", nullable=False)
    fullscreen_required: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    adaptive_mode: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    allow_review: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    start_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    end_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # User requested additions
    quiz_code: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    marks_mode: Mapped[str] = mapped_column(String(50), default="default", nullable=False)
    default_marks: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    max_attempts: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    
    # Extended settings
    available_from: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    available_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    result_visibility: Mapped[str] = mapped_column(String(50), default="immediate", nullable=False)
    show_score: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    show_answers: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    show_explanations: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    show_solutions: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    show_marks: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    shuffle_questions: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    shuffle_options: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    access_code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    custom_instructions: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    # Timer settings
    timer_mode: Mapped[str] = mapped_column(String(50), default=TimerMode.NONE.value, nullable=False)
    overall_time_limit_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    auto_submit_on_expiry: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # AI metadata settings
    ai_provider: Mapped[str | None] = mapped_column(String(50), nullable=True)
    ai_model: Mapped[str | None] = mapped_column(String(100), nullable=True)
    generation_prompt: Mapped[str | None] = mapped_column(Text, nullable=True)
    generated_by_ai: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    generation_source: Mapped[str | None] = mapped_column(String(100), nullable=True)
    generated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_by_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    # Relationships
    created_by: Mapped["User"] = relationship("User", back_populates="quizzes")
    questions: Mapped[list["Question"]] = relationship(
        "Question",
        back_populates="quiz",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="Question.order_index, Question.created_at"
    )
    attempts: Mapped[list["QuizAttempt"]] = relationship(
        "QuizAttempt",
        back_populates="quiz",
        cascade="all, delete-orphan"
    )

    @property
    def game_session_pin(self) -> str | None:
        return getattr(self, "_game_session_pin", None)

    @game_session_pin.setter
    def game_session_pin(self, value: str | None):
        self._game_session_pin = value

    def __repr__(self) -> str:
        return f"<Quiz id={self.id} title={self.title} quiz_code={self.quiz_code}>"


class Question(Base):
    __tablename__ = "questions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True
    )
    quiz_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("quizzes.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    text: Mapped[str] = mapped_column(Text, nullable=False)
    difficulty: Mapped[str] = mapped_column(String(50), nullable=False)  # easy, medium, hard
    topic: Mapped[str] = mapped_column(String(255), nullable=False)
    marks: Mapped[int] = mapped_column(Integer, nullable=False)
    explanation: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    # Advanced / AI Fields
    question_type: Mapped[str] = mapped_column(String(50), default=QuestionType.MULTIPLE_CHOICE.value, nullable=False)
    bloom_level: Mapped[str | None] = mapped_column(String(50), nullable=True)
    subtopic: Mapped[str | None] = mapped_column(String(255), nullable=True)
    estimated_time: Mapped[int | None] = mapped_column(Integer, nullable=True)  # in seconds
    negative_marks: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    hint: Mapped[str | None] = mapped_column(Text, nullable=True)
    ai_generated: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    time_limit_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # AI and Course Outcomes metadata
    course_outcome: Mapped[str | None] = mapped_column(String(100), nullable=True)
    reference: Mapped[str | None] = mapped_column(String(255), nullable=True)
    ai_provider: Mapped[str | None] = mapped_column(String(50), nullable=True)
    ai_model: Mapped[str | None] = mapped_column(String(100), nullable=True)
    generated_by_ai: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    generated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    critic_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    is_user_modified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    ai_original_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    shuffle_seed: Mapped[int | None] = mapped_column(Integer, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    # Relationships
    quiz: Mapped["Quiz"] = relationship("Quiz", back_populates="questions")
    options: Mapped[list["QuestionOption"]] = relationship(
        "QuestionOption",
        back_populates="question",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="QuestionOption.display_order"
    )

    def __repr__(self) -> str:
        return f"<Question id={self.id} quiz_id={self.quiz_id}>"


class QuestionOption(Base):
    __tablename__ = "question_options"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True
    )
    question_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("questions.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    text: Mapped[str] = mapped_column(Text, nullable=False)
    is_correct: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    # Relationships
    question: Mapped["Question"] = relationship("Question", back_populates="options")

    def __repr__(self) -> str:
        return f"<QuestionOption id={self.id} question_id={self.question_id} is_correct={self.is_correct}>"


class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    quiz_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("quizzes.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    percentage: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    passed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    time_spent_seconds: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    
    # JSON columns
    answers: Mapped[dict | list | None] = mapped_column(JSON, nullable=True)
    question_analytics: Mapped[dict | list | None] = mapped_column(JSON, nullable=True)
    randomized_question_ids: Mapped[list | None] = mapped_column(JSON, nullable=True)
    randomized_option_ids: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    
    # Anti-cheating logs
    tab_switch_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    fullscreen_exit_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    copy_paste_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="attempts")
    quiz: Mapped["Quiz"] = relationship("Quiz", back_populates="attempts")

    def __repr__(self) -> str:
        return f"<QuizAttempt id={self.id} user_id={self.user_id} quiz_id={self.quiz_id} score={self.score}>"


class GameSessionStatus(str, enum.Enum):
    WAITING = "waiting"
    ACTIVE = "active"
    FINISHED = "finished"


class GameSession(Base):
    __tablename__ = "game_sessions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True
    )
    quiz_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("quizzes.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    host_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    game_pin: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default=GameSessionStatus.WAITING.value, nullable=False)
    max_players: Mapped[int] = mapped_column(Integer, default=50, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )
    started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    ended_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    question_timer_override: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True
    )

    # Live Session Settings & Control Columns
    require_host_to_start: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    leaderboard_mode: Mapped[str] = mapped_column(String(50), default="final_results_only", nullable=False)
    quiz_end_mode: Mapped[str] = mapped_column(String(50), default="auto_end", nullable=False)
    correct_answer_visibility: Mapped[str] = mapped_column(String(50), default="immediately", nullable=False)
    question_navigation_mode: Mapped[str] = mapped_column(String(50), default="host_controlled", nullable=False)
    question_order: Mapped[str] = mapped_column(String(50), default="same_for_everyone", nullable=False)
    option_order: Mapped[str] = mapped_column(String(50), default="same_for_everyone", nullable=False)
    late_join_policy: Mapped[str] = mapped_column(String(50), default="disable_after_start", nullable=False)
    is_paused: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    answers_locked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    auto_advance: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    randomized_question_ids: Mapped[list | None] = mapped_column(JSON, nullable=True)
    current_question_index: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    current_question_started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    current_question_end_time: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    current_question_duration: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True
    )
    pause_started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )

    # Relationships
    quiz: Mapped["Quiz"] = relationship("Quiz")
    host: Mapped["User"] = relationship("User")
    participants: Mapped[list["Participant"]] = relationship(
        "Participant",
        back_populates="session",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="Participant.joined_at"
    )

    def __repr__(self) -> str:
        return f"<GameSession id={self.id} game_pin={self.game_pin} status={self.status}>"


class Participant(Base):
    __tablename__ = "participants"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("game_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    nickname: Mapped[str] = mapped_column(String(255), nullable=False)
    score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )
    connected: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    connection_token: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Relationships
    session: Mapped["GameSession"] = relationship("GameSession", back_populates="participants")

    # Unique Constraint to prevent duplicate nicknames in the same session
    __table_args__ = (
        UniqueConstraint('session_id', 'nickname', name='_session_nickname_uc'),
    )

    def __repr__(self) -> str:
        return f"<Participant id={self.id} nickname={self.nickname} connected={self.connected}>"
