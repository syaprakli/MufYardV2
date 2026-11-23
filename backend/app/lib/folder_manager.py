import os
import json
import logging
import shutil
import tempfile
import threading
from typing import Callable, Optional
from datetime import datetime
from app.config import get_settings
settings = get_settings()

# Root directory for reports
BASE_REPORTS_DIR = settings.REPORTS_DIR
BASE_OTHER_DIR = settings.OTHER_DIR

# Dosya izinleri metadata dosyasının yolu
PERMISSIONS_FILE = settings.PERMISSIONS_FILE

_logger = logging.getLogger(__name__)
# Okuma-değiştir-yaz işlemleri thread'ler ve event loop arasında seri hâle getirilir.
_perm_lock = threading.RLock()
# (mtime_ns, size) -> parse edilmiş içerik; her izin kontrolünde JSON yeniden okunmaz.
_perm_cache: dict = {"key": None, "data": None, "corrupt": False}


class PermissionsCorruptError(RuntimeError):
    """İzin dosyası ve yedeği okunamıyor; boş içerikle üzerine yazmak tüm izinleri silerdi."""


def _permissions_backup_path() -> str:
    return PERMISSIONS_FILE + ".bak"


def _read_permissions_file(path: str) -> dict:
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, dict):
        raise ValueError("izin dosyası bir JSON nesnesi değil")
    return data

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
    def extract_year(date_str: Optional[str]) -> str:
        """Robustly extracts the 4-digit year from any date format string."""
        if not date_str:
            return str(datetime.utcnow().year)
        
        date_str = str(date_str).strip()
        if not date_str:
            return str(datetime.utcnow().year)

        # 1. Try dot notation (DD.MM.YYYY)
        if '.' in date_str:
            parts = date_str.split('.')
            if len(parts) >= 3:
                year_part = parts[2].split()[0]
                if year_part.isdigit() and len(year_part) == 4:
                    return year_part

        # 2. Try hyphen/dash notation (YYYY-MM-DD or DD-MM-YYYY)
        if '-' in date_str:
            parts = date_str.split('-')
            # Check YYYY-MM-DD
            if len(parts) >= 1 and parts[0].isdigit() and len(parts[0]) == 4:
                return parts[0]
            # Check DD-MM-YYYY
            if len(parts) >= 3:
                year_part = parts[2].split()[0]
                if year_part.isdigit() and len(year_part) == 4:
                    return year_part

        # 3. Try slash notation (DD/MM/YYYY or YYYY/MM/DD)
        if '/' in date_str:
            parts = date_str.split('/')
            # Check YYYY/MM/DD
            if len(parts) >= 1 and parts[0].isdigit() and len(parts[0]) == 4:
                return parts[0]
            # Check DD/MM/YYYY
            if len(parts) >= 3:
                year_part = parts[2].split()[0]
                if year_part.isdigit() and len(year_part) == 4:
                    return year_part

        # 4. Standard datetime format checks
        for fmt in ('%Y-%m-%d', '%d.%m.%Y', '%d/%m/%Y', '%Y-%m-%dT%H:%M:%S', '%Y-%m-%dT%H:%M:%S.%fZ'):
            try:
                return str(datetime.strptime(date_str, fmt).year)
            except ValueError:
                pass

        # 5. Regex search fallback for a 4-digit year
        import re
        matches = re.findall(r'\b(20\d{2})\b', date_str)
        if matches:
            return matches[0]

        return str(datetime.utcnow().year)

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
        """file_permissions.json dosyasını yükler (önbellekli).

        Dosya bozuksa yedekten okunur; ikisi de okunamazsa {} döner (erişim reddedilir) ve
        bozuk durum işaretlenir, böylece save_permissions boş içerikle üzerine yazmaz.
        Dönen sözlük üst seviyede kopyadır; çağıran değiştirebilir.
        """
        with _perm_lock:
            if not os.path.exists(PERMISSIONS_FILE):
                if os.path.exists(_permissions_backup_path()):
                    try:
                        data = _read_permissions_file(_permissions_backup_path())
                        _logger.error("İzin dosyası yok, yedekten okundu: %s", _permissions_backup_path())
                        return dict(data)
                    except Exception:
                        pass
                _perm_cache.update(key=None, data=None, corrupt=False)
                return {}
            st = os.stat(PERMISSIONS_FILE)
            key = (st.st_mtime_ns, st.st_size)
            if _perm_cache["key"] == key and _perm_cache["data"] is not None:
                return dict(_perm_cache["data"])
            try:
                data = _read_permissions_file(PERMISSIONS_FILE)
            except Exception as main_err:
                try:
                    data = _read_permissions_file(_permissions_backup_path())
                    _logger.error("İzin dosyası bozuk (%s); yedekten okundu.", main_err)
                except Exception:
                    _logger.critical("İzin dosyası ve yedeği okunamıyor (%s). Erişimler reddedilecek.", main_err)
                    _perm_cache.update(key=key, data={}, corrupt=True)
                    return {}
            _perm_cache.update(key=key, data=data, corrupt=False)
            return dict(data)

    @staticmethod
    def save_permissions(permissions: dict):
        """file_permissions.json dosyasını atomik kaydeder (geçici dosya + os.replace; önceki sürüm .bak)."""
        if not isinstance(permissions, dict):
            raise TypeError("permissions bir dict olmalı")
        with _perm_lock:
            FolderManager.load_permissions()  # bozukluk durumunu güncelle
            if _perm_cache.get("corrupt"):
                raise PermissionsCorruptError(
                    "İzin dosyası ve yedeği okunamıyor; veri kaybını önlemek için kayıt yapılmadı."
                )
            target_dir = os.path.dirname(PERMISSIONS_FILE) or "."
            os.makedirs(target_dir, exist_ok=True)
            fd, tmp_path = tempfile.mkstemp(prefix=".file_permissions.", suffix=".tmp", dir=target_dir)
            try:
                with os.fdopen(fd, "w", encoding="utf-8") as f:
                    json.dump(permissions, f, ensure_ascii=False, indent=2)
                    f.flush()
                    os.fsync(f.fileno())
                if os.path.exists(PERMISSIONS_FILE):
                    shutil.copy2(PERMISSIONS_FILE, _permissions_backup_path())
                os.replace(tmp_path, PERMISSIONS_FILE)
            except BaseException:
                try:
                    os.remove(tmp_path)
                except OSError:
                    pass
                raise
            st = os.stat(PERMISSIONS_FILE)
            _perm_cache.update(key=(st.st_mtime_ns, st.st_size), data=dict(permissions), corrupt=False)

    @staticmethod
    def update_permissions(mutator: Callable[[dict], Optional[dict]]) -> dict:
        """Kilit altında oku-değiştir-yaz. mutator sözlüğü yerinde değiştirebilir veya yeni sözlük dönebilir."""
        with _perm_lock:
            perms = FolderManager.load_permissions()
            result = mutator(perms)
            new_perms = perms if result is None else result
            FolderManager.save_permissions(new_perms)
            return new_perms

    @staticmethod
    def check_permission(file_id: str, user_id: str, action: str) -> bool:
        """
        Belirli bir dosya/klasör için kullanıcıya verilen izni kontrol eder.
        action: 'read', 'write', 'delete'
        """
        permissions = FolderManager.load_permissions()
        norm_id = (file_id or "").replace("\\", "/").strip("/")
        file_meta = permissions.get(norm_id) or permissions.get(file_id)
        if not file_meta:
            # Metadata yoksa erişim izni verilmez (daha güvenli varsayılan)
            return False
        allowed = file_meta.get("permissions", {}).get(action, [])
        return user_id in allowed or user_id == file_meta.get("owner_id")

    @staticmethod
    def check_permission_or_ancestor(file_id: str, user_id: str, action: str) -> bool:
        """
        Dosyanın kendisinde veya üst klasörlerinden birinde izin olup olmadığını kontrol eder.
        """
        norm_id = (file_id or "").replace("\\", "/").strip("/")
        if not norm_id:
            return False
        permissions = FolderManager.load_permissions()
        parts = [p for p in norm_id.split("/") if p]
        for i in range(len(parts), 0, -1):
            candidate = "/".join(parts[:i])
            meta = permissions.get(candidate)
            if meta:
                allowed = meta.get("permissions", {}).get(action, [])
                if user_id in allowed or user_id == meta.get("owner_id"):
                    return True
        return False

    @staticmethod
    def set_permission(file_id: str, owner_id: str, allowed_users: Optional[list] = None, permissions: Optional[dict] = None):
        """
        Dosya/klasör için izinleri ayarlar veya günceller.
        """
        entry = {
            "owner_id": owner_id,
            "allowed_users": allowed_users or [owner_id],
            "permissions": permissions or {
                "read": [owner_id],
                "write": [owner_id],
                "delete": [owner_id]
            }
        }

        def _apply(perms: dict) -> None:
            perms[file_id] = entry

        FolderManager.update_permissions(_apply)
    @staticmethod
    def format_safe_name(name: str) -> str:
        """Removes illegal characters for folder names."""
        return "".join([c if c.isalnum() or c in (" ", "-", "_", ".") else "_" for c in name]).strip()

    @staticmethod
    def get_audit_path(year: str, audit_type: str, audit_code: str, audit_title: str) -> str:
        """Generates the hierarchical path: Raporlar/Year/Type/Code - Title"""
        # Replace '/' with '-' to keep prefixes like S.Y.64/ safe on Windows
        clean_code = audit_code.replace("/", "-")

        safe_code = FolderManager.format_safe_name(clean_code)
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
    def get_audit_relative_path(year: str, audit_type: str, audit_code: str, audit_title: str) -> str:
        """Generates the hierarchical path relative to BASE_REPORTS_DIR"""
        full_path = FolderManager.get_audit_path(year, audit_type, audit_code, audit_title)
        return os.path.relpath(full_path, BASE_REPORTS_DIR).replace("\\", "/")

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
        """Recursively scans the directory and returns a tree structure."""
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
 
                        item_id = os.path.relpath(entry.path, start_path).replace("\\", "/")
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
                                rel_path_from_start = os.path.relpath(entry.path, start_path).replace("\\", "/")
                                route_prefix = "Diğer İşlem ve Belgeler" if start_path == BASE_OTHER_DIR else "Raporlar"
                                node["url"] = f"/{route_prefix}/{rel_path_from_start}"
 
                            node["size"] = FolderManager.format_size(stats.st_size)
                            node["date"] = datetime.fromtimestamp(stats.st_mtime).strftime("%d.%m.%Y %H:%M")
                            node["type"] = FolderManager.detect_file_type(entry.name)
 
                        items.append(node)
                        if is_dir:
                            items.extend(scan(entry.path, item_id))
                    except Exception:
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
