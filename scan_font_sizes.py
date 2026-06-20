import os
import re

# Directory to scan
scan_dir = r"c:\Users\Admin\Desktop\mutune\frontend"

# Regex patterns
# 1. Tailwind arbitrary font sizes: text-[1px] to text-[11px]
# 2. Tailwind rem font sizes: text-[0.0rem] to text-[0.74rem]
# 3. CSS font-size: 1px to 11px
# 4. CSS font-size: 0.0rem to 0.74rem
patterns = {
    "Tailwind px": re.compile(r"text-\[([1-9]|10|11)px\]"),
    "Tailwind rem": re.compile(r"text-\[(0\.[0-6]\d*|0\.7[0-4]\d*)rem\]"),
    "CSS px": re.compile(r"font-size:\s*([1-9]|10|11)px"),
    "CSS rem": re.compile(r"font-size:\s*(0\.[0-6]\d*|0\.7[0-4]\d*)rem"),
}

extensions = (".js", ".jsx", ".ts", ".tsx", ".css", ".html")
violations = []

for root, dirs, files in os.walk(scan_dir):
    # Skip node_modules and dist
    if "node_modules" in root or "dist" in root or ".git" in root:
        continue
    for file in files:
        if not file.endswith(extensions):
            continue
        filepath = os.path.join(root, file)
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                for line_num, line in enumerate(f, 1):
                    for label, pattern in patterns.items():
                        matches = pattern.findall(line)
                        if matches:
                            violations.append({
                                "file": os.path.relpath(filepath, scan_dir),
                                "line": line_num,
                                "match": [f"{label}: {m}" for m in matches],
                                "content": line.strip()
                            })
        except Exception as e:
            print(f"Error reading {filepath}: {e}")

print(f"Total violations found: {len(violations)}")
for v in violations:
    print(f"{v['file']}:{v['line']} - {v['match']} - {v['content']}")
