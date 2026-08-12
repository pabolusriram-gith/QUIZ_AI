import sys
import os
import asyncio
import httpx
from sqlalchemy import select

# Add backend directory to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database.session import AsyncSessionLocal
from app.models.user import User
from app.core.security import create_access_token

async def verify():
    print("[*] Accessing database to find a teacher...")
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(User).where(User.role == "teacher").limit(1))
        teacher = res.scalar_one_or_none()
        if not teacher:
            print("[-] No teacher user found in database.")
            return
        print(f"[+] Found teacher: {teacher.email} (ID: {teacher.id})")
        
        # Generate token
        token = create_access_token(
            subject=teacher.id,
            role=teacher.role,
            token_version=teacher.token_version
        )
        print("[+] Generated JWT Access Token.")
        
        # Call endpoint
        async with httpx.AsyncClient() as client:
            headers = {"Authorization": f"Bearer {token}"}
            print("[*] Requesting GET http://localhost:8000/api/v1/quizzes/reports...")
            response = await client.get("http://localhost:8000/api/v1/quizzes/reports", headers=headers, timeout=10.0)
            print(f"[+] Response status code: {response.status_code}")
            if response.status_code == 200:
                data = response.json()
                print(f"[+] Response keys: {list(data.keys())}")
                print(f"[+] Quizzes count: {len(data.get('quizzes', []))}")
                print(f"[+] Students count: {len(data.get('students', []))}")
                print(f"[+] Attempts count: {len(data.get('attempts', []))}")
                print("[SUCCESS] Reports endpoint verified successfully!")
            else:
                print(f"[-] Failed with body: {response.text}")

if __name__ == "__main__":
    asyncio.run(verify())
