import os
from datetime import datetime

# Root directory for reports
BASE_REPORTS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "Raporlar")

# Standard subfolders
STANDARD_SUBFOLDERS = [
    "01_Olur_ve_Ekleri",
    "02_Ifadeler",
    "03_Yazismalar",
    "04_Rapor_ve_Ekleri",
    "05_Diger_Belgeler"
]

class FolderManager:
    @staticmethod
    def format_safe_name(name: str) -> str:
        """Removes illegal characters for folder names."""
        return "".join([c if c.isalnum() or c in (" ", "-", "_", ".") else "_" for c in name]).strip()

    @staticmethod
    def get_audit_path(year: str, audit_type: str, audit_code: str, audit_title: str) -> str:
        """Generates the hierarchical path: Raporlar/Year/Type/Code - Title"""
        safe_code = FolderManager.format_safe_name(audit_code)
        safe_title = FolderManager.format_safe_name(audit_title)
        
        # Determine Type Label (Turkish)
        type_labels = {
            "inceleme": "İnceleme",
            "sorusturma": "Soruşturma",
            "genel_denetim": "Genel_Denetim",
            "ozel_yurt": "Özel_Yurt",
            "kyk_yurt": "KYK_Yurt",
            "il_mudurlugu": "İl_Müdürlüğü",
            "federasyon": "Federasyon",
            "kulup": "Kulüp"
        }
        type_folder = type_labels.get(audit_type, FolderManager.format_safe_name(audit_type))
        
        folder_name = f"{safe_code} - {safe_title}"
        return os.path.join(BASE_REPORTS_DIR, year, type_folder, folder_name)

    @staticmethod
    def ensure_audit_folders(year: str, audit_type: str, audit_code: str, audit_title: str) -> str:
        """
        Creates the hierarchical folder structure and the 5 standard subfolders.
        Returns the absolute path of the root audit folder.
        """
        audit_path = FolderManager.get_audit_path(year, audit_type, audit_code, audit_title)
        
        # Create Main Folder
        if not os.path.exists(audit_path):
            os.makedirs(audit_path, exist_ok=True)
        
        # Create Standard Subfolders
        for sub in STANDARD_SUBFOLDERS:
            sub_path = os.path.join(audit_path, sub)
            if not os.path.exists(sub_path):
                os.makedirs(sub_path, exist_ok=True)
                
        return audit_path

    @staticmethod
    def get_tree(start_path: str = BASE_REPORTS_DIR):
        """Recursively scans the Raporlar directory and returns a tree structure."""
        if not os.path.exists(start_path):
            os.makedirs(start_path, exist_ok=True)
            
        tree = []
        def scan(current_path, parent_id=None):
            items = []
            try:
                for entry in os.scandir(current_path):
                    if entry.name.startswith("."):
                        continue
                    
                    item_id = os.path.relpath(entry.path, BASE_REPORTS_DIR).replace("\\", "/")
                    is_dir = entry.is_dir()
                    
                    node = {
                        "id": item_id,
                        "name": entry.name,
                        "type": "folder" if is_dir else "file",
                        "parentId": parent_id
                    }
                    
                    if not is_dir:
                        stats = entry.stat()
                        node["size"] = FolderManager.format_size(stats.st_size)
                        node["date"] = datetime.fromtimestamp(stats.st_mtime).strftime("%d.%m.%Y %H:%M")
                    
                    items.append(node)
                    if is_dir:
                        items.extend(scan(entry.path, item_id))
            except Exception:
                pass
            return items

        return scan(start_path)

    @staticmethod
    def format_size(size_bytes: int) -> str:
        if size_bytes == 0: return "0 B"
        size_name = ("B", "KB", "MB", "GB", "TB")
        import math
        i = int(math.floor(math.log(size_bytes, 1024)))
        p = math.pow(1024, i)
        s = round(size_bytes / p, 2)
        return f"{s} {size_name[i]}"
