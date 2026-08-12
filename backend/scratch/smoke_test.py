import os
import sys
import py_compile
import asyncio

# Setup sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

def test_compile():
    print("[*] Running py_compile on backend/app/main.py...")
    try:
        py_compile.compile("app/main.py", doraise=True)
        print("[+] Compiles successfully!")
        return True
    except Exception as e:
        print("[-] Compile failed:", e)
        return False

async def run_handler_tests():
    print("[*] Testing health check handler logic...")
    # Import main after compilation check
    from app.main import health_check, db_health_check, redis_health_check, all_health_check
    
    # 1. Test basic health check
    res_health = await health_check()
    print("[+] /health response:", res_health)
    assert res_health["status"] == "online"
    
    # 2. Test redis health check (should return disconnected error cleanly if redis not running)
    print("[*] Calling /health/redis...")
    res_redis = await redis_health_check()
    print("[+] /health/redis response status:", res_redis)
    
    # 3. Test db health check (should return error cleanly if DB not running)
    print("[*] Calling /health/db...")
    try:
        from app.database.session import AsyncSessionLocal
        async with AsyncSessionLocal() as session:
            res_db = await db_health_check(db=session)
            print("[+] /health/db response:", res_db)
    except Exception as e:
        print("[*] /health/db returned exception (expected if connection unconfigured):", type(e).__name__)

    # 4. Test unified health check
    print("[*] Calling /health/all...")
    try:
        async with AsyncSessionLocal() as session:
            res_all = await all_health_check(db=session)
            print("[+] /health/all response:", res_all)
    except Exception as e:
        print("[*] /health/all returned exception:", type(e).__name__)

def validate_nginx():
    print("[*] Checking Nginx configurations for brace consistency...")
    for conf_path in ["../nginx/nginx.conf", "../nginx/quizverse.conf"]:
        if not os.path.exists(conf_path):
            print(f"[-] Config file {conf_path} not found.")
            return False
        with open(conf_path, "r") as f:
            content = f.read()
            open_braces = content.count("{")
            close_braces = content.count("}")
            if open_braces != close_braces:
                print(f"[-] Brace mismatch in {conf_path}: {open_braces} open, {close_braces} close")
                return False
            else:
                print(f"[+] {conf_path} brace check passed: {open_braces} matched braces.")
    return True

if __name__ == "__main__":
    success = test_compile()
    if success:
        success = validate_nginx()
    if success:
        try:
            asyncio.run(run_handler_tests())
            print("[+] All local smoke tests executed successfully!")
        except Exception as e:
            print("[-] Handler test failed:", e)
            sys.exit(1)
    else:
        sys.exit(1)
