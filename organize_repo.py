import os
import shutil
import glob
import re

ROOT_DIR = r"D:\QuizVersaAI"
DOCS_DIR = os.path.join(ROOT_DIR, "docs")
BACKEND_DIR = os.path.join(ROOT_DIR, "backend")

def create_dirs():
    dirs_to_create = [
        os.path.join(DOCS_DIR, "architecture"),
        os.path.join(DOCS_DIR, "deployment"),
        os.path.join(DOCS_DIR, "security"),
        os.path.join(DOCS_DIR, "testing"),
        os.path.join(DOCS_DIR, "audits"),
        os.path.join(DOCS_DIR, "reports"),
        os.path.join(BACKEND_DIR, "tests"),
        os.path.join(BACKEND_DIR, "tests", "integration"),
        os.path.join(BACKEND_DIR, "tests", "security"),
        os.path.join(BACKEND_DIR, "tests", "acceptance"),
    ]
    for d in dirs_to_create:
        os.makedirs(d, exist_ok=True)
        print(f"Created directory: {d}")

def move_files():
    # Root level docs -> docs/testing
    testing_files = [
        "AI_ACCEPTANCE_TEST.md",
        "AI_PERFORMANCE_REPORT.md",
        "AI_PIPELINE_VERIFICATION.md",
        "AI_QUALITY_REPORT.md",
        "E2E_PRODUCTION_ACCEPTANCE_REPORT.md",
        "E2E_PRODUCTION_ACCEPTANCE_WALKTHROUGH.md",
        "PHASE5_RELEASE_NOTES.md",
        "PHASE5_VERIFICATION.md",
        "PHASE5_WALKTHROUGH.md",
    ]
    for f in testing_files:
        src = os.path.join(ROOT_DIR, f)
        if os.path.exists(src):
            shutil.move(src, os.path.join(DOCS_DIR, "testing", f))
            print(f"Moved {f} to docs/testing/")

    # Architecture
    if os.path.exists(os.path.join(ROOT_DIR, "SUPABASE_RLS.md")):
        shutil.move(os.path.join(ROOT_DIR, "SUPABASE_RLS.md"), os.path.join(DOCS_DIR, "architecture", "SUPABASE_RLS.md"))
        print("Moved SUPABASE_RLS.md to docs/architecture/")

    # Backend test scripts
    # Inspecting backend/scratch contents (assuming verify_* and test_*)
    scratch_dir = os.path.join(BACKEND_DIR, "scratch")
    if os.path.exists(scratch_dir):
        for f in os.listdir(scratch_dir):
            if f.endswith(".py"):
                src = os.path.join(scratch_dir, f)
                # Read content to update relative imports if they exist
                with open(src, 'r', encoding='utf-8') as file:
                    content = file.read()
                
                # If they do relative imports from backend/, we might need to adjust them.
                # Usually python scripts in tests are run with pytest or python -m
                
                # Move logic
                dest_dir = os.path.join(BACKEND_DIR, "tests")
                if "integration" in f:
                    dest_dir = os.path.join(BACKEND_DIR, "tests", "integration")
                elif "acceptance" in f:
                    dest_dir = os.path.join(BACKEND_DIR, "tests", "acceptance")
                elif "security" in f:
                    dest_dir = os.path.join(BACKEND_DIR, "tests", "security")
                
                shutil.move(src, os.path.join(dest_dir, f))
                print(f"Moved {f} to {dest_dir}")

def update_references():
    # Update README and other markdown files
    for root, dirs, files in os.walk(ROOT_DIR):
        if "node_modules" in root or ".next" in root or "__pycache__" in root or ".git" in root:
            continue
        for f in files:
            if f.endswith(".md"):
                file_path = os.path.join(root, f)
                with open(file_path, 'r', encoding='utf-8') as file:
                    content = file.read()
                
                new_content = content
                
                # Testing files
                testing_files = ["AI_ACCEPTANCE_TEST.md", "AI_PERFORMANCE_REPORT.md", "AI_PIPELINE_VERIFICATION.md", "AI_QUALITY_REPORT.md", "E2E_PRODUCTION_ACCEPTANCE_REPORT.md", "E2E_PRODUCTION_ACCEPTANCE_WALKTHROUGH.md", "PHASE5_RELEASE_NOTES.md", "PHASE5_VERIFICATION.md", "PHASE5_WALKTHROUGH.md"]
                for tf in testing_files:
                    new_content = new_content.replace(f"./{tf}", f"./docs/testing/{tf}")
                    new_content = new_content.replace(f" {tf}", f" docs/testing/{tf}")
                
                if new_content != content:
                    with open(file_path, 'w', encoding='utf-8') as file:
                        file.write(new_content)
                    print(f"Updated references in {file_path}")

def clean_artifacts():
    # Clean pycache
    for root, dirs, files in os.walk(ROOT_DIR):
        if "__pycache__" in dirs:
            pycache_path = os.path.join(root, "__pycache__")
            shutil.rmtree(pycache_path)
            print(f"Removed cache: {pycache_path}")
        for f in files:
            if f.endswith(".pyc"):
                os.remove(os.path.join(root, f))
                print(f"Removed artifact: {os.path.join(root, f)}")

if __name__ == "__main__":
    create_dirs()
    move_files()
    update_references()
    clean_artifacts()
    print("Organization complete.")
