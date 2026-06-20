import os
import re

patterns = [
    (re.compile(r'text-\[(\d+(?:\.\d+)?)px\]'), lambda val: val < 12.0, "Tailwind px < 12px"),
    (re.compile(r'text-\[(\d+(?:\.\d+)?)rem\]'), lambda val: val < 0.75, "Tailwind rem < 0.75rem"),
    (re.compile(r'text-\[(\d+(?:\.\d+)?)em\]'), lambda val: val < 0.75, "Tailwind em < 0.75em"),
    (re.compile(r'font-size:\s*(\d+(?:\.\d+)?)px'), lambda val: val < 12.0, "CSS px < 12px"),
    (re.compile(r'font-size:\s*(\d+(?:\.\d+)?)rem'), lambda val: val < 0.75, "CSS rem < 0.75rem"),
    (re.compile(r'font-size:\s*(\d+(?:\.\d+)?)em'), lambda val: val < 0.75, "CSS em < 0.75em"),
]

def scan_file(file_path):
    violations = []
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            for idx, line in enumerate(f, 1):
                for regex, check_fn, desc in patterns:
                    for match in regex.finditer(line):
                        val = float(match.group(1))
                        if check_fn(val):
                            violations.append({
                                'line': idx,
                                'match': match.group(0),
                                'value': val,
                                'desc': desc,
                                'content': line.strip()
                            })
    except Exception as e:
        pass
    return violations

def main():
    root_dir = r"c:\Users\Admin\Desktop\mutune\frontend\src"
    total_violations = 0
    file_count = 0
    
    print("Scanning directory:", root_dir)
    for root, dirs, files in os.walk(root_dir):
        for file in files:
            if file.endswith(('.js', '.jsx', '.ts', '.tsx', '.css')):
                file_path = os.path.join(root, file)
                file_count += 1
                violations = scan_file(file_path)
                if violations:
                    print(f"\nFile: {os.path.relpath(file_path, root_dir)}")
                    for v in violations:
                        print(f"  Line {v['line']}: Found '{v['match']}' ({v['desc']}) -> {v['content']}")
                        total_violations += 1
                        
    print(f"\nScan completed. Scanned {file_count} files. Found {total_violations} font-size violations.")

if __name__ == "__main__":
    main()
