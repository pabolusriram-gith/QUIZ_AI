import os

def search_files(directory, query):
    print(f"Searching for '{query}' in {directory}...")
    count = 0
    for root, dirs, files in os.walk(directory):
        if "node_modules" in root or ".next" in root:
            continue
        for file in files:
            if file.endswith((".ts", ".tsx", ".js", ".jsx", ".css", ".json")):
                filepath = os.path.join(root, file)
                try:
                    with open(filepath, "r", encoding="utf-8") as f:
                        for line_num, line in enumerate(f, 1):
                            if query.lower() in line.lower():
                                print(f"{filepath}:{line_num}: {line.strip()}")
                                count += 1
                                if count > 50:
                                    print("Too many results, stopping.")
                                    return
                except Exception as e:
                    pass

if __name__ == "__main__":
    import sys
    query = sys.argv[1] if len(sys.argv) > 1 else "marks_mode"
    search_files("d:\\QuizVersaAI\\frontend\\src", query)
