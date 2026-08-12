# QuizVerse AI – End-to-End Final Acceptance Test Walkthrough

This document records the walkthrough steps attempted during the Final Production Acceptance Testing of the QuizVerse AI application.

---

## Step 1: Verification of Running Services

1. **Frontend Server Check**:
   - URL: `http://127.0.0.1:3000`
   - Action: Checked accessibility.
   - Result: **ONLINE** (Next.js server serving the login page correctly).

2. **Backend Server Check**:
   - URL: `http://127.0.0.1:8000/health`
   - Action: Checked accessibility.
   - Result: **ONLINE** (FastAPI backend returned status `online` and version `1.0.0`).

3. **Database Connectivity**:
   - URL: `http://127.0.0.1:8000/health/db`
   - Action: Checked db health.
   - Result: **ONLINE** (PostgreSQL database successfully connected).

4. **Redis Connectivity**:
   - URL: `http://127.0.0.1:8000/health/redis`
   - Action: Checked redis health.
   - Result: **OFFLINE / DISCONNECTED** (FastAPI returned a 503 error; using local in-memory fallback connection manager).

---

## Step 2: Automated Acceptance Test Checks (BLOCKED)

- **Attempted Action**: Run validation scripts (e.g. `verify_priority_2.py`, `acceptance_tester.py`, etc.) via the terminal.
- **Encountered Error**:
  ```
  The shell cannot be started. A failure occurred during initialization:
  The type initializer for 'System.Net.ServicePointManager' threw an exception.
  ```
- **Result**: **BLOCKED** from the agent's side.

---

## Step 3: Browser E2E Test Execution (BLOCKED)

- **Attempted Action**: Invoked Playwright browser subagent to execute the Teacher/Student live quiz session workflows.
- **Encountered Error**:
  The subagent failed to open the browser because the Playwright driver distribution CDNs returned `404 Not Found` for the `playwright-1.57.0-win32_x64.zip` package:
  ```
  failed to create browser context: failed to run playwright manager: failed to install playwright: could not install driver: got non 200 status code: 404 (404 Not Found) from https://playwright.azureedge.net/builds/driver/playwright-1.57.0-win32_x64.zip
  ```
- **Result**: **BLOCKED** from the agent's side.

---

## Step 4: Step-by-Step Manual Walkthrough Instructions for Developers

Since browser automation is blocked by CDN and runner constraints, the developer should execute the following test workflow manually in local browsers to complete the acceptance test:

1. **Teacher Registration & Login**:
   - Open `http://localhost:3000/register` in a standard browser.
   - Create a Teacher account (check "Teacher" role selection).
   - Log in at `http://localhost:3000/login`.

2. **AI Quiz Generation**:
   - Go to `/create-quiz`.
   - Select **AI Quiz Generator** and select `Easy` difficulty, `multiple_choice` type, and `auto` marks mode.
   - Click **Generate AI Quiz**.
   - Verify all 3 questions are generated with `Easy` difficulty and exactly `1` mark assigned.
   - Change the first question's difficulty select to **Medium** -> verify marks update to `2`. Change it to **Hard** -> verify marks update to `5`. Change back to **Easy** -> verify marks return to `1`.
   - Edit the question text (e.g. add ` - Edited`). Confirm the warning banner is shown.
   - Click **Restore Original AI**. Verify the question reverts to the original AI generated text and the banner disappears.
   - Click **Save & Continue** or **Publish**.

3. **Live Session & Sync**:
   - Go to `/dashboard/live-quiz`. Select the quiz, turn off "Auto Generate PIN", and input `1234` as the custom PIN.
   - Turn **Auto Advance** to **Disabled**. Click **Create Session**.
   - Open `http://localhost:3000` in a separate **Incognito window**.
   - Join with PIN `1234` and nickname `Student_E2E_Test`.
   - Verify the student appears on the Teacher's host lobby screen.
   - Start the quiz. Check that question text and option orders match exactly on both windows.
   - Submit an answer as the Student. Verify that options are locked immediately and cannot be changed or resubmitted.
   - Let the timer run to 0. Verify that the quiz **does NOT** automatically advance (Auto Advance is OFF).
   - On the Teacher side, toggle **Auto Advance** to **Enabled**. Go to question 2. Let the timer run to 0. Verify the quiz **automatically advances** to question 3.
   - Refresh the Student page -> verify state and connection recover correctly.
   - Refresh the Teacher page -> verify session recovers correctly.
   - Complete the quiz.
   - Verify the Student final screen displays their score, rank, and a working **View Certificate** link.
   - Verify Teacher analytics and Student history dashboards update correctly.
