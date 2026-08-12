@echo off
echo Starting QuizVersaAI...

echo Starting Backend (FastAPI)...
start "QuizVersaAI Backend" cmd /k "cd backend && venv\Scripts\activate && uvicorn app.main:app --reload --port 8000"

echo Starting Frontend (Next.js)...
start "QuizVersaAI Frontend" cmd /k "cd frontend && npm run dev"

echo Done! Both services should open in new command prompt windows.
