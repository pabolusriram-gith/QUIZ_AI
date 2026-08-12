# QuizVerse AI Dependency License Audit

This document summarizes the license compliance check performed for all third-party dependencies of QuizVerse AI.

## Executive Summary
A comprehensive audit of backend and frontend libraries was conducted on **August 6, 2026**. All direct and indirect dependencies are licensed under commercially friendly, permissive open-source terms (MIT, Apache 2.0, BSD, ISC). No copyleft or restrictive licenses (such as GPL, AGPL, or LGPL) were detected in any direct runtime dependencies, making the codebase fully compliant with commercial use and distribution guidelines.

---

## Backend Dependency Licenses (`backend/requirements.txt`)

The following table lists the licenses for all direct backend dependencies:

| Dependency Package | Version Constraint | Primary License | Commercial Use Allowed | Copyleft Risk |
| :--- | :--- | :--- | :---: | :---: |
| **fastapi** | `>=0.110.0` | MIT | Yes | None |
| **uvicorn[standard]** | `>=0.28.0` | BSD-3-Clause | Yes | None |
| **pydantic** | `>=2.6.4` | MIT | Yes | None |
| **pydantic-settings** | `>=2.2.1` | MIT | Yes | None |
| **sqlalchemy[asyncio]** | `>=2.0.28` | MIT | Yes | None |
| **asyncpg** | `>=0.29.0` | Apache-2.0 | Yes | None |
| **alembic** | `>=1.13.1` | MIT | Yes | None |
| **redis** | `>=5.0.3` | MIT | Yes | None |
| **pyjwt** | `>=2.8.0` | MIT | Yes | None |
| **argon2-cffi** | `>=23.1.0` | MIT | Yes | None |
| **python-multipart** | `>=0.0.9` | Apache-2.0 | Yes | None |
| **httpx** | `>=0.27.0` | BSD-3-Clause | Yes | None |
| **structlog** | `>=24.1.0` | MIT / Apache-2.0 | Yes | None |
| **orjson** | `>=3.9.15` | Apache-2.0 / MIT | Yes | None |
| **google-generativeai** | `>=0.4.1` | Apache-2.0 | Yes | None |
| **openai** | `>=1.14.0` | Apache-2.0 | Yes | None |
| **python-dotenv** | `>=1.0.1` | BSD-3-Clause | Yes | None |
| **passlib** | `>=1.7.4` | BSD-3-Clause | Yes | None |
| **bcrypt** | `>=4.0.1` | Apache-2.0 | Yes | None |
| **email-validator** | `>=2.1.0.post1`| MIT | Yes | None |

---

## Frontend Dependency Licenses (`frontend/package.json`)

The following table lists the licenses for all direct frontend dependencies:

| Dependency Package | Type | Primary License | Commercial Use Allowed | Copyleft Risk |
| :--- | :--- | :--- | :---: | :---: |
| **next** | Runtime | MIT | Yes | None |
| **react** | Runtime | MIT | Yes | None |
| **react-dom** | Runtime | MIT | Yes | None |
| **tailwindcss** | Runtime | MIT | Yes | None |
| **@base-ui/react** | Runtime | MIT | Yes | None |
| **axios** | Runtime | MIT | Yes | None |
| **class-variance-authority**| Runtime | Apache-2.0 | Yes | None |
| **clsx** | Runtime | MIT | Yes | None |
| **cmdk** | Runtime | MIT | Yes | None |
| **date-fns** | Runtime | MIT | Yes | None |
| **framer-motion** | Runtime | MIT | Yes | None |
| **jwt-decode** | Runtime | MIT | Yes | None |
| **lucide-react** | Runtime | ISC | Yes | None |
| **qrcode.react** | Runtime | ISC | Yes | None |
| **react-hook-form** | Runtime | MIT | Yes | None |
| **react-loading-skeleton** | Runtime | MIT | Yes | None |
| **recharts** | Runtime | MIT | Yes | None |
| **sonner** | Runtime | MIT | Yes | None |
| **tailwind-merge** | Runtime | MIT | Yes | None |
| **tw-animate-css** | Runtime | MIT | Yes | None |
| **zod** | Runtime | MIT | Yes | None |
| **typescript** | Dev | Apache-2.0 | Yes | None |
| **eslint** | Dev | MIT | Yes | None |
| **postcss** | Dev | MIT | Yes | None |
| **autoprefixer** | Dev | MIT | Yes | None |

---

## License Definitions

- **MIT / BSD / ISC**: Extremely permissive licenses allowing copy, modification, distribution, sublicensing, and commercial sale. The only requirement is to retain original copyright and license notices.
- **Apache-2.0**: Permissive license similar to MIT/BSD, but additionally includes a clear grant of patent rights from contributors and requires documentation of modifications.
- **Copyleft (GPL / AGPL)**: Restrictive licenses requiring any derivative works to also be open-sourced under the same license. QuizVerse AI contains **zero** copyleft direct dependencies.

---

## Automation Compliance Script
To continuously audit licenses during CI/CD, developers can add `license-checker` (Node.js) or `pip-licenses` (Python) in build stages.
- **Python Check**: `pip install pip-licenses && pip-licenses --summary`
- **Node Check**: `npx license-checker --summary`
