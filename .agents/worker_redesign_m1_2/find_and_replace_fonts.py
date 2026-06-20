import os
import re

FRONTEND_DIR = r"c:\Users\Admin\Desktop\mutune\frontend\src"

# Regex to match Tailwind font size utilities with values < 12px
# e.g., text-[8px], text-[9px], text-[10px], text-[11px], text-[9.5px], text-[10.5px]
FONT_SIZE_RE = re.compile(r'\btext-\[(?:[1-9]|10|11)(?:\.\d+)?px\]\b')

def scan_and_replace():
    modified_files = []
    
    for root, dirs, files in os.walk(FRONTEND_DIR):
        for file in files:
            if not file.endswith(('.js', '.jsx', '.ts', '.tsx', '.css', '.html')):
                continue
            
            filepath = os.path.join(root, file)
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()
            except Exception as e:
                print(f"Skipping {filepath} due to error: {e}")
                continue
            
            # Find matches
            matches = FONT_SIZE_RE.findall(content)
            if matches:
                print(f"Found matches in {filepath}: {set(matches)}")
                # Replace matches with text-xs
                new_content = FONT_SIZE_RE.sub('text-xs', content)
                
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                modified_files.append(filepath)
                
    print(f"\nSuccessfully replaced font size violations in {len(modified_files)} files.")
    return modified_files

if __name__ == '__main__':
    scan_and_replace()
