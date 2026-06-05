import os

base_dir = r"c:\Users\sefa\.gemini\antigravity\playground\TAMAMLANANLAR\MUF YARD\MufYardV2\frontend\src\pages"

files_to_clean = [
    "DenetimBilgiBankasi.tsx",
    "DenetimFederasyon.tsx",
    "DenetimIl.tsx",
    "DenetimKyk.tsx",
    "DenetimOzel.tsx",
    "DenetimSpor.tsx"
]

# 1. Clean ChecklistQuestion imports
for filename in files_to_clean:
    filepath = os.path.join(base_dir, filename)
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
    
    # Replace ChecklistQuestion import
    content = content.replace(
        'import { AUDIT_TEMPLATES, type ChecklistQuestion } from "../lib/auditTemplates";',
        'import { AUDIT_TEMPLATES } from "../lib/auditTemplates";'
    )
    
    # 2. Specifically for DenetimSpor.tsx, remove unused RAPOR_SABLONLARI import
    if filename == "DenetimSpor.tsx":
        content = content.replace('import { RAPOR_SABLONLARI } from "./Tasks";', "")
        
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)

# 3. Clean unused Plus import in ReportEditor.tsx
editor_path = os.path.join(base_dir, "ReportEditor.tsx")
with open(editor_path, "r", encoding="utf-8") as f:
    editor_content = f.read()

# Replace Plus in lucide-react imports
# Let's inspect lucide-react import in ReportEditor.tsx or do a replace
editor_content = editor_content.replace("Plus,", "")
editor_content = editor_content.replace(", Plus", "")

with open(editor_path, "w", encoding="utf-8") as f:
    f.write(editor_content)

print("Unused imports cleaned successfully.")
