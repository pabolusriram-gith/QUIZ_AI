# QuizVerse AI Dependency Audit Report

This report summarizes the dependency security scanning and version analysis for QuizVerse AI.

## Scanning Methodology
The dependencies of QuizVerse AI were audited using automated tools:
1. **Backend**: `pip-audit` to cross-reference PyPI packages with the Google/OSV database of known vulnerabilities (CVEs).
2. **Frontend**: `npm audit` to check the Node.js package dependency tree against the npm public advisory database.

---

## Backend Security Review

### Direct Dependencies Scan Status
A check using `pip-audit` returned no critical or high severity vulnerabilities in direct runtime dependencies under default installation.

### Recommended Version Upgrades
While direct dependencies are secure, the following backend dependencies have newer stable releases available. Upgrades are recommended in post-release cycles:

| Package | Current Version | Latest Stable | Notes | Recommendation |
| :--- | :--- | :--- | :--- | :--- |
| **fastapi** | `>=0.110.0` | `0.115.x` | Improved starlette integration | Safe to upgrade |
| **pydantic** | `>=2.6.4` | `2.8.x` | Performance boosts | Safe to upgrade |
| **sqlalchemy** | `>=2.0.28` | `2.0.32` | Bug fixes for async drivers | Safe to upgrade |
| **redis** | `>=5.0.3` | `5.0.8` | Connection pool optimizations | Safe to upgrade |
| **bcrypt** | `>=4.0.1` | `4.2.0` | C backend improvements | Upgrade to patch security bugs |

### Security Mitigation Strategy
To prevent supply chain attacks on the python backend:
1. Use **Dependency Pinning** in `requirements.txt` with exact hashes (e.g., pip-tools `requirements.txt` compilation) rather than range constraints (`>=`).
2. Integrate `pip-audit` as a blocking step in the GitHub Actions pull request checks.

---

## Frontend Security Review

### Direct Dependencies Scan Status
Running `npm audit` against Next.js 15 and React 19 package trees shows a secure foundation. Next.js 15 and React 19 are clean of known security advisories at the current time.

### Dependency Trees & Transitive Packages
Next.js applications pull in several transitive sub-dependencies.
- **Audit Result**: No critical severity vulnerabilities found in top-level packages.
- **Transitive Issues**: Any minor warnings or peer-dependency conflicts can be resolved using `npm audit fix`.

---

## Continuous Dependency Management Action Plan

1. **Dependabot Setup**:
   Create a `.github/dependabot.yml` file to check for dependency updates daily/weekly and auto-generate PRs for security updates.
   
2. **Security Blocking**:
   Add automated dependency security scanning into the CI/CD pipeline using the configurations already included in `.github/workflows/ci-cd.yml`.

3. **Software Bill of Materials (SBOM)**:
   Generate an SBOM in SPDX format during container build stages using tools like Syft:
   `syft quizverse_backend_prod:latest -o spdx-json`
