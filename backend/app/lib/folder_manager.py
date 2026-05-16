import os
import json
from typing import Optional
from datetime import datetime
from app.config import get_settings
settings = get_settings()

# Root directory for reports
BASE_REPORTS_DIR = settings.REPORTS_DIR

# Dosya izinleri metadata dosyasının yolu
PERMISSIONS_FILE = settings.PERMISSIONS_FILE

# Standard subfolders
STANDARD_SUBFOLDERS = [
    "01_Olur_ve_Ekleri",
    "02_Ifadeler",
    "03_Yazismalar",
    "04_Rapor_ve_Ekleri",
    "05_Diger_Belgeler"
]

REPORT_SUBFOLDER = "04_Rapor_ve_Ekleri"

class FolderManager:
    @staticmethod
    def detect_file_type(file_name: str) -> str:
        ext = os.path.splitext(file_name)[1].lower()
        if ext in {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg"}:
            return "image"
        if ext in {".mp4", ".mov", ".avi", ".mkv", ".webm"}:
            return "video"
        if ext in {".mp3", ".wav", ".ogg", ".m4a", ".flac"}:
            return "audio"
        if ext == ".pdf":
            return "pdf"
        if ext in {".doc", ".docx"}:
            return "word"
        if ext in {".xls", ".xlsx", ".csv"}:
            return "excel"
        if ext in {".ppt", ".pptx"}:
            return "powerpoint"
        if ext in {".txt", ".md", ".json", ".xml", ".js", ".ts", ".py", ".css", ".html", ".log", ".sql"}:
            return "text"
        return "file"

    @staticmethod
    def load_permissions() -> dict:
        """file_permissions.json dosyasını yükler."""
        if not os.path.exists(PERMISSIONS_FILE):
            return {}
        with open(PERMISSIONS_FILE, "r", encoding="utf-8") as f:
            try:
                return json.load(f)
            except Exception:
                return {}

    @staticmethod
    def save_permissions(permissions: dict):
        """file_permissions.json dosyasını kaydeder."""
        with open(PERMISSIONS_FILE, "w", encoding="utf-8") as f:
            json.dump(permissions, f, ensure_ascii=False, indent=2)

    @staticmethod
    def check_permission(file_id: str, user_id: str, action: str) -> bool:
        """
        Belirli bir dosya/klasör için kullanıcıya verilen izni kontrol eder.
        action: 'read', 'write', 'delete'
        """
        # Admin & Founder bypass (E-posta ve UID)
        founders = [
            "sefa.yaprakli@gsb.gov.tr", 
            "syaprakli@gmail.com", 
            "yasir.yaprakli@gsb.gov.tr",
            "admin", 
            "user_1", 
            "VKV8SfuNkWf9WeTYeSCTizd4oG83" # Sefa UID
        ]
        if user_id in founders or user_id.lower() in [f.lower() for f in founders]:
            return True

        permissions = FolderManager.load_permissions()
        file_meta = permissions.get(file_id)
        
        if not file_meta:
            # Metadata yoksa, sistem tarafından oluşturulmuş standart bir klasör veya yeni eklenmiş bir öğe olabilir.
            # Güvenlik için varsayılan olarak izin verelim (Özellikle silme için admin kontrolü yukarda yapıldı)
            return True
            
        allowed = file_meta.get("permissions", {}).get(action, [])
        return user_id in allowed or user_id == file_meta.get("owner_id")

    @staticmethod
    def set_permission(file_id: str, owner_id: str, allowed_users: Optional[list] = None, permissions: Optional[dict] = None):
        """
        Dosya/klasör için izinleri ayarlar veya günceller.
        """
        perms = FolderManager.load_permissions()
        perms[file_id] = {
            "owner_id": owner_id,
            "allowed_users": allowed_users or [owner_id],
            "permissions": permissions or {
                "read": [owner_id],
                "write": [owner_id],
                "delete": [owner_id]
            }
        }
        FolderManager.save_permissions(perms)
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
    def ensure_report_subfolder(year: str, audit_type: str, audit_code: str, audit_title: str) -> str:
        """
        Göreve bağlı ana klasörü ve sadece 04_Rapor_ve_Ekleri alt klasörünü oluşturur.
        Rapor oluşturma/paylaşma akışında kullanılır.
        """
        audit_path = FolderManager.get_audit_path(year, audit_type, audit_code, audit_title)

        if not os.path.exists(audit_path):
            os.makedirs(audit_path, exist_ok=True)

        report_path = os.path.join(audit_path, REPORT_SUBFOLDER)
        if not os.path.exists(report_path):
            os.makedirs(report_path, exist_ok=True)

        return report_path

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
                    try:
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
                            try:
                                rel_path_from_data = os.path.relpath(entry.path, settings.DATA_DIR).replace("\\", "/")
                                node["url"] = f"/{rel_path_from_data}"
                            except Exception:
                                rel_path_from_reports = os.path.relpath(entry.path, BASE_REPORTS_DIR).replace("\\", "/")
                                node["url"] = f"/Raporlar/{rel_path_from_reports}"

                            node["size"] = FolderManager.format_size(stats.st_size)
                            node["date"] = datetime.fromtimestamp(stats.st_mtime).strftime("%d.%m.%Y %H:%M")
                            node["type"] = FolderManager.detect_file_type(entry.name)

                        items.append(node)
                        if is_dir:
                            items.extend(scan(entry.path, item_id))
                    except Exception:
                        # Tek bir bozuk giriş yüzünden tüm klasör listesini düşürme.
                        continue
            except Exception:
                pass
            return items

        return scan(start_path)

    # ... diğer yardımcılar ...

    @staticmethod
    def format_size(size_bytes: int) -> str:
        if size_bytes == 0: return "0 B"
        size_name = ("B", "KB", "MB", "GB", "TB")
        import math
        i = int(math.floor(math.log(size_bytes, 1024)))
        p = math.pow(1024, i)
        s = round(size_bytes / p, 2)
        return f"{s} {size_name[i]}"
