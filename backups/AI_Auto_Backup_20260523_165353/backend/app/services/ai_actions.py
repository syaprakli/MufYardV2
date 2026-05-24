"""
AI Function Calling — Aksiyon Yürütücü

Gemini'nin function_call yanıtlarını alıp gerçek service çağrılarına dönüştürür.
Desteklenen aksiyonlar:
  - create_task         : Görev/rapor oluşturma
  - create_audit        : Denetim başlatma
  - create_contact      : Rehbere kişi ekleme
  - delete_contact      : Rehberden kişi silme (sadece kendi eklediği)
  - create_post         : Kamusal alanda konu açma
  - delete_post         : Kendi açtığı konuyu silme
  - send_message        : DM / mesaj gönderme
  - create_calendar_note: Takvime not ekleme
  - delete_calendar_note: Takvim notunu silme
  - list_calendar_notes : Takvim notlarını listeleme
  - create_note         : Hızlı not oluşturma
  - delete_note         : Hızlı not silme
  - list_notes          : Hızlı notları listeleme
  - list_files          : Rapor dosyalarını listeleme
  - read_file_content   : Dosya içeriğini okuma (PDF/DOCX/TXT)
  - read_legislation    : Belirli bir mevzuatı detaylı okuma ve analiz etme
"""
import asyncio
import os
import google.generativeai as genai
from typing import Any, Dict, List
from datetime import datetime

from app.services.task_service import TaskService
from app.services.audit_service import AuditService
from app.services.contact_service import ContactService
from app.services.collaboration_service import CollaborationService
from app.services.note_service import NoteService
from app.services.legislation_service import LegislationService
from app.lib.firebase_admin import db
from app.lib.folder_manager import FolderManager, BASE_REPORTS_DIR
from app.schemas.task import TaskCreate
from app.schemas.audit import AuditCreate
from app.schemas.contact import ContactCreate
from app.schemas.post import PostCreate
from app.schemas.messaging import MessageCreate
from app.schemas.note import NoteCreate


# ─── Gemini Tool Tanımları ───────────────────────────────────────

AI_TOOLS = [
    genai.protos.Tool(
        function_declarations=[
            genai.protos.FunctionDeclaration(
                name="create_task",
                description="Yeni bir görev (rapor görevi) oluşturur. Müfettişe görev atamak, denetim planlamak için kullanılır.",
                parameters=genai.protos.Schema(
                    type=genai.protos.Type.OBJECT,
                    properties={
                        "rapor_adi": genai.protos.Schema(type=genai.protos.Type.STRING, description="Görev/rapor adı. Örn: 'Bolu KYK Genel Denetimi'"),
                        "rapor_turu": genai.protos.Schema(type=genai.protos.Type.STRING, description="Rapor türü: 'Genel Denetim', 'Soruşturma', 'İnceleme', 'Ön İnceleme', 'Spor Kulüpleri'"),
                        "baslama_tarihi": genai.protos.Schema(type=genai.protos.Type.STRING, description="Başlangıç tarihi YYYY-MM-DD formatında"),
                        "sure_gun": genai.protos.Schema(type=genai.protos.Type.INTEGER, description="Süre (gün). Varsayılan 30"),
                    },
                    required=["rapor_adi"],
                ),
            ),
            genai.protos.FunctionDeclaration(
                name="create_audit",
                description="Yeni bir denetim kaydı oluşturur ve rapor editörünü başlatır.",
                parameters=genai.protos.Schema(
                    type=genai.protos.Type.OBJECT,
                    properties={
                        "title": genai.protos.Schema(type=genai.protos.Type.STRING, description="Denetim/kurum adı. Örn: 'Ankara Spor Salonu Denetimi'"),
                        "location": genai.protos.Schema(type=genai.protos.Type.STRING, description="Denetim yeri. Örn: 'Ankara'"),
                        "date": genai.protos.Schema(type=genai.protos.Type.STRING, description="Denetim tarihi. Örn: '2026-04-15'"),
                        "description": genai.protos.Schema(type=genai.protos.Type.STRING, description="Kısa açıklama"),
                    },
                    required=["title", "location"],
                ),
            ),
            genai.protos.FunctionDeclaration(
                name="create_contact",
                description="Rehbere yeni bir kişi ekler.",
                parameters=genai.protos.Schema(
                    type=genai.protos.Type.OBJECT,
                    properties={
                        "name": genai.protos.Schema(type=genai.protos.Type.STRING, description="Kişi adı soyadı"),
                        "title": genai.protos.Schema(type=genai.protos.Type.STRING, description="Unvan. Örn: 'Müfettiş', 'Şube Müdürü'"),
                        "unit": genai.protos.Schema(type=genai.protos.Type.STRING, description="Birim adı"),
                        "phone": genai.protos.Schema(type=genai.protos.Type.STRING, description="Telefon numarası"),
                        "email": genai.protos.Schema(type=genai.protos.Type.STRING, description="E-posta adresi"),
                        "is_shared": genai.protos.Schema(type=genai.protos.Type.BOOLEAN, description="Kurumsal rehberde paylaşılsın mı? Varsayılan false"),
                    },
                    required=["name", "title", "unit", "phone"],
                ),
            ),
            genai.protos.FunctionDeclaration(
                name="delete_contact",
                description="Kullanıcının kendi eklediği bir kişiyi rehberden siler. Sadece kendi eklediği kişiler silinebilir.",
                parameters=genai.protos.Schema(
                    type=genai.protos.Type.OBJECT,
                    properties={
                        "contact_name": genai.protos.Schema(type=genai.protos.Type.STRING, description="Silinecek kişinin adı (tam veya kısmi eşleşme)"),
                    },
                    required=["contact_name"],
                ),
            ),
            genai.protos.FunctionDeclaration(
                name="create_post",
                description="Kamusal alanda (forum) yeni bir konu/gönderi açar.",
                parameters=genai.protos.Schema(
                    type=genai.protos.Type.OBJECT,
                    properties={
                        "title": genai.protos.Schema(type=genai.protos.Type.STRING, description="Konu başlığı"),
                        "content": genai.protos.Schema(type=genai.protos.Type.STRING, description="Konu içeriği"),
                        "category": genai.protos.Schema(type=genai.protos.Type.STRING, description="Kategori: 'Mevzuat', 'Denetim İpuçları', 'Soru-Cevap', 'Duyurular', 'Genel'"),
                    },
                    required=["title", "content"],
                ),
            ),
            genai.protos.FunctionDeclaration(
                name="delete_post",
                description="Kullanıcının kendi açtığı bir konuyu siler. Sadece kendi açtığı konular silinebilir.",
                parameters=genai.protos.Schema(
                    type=genai.protos.Type.OBJECT,
                    properties={
                        "post_title": genai.protos.Schema(type=genai.protos.Type.STRING, description="Silinecek konunun başlığı (tam veya kısmi eşleşme)"),
                    },
                    required=["post_title"],
                ),
            ),
            genai.protos.FunctionDeclaration(
                name="send_message",
                description="Ekip sohbetine (genel chat) mesaj gönderir.",
                parameters=genai.protos.Schema(
                    type=genai.protos.Type.OBJECT,
                    properties={
                        "text": genai.protos.Schema(type=genai.protos.Type.STRING, description="Gönderilecek mesaj metni"),
                    },
                    required=["text"],
                ),
            ),
            # ─── TAKVİM NOTLARI ───
            genai.protos.FunctionDeclaration(
                name="create_calendar_note",
                description="Takvime yeni bir not/etkinlik ekler. Belirli bir tarih ve saate not düşmek için kullanılır.",
                parameters=genai.protos.Schema(
                    type=genai.protos.Type.OBJECT,
                    properties={
                        "date": genai.protos.Schema(type=genai.protos.Type.STRING, description="Not tarihi, YYYY-M-D formatında. Örn: '2026-4-15'"),
                        "text": genai.protos.Schema(type=genai.protos.Type.STRING, description="Not metni. Örn: 'Bolu denetimi çıkışı'"),
                        "time": genai.protos.Schema(type=genai.protos.Type.STRING, description="Saat, HH:MM formatında. Örn: '09:00'. Belirtilmezse '09:00' kullan"),
                    },
                    required=["date", "text"],
                ),
            ),
            genai.protos.FunctionDeclaration(
                name="delete_calendar_note",
                description="Kullanıcının takviminden bir notu siler. Not metni ile aranır.",
                parameters=genai.protos.Schema(
                    type=genai.protos.Type.OBJECT,
                    properties={
                        "note_text": genai.protos.Schema(type=genai.protos.Type.STRING, description="Silinecek notun metni veya bir kısmı (kısmi eşleşme)"),
                    },
                    required=["note_text"],
                ),
            ),
            genai.protos.FunctionDeclaration(
                name="list_calendar_notes",
                description="Kullanıcının takvimindeki notları listeler. Tarih filtresi uygulanabilir.",
                parameters=genai.protos.Schema(
                    type=genai.protos.Type.OBJECT,
                    properties={
                        "date": genai.protos.Schema(type=genai.protos.Type.STRING, description="Opsiyonel — belirli bir tarih için filtrele. YYYY-M-D formatında."),
                    },
                ),
            ),
            # ─── HIZLI NOTLAR ───
            genai.protos.FunctionDeclaration(
                name="create_note",
                description="Hızlı not defterine yeni bir not ekler.",
                parameters=genai.protos.Schema(
                    type=genai.protos.Type.OBJECT,
                    properties={
                        "title": genai.protos.Schema(type=genai.protos.Type.STRING, description="Not başlığı"),
                        "text": genai.protos.Schema(type=genai.protos.Type.STRING, description="Not içeriği"),
                        "color": genai.protos.Schema(type=genai.protos.Type.STRING, description="Not rengi: 'amber', 'blue', 'green', 'red', 'purple'. Varsayılan 'amber'"),
                        "is_pinned": genai.protos.Schema(type=genai.protos.Type.BOOLEAN, description="Sabitlensin mi? Varsayılan false"),
                    },
                    required=["title", "text"],
                ),
            ),
            genai.protos.FunctionDeclaration(
                name="delete_note",
                description="Kullanıcının hızlı notlarından birini siler. Not başlığı ile aranır.",
                parameters=genai.protos.Schema(
                    type=genai.protos.Type.OBJECT,
                    properties={
                        "note_title": genai.protos.Schema(type=genai.protos.Type.STRING, description="Silinecek notun başlığı (kısmi eşleşme)"),
                    },
                    required=["note_title"],
                ),
            ),
            genai.protos.FunctionDeclaration(
                name="list_notes",
                description="Kullanıcının tüm hızlı notlarını listeler.",
                parameters=genai.protos.Schema(
                    type=genai.protos.Type.OBJECT,
                    properties={},
                ),
            ),
            # ─── DOSYA ERİŞİMİ ───
            genai.protos.FunctionDeclaration(
                name="list_files",
                description="Rapor klasöründeki dosya ve klasörleri listeler. Belirli bir klasör yolu verilebilir.",
                parameters=genai.protos.Schema(
                    type=genai.protos.Type.OBJECT,
                    properties={
                        "path": genai.protos.Schema(type=genai.protos.Type.STRING, description="Opsiyonel — listelenecek alt klasör yolu. Örn: '2026/Genel Denetim'. Boş bırakılırsa kök Raporlar klasörü listelenir."),
                    },
                ),
            ),
            genai.protos.FunctionDeclaration(
                name="read_file_content",
                description="Rapor klasöründeki bir dosyanın içeriğini okur. PDF, DOCX ve TXT dosyaları desteklenir.",
                parameters=genai.protos.Schema(
                    type=genai.protos.Type.OBJECT,
                    properties={
                        "file_path": genai.protos.Schema(type=genai.protos.Type.STRING, description="Dosya yolu (Raporlar klasörüne göreceli). Örn: '2026/Genel Denetim/rapor.pdf'"),
                    },
                    required=["file_path"],
                ),
            ),
            # ─── MEVZUAT OKUMA ───
            genai.protos.FunctionDeclaration(
                name="read_legislation",
                description="Belirli bir mevzuat belgesini detaylı okur ve içeriğini döndürür. Mevzuat analizi, karşılaştırma veya derinlemesine inceleme için kullanılır.",
                parameters=genai.protos.Schema(
                    type=genai.protos.Type.OBJECT,
                    properties={
                        "legislation_title": genai.protos.Schema(type=genai.protos.Type.STRING, description="Mevzuat belgesinin adı veya bir kısmı (kısmi eşleşme). Örn: 'KYK Yönetmeliği'"),
                    },
                    required=["legislation_title"],
                ),
            ),
        ]
    )
]


# ─── Aksiyon Çalıştırıcı ────────────────────────────────────────

async def execute_action(
    function_name: str,
    args: Dict[str, Any],
    user: Dict[str, Any],
) -> Dict[str, Any]:
    """Gemini'nin döndüğü function_call'ı çalıştırır ve sonucu döner."""
    uid = user.get("uid", "")
    email = user.get("email", "")
    display_name = user.get("display_name") or email.split("@")[0] if email else "Müfettiş"

    try:
        if function_name == "create_task":
            task = TaskCreate(
                rapor_adi=args.get("rapor_adi", "Yeni Görev"),
                rapor_turu=args.get("rapor_turu", "Genel Denetim"),
                baslama_tarihi=args.get("baslama_tarihi", datetime.now().strftime("%Y-%m-%d")),
                sure_gun=args.get("sure_gun", 30),
                owner_id=uid,
                assigned_to=[uid],
            )
            result = await TaskService.create_task(task)
            return {
                "success": True,
                "action": "create_task",
                "message": f"✅ Görev oluşturuldu: **{result.get('rapor_adi')}** (Kod: {result.get('rapor_kodu', '-')})",
                "data": {"id": result.get("id"), "rapor_kodu": result.get("rapor_kodu"), "rapor_adi": result.get("rapor_adi")},
            }

        elif function_name == "create_audit":
            audit = AuditCreate(
                title=args.get("title", "Yeni Denetim"),
                location=args.get("location", ""),
                date=args.get("date", datetime.now().strftime("%Y-%m-%d")),
                status="Devam Ediyor",
                inspector=display_name,
                description=args.get("description", ""),
                owner_id=uid,
                assigned_to=[uid],
            )
            result = await AuditService.create_audit(audit)
            return {
                "success": True,
                "action": "create_audit",
                "message": f"✅ Denetim başlatıldı: **{result.get('title')}** — {result.get('location')}",
                "data": {"id": result.get("id"), "title": result.get("title")},
            }

        elif function_name == "create_contact":
            contact = ContactCreate(
                name=args.get("name", ""),
                title=args.get("title", ""),
                unit=args.get("unit", ""),
                phone=args.get("phone", ""),
                email=args.get("email", ""),
                is_shared=args.get("is_shared", False),
                owner_id=uid,
            )
            result = await ContactService.create_contact(contact)
            return {
                "success": True,
                "action": "create_contact",
                "message": f"✅ Rehbere eklendi: **{result.get('name')}** ({result.get('title')})",
                "data": {"id": result.get("id"), "name": result.get("name")},
            }

        elif function_name == "delete_contact":
            contact_name = args.get("contact_name", "")
            # Kullanıcının kendi kişilerini ara
            contacts = await ContactService.get_contacts("personal", uid)
            found = None
            for c in contacts:
                if contact_name.lower() in c.get("name", "").lower():
                    found = c
                    break
            if not found:
                return {"success": False, "action": "delete_contact", "message": f"❌ Rehberinizde '{contact_name}' adında bir kişi bulunamadı. Not: Sadece kendi eklediğiniz kişileri silebilirsiniz."}
            await ContactService.delete_contact(found["id"], uid)
            return {
                "success": True,
                "action": "delete_contact",
                "message": f"✅ Rehberden silindi: **{found.get('name')}**",
                "data": {"id": found["id"], "name": found.get("name")},
            }

        elif function_name == "create_post":
            post = PostCreate(
                title=args.get("title", "Yeni Konu"),
                content=args.get("content", ""),
                category=args.get("category", "Genel"),
                author_id=uid,
                author_name=display_name,
            )
            result = await CollaborationService.create_post(post)
            return {
                "success": True,
                "action": "create_post",
                "message": f"✅ Forum konusu açıldı: **{result.get('title')}** [{result.get('category', 'Genel')}]",
                "data": {"id": result.get("id"), "title": result.get("title")},
            }

        elif function_name == "delete_post":
            post_title = args.get("post_title", "")
            # Kullanıcının postlarını ara
            posts = await CollaborationService.get_posts(user_uid=uid)
            found = None
            for p in posts:
                if p.get("author_id") == uid and post_title.lower() in p.get("title", "").lower():
                    found = p
                    break
            if not found:
                return {"success": False, "action": "delete_post", "message": f"❌ '{post_title}' başlıklı kendi açtığınız bir konu bulunamadı."}
            await CollaborationService.delete_post(found["id"])
            return {
                "success": True,
                "action": "delete_post",
                "message": f"✅ Forum konusu silindi: **{found.get('title')}**",
                "data": {"id": found["id"]},
            }

        elif function_name == "send_message":
            msg = MessageCreate(
                text=args.get("text", ""),
                author_id=uid,
                author_name=display_name,
                author_role="Müfettiş",
            )
            result = await CollaborationService.save_message(msg)
            return {
                "success": True,
                "action": "send_message",
                "message": f"✅ Mesaj gönderildi: \"{args.get('text', '')[:80]}...\"" if len(args.get("text", "")) > 80 else f"✅ Mesaj gönderildi.",
                "data": {"id": result.get("id")},
            }

        # ─── TAKVİM NOTLARI ─────────────────────────────
        elif function_name == "create_calendar_note":
            date_key = args.get("date", datetime.now().strftime("%Y-%-m-%-d"))
            text = args.get("text", "")
            time_val = args.get("time", "09:00")
            data = {
                "owner_id": uid,
                "date_key": date_key,
                "text": text,
                "time": time_val,
                "created_at": datetime.utcnow(),
            }
            doc_ref = await asyncio.to_thread(db.collection("calendar_notes").add, data)
            return {
                "success": True,
                "action": "create_calendar_note",
                "message": f"✅ Takvime not eklendi: **{text}** — {date_key} {time_val}",
                "data": {"id": doc_ref[1].id, "date_key": date_key},
            }

        elif function_name == "delete_calendar_note":
            note_text = args.get("note_text", "")
            query = db.collection("calendar_notes").where("owner_id", "==", uid).limit(200)
            docs = await asyncio.to_thread(lambda: list(query.stream()))
            found = None
            for doc in docs:
                d = doc.to_dict()
                if note_text.lower() in d.get("text", "").lower():
                    found = (doc.id, d)
                    break
            if not found:
                return {"success": False, "action": "delete_calendar_note", "message": f"❌ Takviminizde '{note_text}' içeren bir not bulunamadı."}
            doc_ref = db.collection("calendar_notes").document(found[0])
            await asyncio.to_thread(doc_ref.delete)
            return {
                "success": True,
                "action": "delete_calendar_note",
                "message": f"✅ Takvim notu silindi: **{found[1].get('text', '')}**",
                "data": {"id": found[0]},
            }

        elif function_name == "list_calendar_notes":
            query = db.collection("calendar_notes").where("owner_id", "==", uid).limit(200)
            docs = await asyncio.to_thread(lambda: list(query.stream()))
            notes = []
            filter_date = args.get("date", "")
            for doc in docs:
                d = doc.to_dict()
                if filter_date and d.get("date_key") != filter_date:
                    continue
                notes.append(f"📅 {d.get('date_key')} {d.get('time', '')} — {d.get('text', '')}")
            if not notes:
                summary = "Takviminizde not bulunmuyor."
                if filter_date:
                    summary = f"{filter_date} tarihinde not bulunmuyor."
            else:
                summary = f"Takviminizde {len(notes)} not bulundu:\n" + "\n".join(notes)
            return {
                "success": True,
                "action": "list_calendar_notes",
                "message": summary,
                "data": {"count": len(notes)},
            }

        # ─── HIZLI NOTLAR ───────────────────────────────
        elif function_name == "create_note":
            note = NoteCreate(
                title=args.get("title", "Hızlı Not"),
                text=args.get("text", ""),
                color=args.get("color", "amber"),
                is_pinned=args.get("is_pinned", False),
                owner_id=uid,
            )
            result = await NoteService.create_note(note)
            return {
                "success": True,
                "action": "create_note",
                "message": f"✅ Not oluşturuldu: **{result.get('title')}**",
                "data": {"id": result.get("id"), "title": result.get("title")},
            }

        elif function_name == "delete_note":
            note_title = args.get("note_title", "")
            notes = await NoteService.get_notes(uid)
            found = None
            for n in notes:
                if note_title.lower() in n.get("title", "").lower():
                    found = n
                    break
            if not found:
                return {"success": False, "action": "delete_note", "message": f"❌ '{note_title}' başlıklı bir not bulunamadı."}
            await NoteService.delete_note(found["id"])
            return {
                "success": True,
                "action": "delete_note",
                "message": f"✅ Not silindi: **{found.get('title')}**",
                "data": {"id": found["id"]},
            }

        elif function_name == "list_notes":
            notes = await NoteService.get_notes(uid)
            if not notes:
                summary = "Henüz hızlı notunuz bulunmuyor."
            else:
                lines = []
                for n in notes[:20]:
                    pin = "📌 " if n.get("is_pinned") else ""
                    lines.append(f"{pin}**{n.get('title', '')}**: {n.get('text', '')[:100]}")
                summary = f"{len(notes)} not bulundu:\n" + "\n".join(lines)
            return {
                "success": True,
                "action": "list_notes",
                "message": summary,
                "data": {"count": len(notes)},
            }

        # ─── DOSYA ERİŞİMİ ──────────────────────────────
        elif function_name == "list_files":
            sub_path = args.get("path", "")
            start = os.path.join(BASE_REPORTS_DIR, sub_path) if sub_path else BASE_REPORTS_DIR
            # Güvenlik: Raporlar klasörü dışına çıkmasın
            start = os.path.normpath(start)
            if not start.startswith(os.path.normpath(BASE_REPORTS_DIR)):
                return {"success": False, "action": "list_files", "message": "❌ Güvenlik: Sadece Raporlar klasörüne erişilebilir."}
            tree = await asyncio.to_thread(FolderManager.get_tree, start)
            if not tree:
                return {"success": True, "action": "list_files", "message": f"📂 '{sub_path or 'Raporlar'}' klasöründe dosya/klasör bulunmuyor.", "data": {"count": 0}}
            # Sadece doğrudan alt öğeleri göster (max 30)
            direct = [item for item in tree if item.get("parentId") is None or (sub_path and item.get("parentId") == sub_path.replace("\\", "/"))]
            if not direct:
                direct = tree[:30]
            lines = []
            for item in direct[:30]:
                icon = "📁" if item["type"] == "folder" else "📄"
                extra = f" ({item.get('size', '')})" if item.get("size") else ""
                lines.append(f"{icon} {item['name']}{extra}")
            summary = f"📂 **{sub_path or 'Raporlar'}** — {len(direct)} öğe:\n" + "\n".join(lines)
            return {
                "success": True,
                "action": "list_files",
                "message": summary,
                "data": {"count": len(direct)},
            }

        elif function_name == "read_file_content":
            file_path = args.get("file_path", "")
            abs_path = os.path.normpath(os.path.join(BASE_REPORTS_DIR, file_path))
            # Güvenlik: Raporlar klasörü dışına çıkmasın
            if not abs_path.startswith(os.path.normpath(BASE_REPORTS_DIR)):
                return {"success": False, "action": "read_file_content", "message": "❌ Güvenlik: Sadece Raporlar klasöründeki dosyalar okunabilir."}
            if not os.path.exists(abs_path):
                return {"success": False, "action": "read_file_content", "message": f"❌ Dosya bulunamadı: {file_path}"}
            if os.path.isdir(abs_path):
                return {"success": False, "action": "read_file_content", "message": "❌ Bu bir klasör, dosya değil. list_files kullanın."}

            ext = os.path.splitext(abs_path)[1].lower()
            try:
                def _read():
                    with open(abs_path, "rb") as f:
                        content = f.read()
                    if ext == ".pdf":
                        from pypdf import PdfReader
                        from io import BytesIO
                        reader = PdfReader(BytesIO(content))
                        return "\n".join(p.extract_text() or "" for p in reader.pages)
                    elif ext == ".docx":
                        from docx import Document as DocxDocument
                        from io import BytesIO
                        doc = DocxDocument(BytesIO(content))
                        return "\n".join(p.text for p in doc.paragraphs if p.text.strip())
                    elif ext in (".txt", ".md", ".csv"):
                        return content.decode("utf-8", errors="ignore")
                    else:
                        return f"[Bu dosya formatı ({ext}) metin olarak okunamıyor]"
                text = await asyncio.to_thread(_read)
                # Max 5000 karakter
                if len(text) > 5000:
                    text = text[:5000] + f"\n\n... (toplam {len(text)} karakter, ilk 5000 gösteriliyor)"
                return {
                    "success": True,
                    "action": "read_file_content",
                    "message": f"📄 **{os.path.basename(abs_path)}** dosyası okundu:\n\n{text}",
                    "data": {"file": file_path, "length": len(text)},
                }
            except Exception as e:
                return {"success": False, "action": "read_file_content", "message": f"❌ Dosya okunamadı: {str(e)}"}

        # ─── MEVZUAT OKUMA ───────────────────────────────
        elif function_name == "read_legislation":
            leg_title = args.get("legislation_title", "")
            # Firestore'dan mevzuatları ara
            legs_ref = db.collection("legislations")
            public_query = legs_ref.where("is_public", "==", True).where("is_archived", "==", False).limit(50)
            docs = await asyncio.to_thread(lambda: list(public_query.stream()))
            if uid:
                private_query = legs_ref.where("is_public", "==", False).where("owner_id", "==", uid).where("is_archived", "==", False).limit(20)
                private_docs = await asyncio.to_thread(lambda: list(private_query.stream()))
                docs.extend(private_docs)
            # Eşleşen belgeyi bul
            found_doc = None
            for doc in docs:
                d = doc.to_dict()
                title = d.get("title", "")
                if leg_title.lower() in title.lower():
                    found_doc = (doc.id, d)
                    break
            if not found_doc:
                # Tüm başlıkları listele
                titles = [doc.to_dict().get("title", "?") for doc in docs[:20]]
                return {
                    "success": False,
                    "action": "read_legislation",
                    "message": f"❌ '{leg_title}' ile eşleşen mevzuat bulunamadı.\n\nMevcut belgeler:\n" + "\n".join(f"• {t}" for t in titles),
                }
            leg_id, leg_data = found_doc
            # İçerik topla
            parts = [f"📜 **{leg_data.get('title', '')}**"]
            if leg_data.get("category"):
                parts.append(f"Kategori: {leg_data['category']}")
            if leg_data.get("summary"):
                parts.append(f"Özet: {leg_data['summary']}")
            content = leg_data.get("content", "")
            if content:
                parts.append(f"\n{content[:8000]}")
            # Dosya varsa oku
            from app.services.ai_service import AIService
            ai_svc = AIService()
            file_text = await ai_svc._read_legislation_file(leg_data)
            if file_text:
                parts.append(f"\nDOSYA İÇERİĞİ:\n{file_text[:8000]}")
            full_text = "\n".join(parts)
            return {
                "success": True,
                "action": "read_legislation",
                "message": full_text,
                "data": {"id": leg_id, "title": leg_data.get("title")},
            }

        else:
            return {"success": False, "action": function_name, "message": f"❌ Bilinmeyen aksiyon: {function_name}"}

    except PermissionError as e:
        return {"success": False, "action": function_name, "message": f"❌ Yetki hatası: {str(e)}"}
    except Exception as e:
        return {"success": False, "action": function_name, "message": f"❌ İşlem başarısız: {str(e)}"}
