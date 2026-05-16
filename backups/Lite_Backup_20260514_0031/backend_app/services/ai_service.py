import warnings

# Deprecated SDK uyarısını import anında bastır.
with warnings.catch_warnings():
    warnings.simplefilter("ignore", FutureWarning)
    import google.generativeai as genai
import asyncio
import logging
import os
from io import BytesIO
from pypdf import PdfReader
from docx import Document as DocxDocument
from app.config import settings, BASE_DIR
from app.lib.firebase_admin import db, bucket
from app.lib.local_settings import get_local_ai_settings
from app.services.audit_service import AuditService
from app.services.ai_actions import AI_TOOLS, execute_action
from datetime import datetime
from typing import Any, Dict, List, Optional

logger = logging.getLogger("ai_service")

from app.config import get_settings
settings_val = get_settings()
MEVZUAT_DIR = settings_val.MEVZUAT_DIR


def _build_model(api_key: str, model_name: str, system_instruction: str | None = None):
    genai.configure(api_key=api_key)
    kwargs = {}
    if system_instruction:
        kwargs["system_instruction"] = system_instruction
        
    # Google SDK models/ prefix'i ve slug formatı bekler
    # Normalizasyon: "Gemini 2.5 Flash" -> "gemini-2.5-flash"
    model_slug = (model_name or "gemini-2.5-flash").lower().strip().replace(" ", "-")
    
    # Özel İsim Eşleştirme
    model_mapping = {
        "gemini-3.1-pro": "gemini-2.5-pro",
        "gemini-2.5-flash": "gemini-2.5-flash",
        "gemini-2.0-flash": "gemini-2.5-flash",
        "gemini-1.5-flash": "gemini-2.5-flash",
        "gemini-test-model": "gemini-2.5-flash"
    }
    
    # Eğer eşleşme varsa gerçek modeli kullan
    if model_slug in model_mapping:
        logger.info(f"Mapping custom model name '{model_slug}' to '{model_mapping[model_slug]}'")
        model_slug = model_mapping[model_slug]

    # Geçersiz modeller için son güvenlik kontrolü
    valid_models = ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash", "gemini-flash-latest"]
    if not any(m in model_slug for m in valid_models):
        logger.warning(f"Invalid model name '{model_slug}' detected. Falling back to gemini-2.5-flash.")
        model_slug = "gemini-2.5-flash"

    full_model_name = model_slug if model_slug.startswith("models/") else f"models/{model_slug}"
        
    return genai.GenerativeModel(full_model_name, **kwargs)


async def _get_user_ai_settings(uid: str) -> tuple[str, str, float, str, bool]:
    """Kullanıcının profilindeki AI ayarlarını çeker: api_key, model, temperature, system_prompt, is_premium.
    Yerel ayarlar (local_settings.json) Firestore'dan gelenlerin üzerini yazar.
    """
    # Varsayılan Değerler
    res_key = ""
    res_model = "gemini-2.5-flash"
    res_temp = 0.7
    res_sp = ""
    res_premium = False

    # 1. Firestore'dan (Cloud) genel ayarları çek
    try:
        doc_ref = db.collection("profiles").document(uid)
        doc = await asyncio.to_thread(doc_ref.get)
        if doc.exists:
            data = doc.to_dict() or {}
            res_key = (data.get("gemini_api_key") or "").strip()
            res_model = (data.get("gemini_model") or data.get("ai_model") or res_model).strip()
            res_temp = float(data.get("ai_temperature") or res_temp)
            res_sp = (data.get("ai_system_prompt") or "").strip()
            res_premium = bool(data.get("has_premium_ai") or False)
    except Exception as e:
        logger.warning(f"Error fetching Firestore AI settings: {e}")

    # 2. Yerel (Local) ayarlara bak ve üzerine yaz
    try:
        local_data = get_local_ai_settings()
        if local_data:
            if local_data.get("gemini_api_key"):
                res_key = local_data.get("gemini_api_key").strip()
            if local_data.get("gemini_model"):
                res_model = local_data.get("gemini_model").strip()
            if local_data.get("ai_temperature") is not None:
                res_temp = float(local_data.get("ai_temperature"))
            if local_data.get("ai_system_prompt") is not None:
                res_sp = local_data.get("ai_system_prompt").strip()
    except Exception as e:
        logger.error(f"Error merging local AI settings: {e}")

    return res_key, res_model, res_temp, res_sp, res_premium


def _extract_text_from_pdf(file_bytes: bytes) -> str:
    reader = PdfReader(BytesIO(file_bytes))
    text = ""
    for page in reader.pages:
        text += (page.extract_text() or "") + "\n"
    return text.strip()


def _extract_text_from_docx(file_bytes: bytes) -> str:
    doc = DocxDocument(BytesIO(file_bytes))
    return "\n".join(p.text for p in doc.paragraphs if p.text.strip())


class AIService:
    # ──────────── MAIN CHAT (ChatGPT-like + Function Calling) ────────────
    async def chat(
        self,
        message: str,
        history: List[Dict[str, str]] | None = None,
        context_type: str = "general",
        user: Dict[str, Any] | None = None,
    ) -> Dict[str, Any]:
        """Ana sohbet endpoint'i — ChatGPT/Gemini gibi çalışır + aksiyon yürütür."""
        if not user or not user.get("uid"):
            raise ValueError("Kullanıcı doğrulaması eksik.")

        api_key, model_name, temperature, user_system_prompt, is_premium = await _get_user_ai_settings(user["uid"])
        
        # Premium veya sistem anahtarı kullanımı kontrolü
        if not api_key:
            if is_premium and settings.GEMINI_API_KEY:
                api_key = settings.GEMINI_API_KEY
                logger.info(f"User {user['uid']} using system premium API key.")
            else:
                raise ValueError("Henüz bir Gemini API anahtarı tanımlanmamış. Ayarlar sayfasından kendi anahtarınızı girin veya sistem yetkisi isteyin.")

        # Tüm bağlamları paralel topla
        audit_ctx, contacts_ctx, knowledge_ctx, legislation_ctx = await asyncio.gather(
            self._get_audit_context(user),
            self._get_contacts_context(user),
            self._get_knowledge_context(),
            self._get_legislation_context(user),
        )

        # Sohbet geçmişi
        history_text = ""
        if history:
            for msg in history[-20:]:  # Son 20 mesaj
                role = "KULLANICI" if msg.get("role") == "user" else "ASİSTAN"
                history_text += f"{role}: {msg.get('text', '')}\n"

        system_prompt = f"""Sen MufYard V-2.0 Dijital Müfettiş Asistanısın. ChatGPT ve Gemini gibi güçlü, çok yönlü bir yapay zeka asistanısın.

KİMLİĞİN:
- İsim: MufYard AI Asistan
- Üslup: Profesyonel, saygılı, net ve sonuç odaklı. Müfettişlere yakışır resmi bir dil kullan.
- Yetkinlik: Denetim, mevzuat analizi, rapor yazma, tenkit maddesi oluşturma, mevzuat yorumlama.

YETENEKLERİN:
1. MEVZUAT ANALİZİ: Aşağıdaki mevzuat belgelerini oku, yorumla, karşılaştır, özetle. Detaylı okuma gerekirse read_legislation fonksiyonunu kullan.
2. RAPOR YAZMA: Denetim raporu taslağı oluştur, bölüm yaz, düzelt, geliştir.
3. TENKİT MADDESİ: Denetim bulgularına göre resmi tenkit metni oluştur.
4. BİLGİ SORGULAMA: Denetimler, kişiler, kurumlar hakkında bilgi ver.
5. GENEL DESTEK: Her türlü soruya yardımcı ol, analiz yap, metin oluştur.
6. AKSİYON YÜRÜTME: Görev oluştur, denetim başlat, rehbere kişi ekle/sil, forum konusu aç/sil, mesaj gönder.
7. TAKVİM YÖNETİMİ: Takvime not ekle, sil, listele. create_calendar_note / delete_calendar_note / list_calendar_notes fonksiyonlarını kullan.
8. HIZLI NOTLAR: Not defterine not ekle, sil, listele. create_note / delete_note / list_notes fonksiyonlarını kullan.
9. DOSYA ERİŞİMİ: Rapor klasöründeki dosyaları listele (list_files) ve içeriklerini oku (read_file_content). PDF, DOCX, TXT desteklenir.
10. MEVZUAT OKUMA: Belirli bir mevzuatı derinlemesine oku ve analiz et (read_legislation).

AKSİYON KURALLARI (ÇOK ÖNEMLİ):
- Kullanıcı bir aksiyon istediğinde ASLA metin olarak "yaptım/açtım/oluşturdum" DEME. MUTLAKA ilgili fonksiyonu çağır (function call yap).
- Bir işlemi "yaptığını söylemek" ile "gerçekten yapmak" farklı şeylerdir. Sen SADECE fonksiyon çağırarak işlem yapabilirsin.
- ONAY SORMA. Kullanıcı bir şey istiyorsa hemen yap. "Onaylıyor musunuz?" diye sorma, doğrudan fonksiyonu çağır.
- Eksik zorunlu bilgi varsa (örn: kişi adı, telefon) sadece o zaman sor, isteğe bağlı alanları varsayılanla doldur.
- Silme işlemlerinde dikkatli ol — sadece kullanıcının kendi kayıtları silinebilir.
- Dosya okuma isteklerinde önce list_files ile dosyaları listele, sonra read_file_content ile oku.
- Mevzuat analizi için önce mevcut context'i kontrol et, yetmezse read_legislation ile detaylı oku.

═══════════════════════════════════════
MEVZUAT BİLGİ BANKASI (Yüklenmiş belgeler):
═══════════════════════════════════════
{legislation_ctx}

═══════════════════════════════════════
TENKİT MADDELERİ (Bilgi Bankası):
═══════════════════════════════════════
{knowledge_ctx}

═══════════════════════════════════════
DENETİM VERİLERİ:
═══════════════════════════════════════
{audit_ctx}

═══════════════════════════════════════
KURUMSAL REHBER:
═══════════════════════════════════════
{contacts_ctx}

GÜNCEL TARİH: {datetime.now().strftime('%d.%m.%Y')}

TALİMATLAR:
- Kullanıcı bir eksiklik veya sorun bildirdiğinde, önce MEVZUAT BİLGİ BANKASI'nda ilgili yasal dayanağı ara.
- Tenkit maddesi yazarken mutlaka yasal dayanak (kanun/yönetmelik maddesi) belirt.
- Bilgi bankasında ilgili hazır tenkit metni varsa onu referans al.
- Mevzuattan alıntı yaparken belge adını ve ilgili maddeyi göster.
- Rapor yazarken resmi müfettişlik dili kullan.
- Uzun cevaplar gerektiğinde başlıklar ve maddeler ile yapılandır.
- Her zaman kaynak belirt (hangi mevzuat, hangi belge, hangi veri)."""
        
        if user_system_prompt:
            system_prompt += f"\n\nKULLANICI ÖZEL TALİMATLARI:\n{user_system_prompt}"

        # Conversation turns for Gemini
        contents = []
        if history_text:
            contents.append({"role": "user", "parts": [{"text": f"ÖNCEKİ SOHBET:\n{history_text}"}]})
            contents.append({"role": "model", "parts": [{"text": "Anladım, önceki sohbet bağlamını dikkate alacağım."}]})
        contents.append({"role": "user", "parts": [{"text": message}]})

        model = _build_model(api_key, model_name, system_instruction=system_prompt)

        # İlk istek — tools ile birlikte gönder
        response = await model.generate_content_async(
            contents,
            tools=AI_TOOLS,
            generation_config=genai.types.GenerationConfig(
                temperature=temperature,
                max_output_tokens=8192,
            ),
        )

        # ─── Function calling loop (max 5 tur) ───
        executed_actions = []
        for _ in range(5):
            # Yanıtta function_call var mı kontrol et
            candidate = response.candidates[0] if response.candidates else None
            if not candidate or not candidate.content or not candidate.content.parts:
                break

            function_calls = [p for p in candidate.content.parts if p.function_call and p.function_call.name]
            if not function_calls:
                break  # Normal metin yanıtı — döngüyü kır

            # Her function_call'ı çalıştır
            function_responses = []
            for fc_part in function_calls:
                fn_name = fc_part.function_call.name
                fn_args = dict(fc_part.function_call.args) if fc_part.function_call.args else {}
                logger.info(f"[AI ACTION] {fn_name}({fn_args}) — user={user.get('uid')}")

                action_result = await execute_action(fn_name, fn_args, user)
                executed_actions.append(action_result)
                logger.info(f"[AI ACTION RESULT] {action_result.get('message')}")

                function_responses.append(
                    genai.protos.Part(
                        function_response=genai.protos.FunctionResponse(
                            name=fn_name,
                            response={"result": action_result.get("message", "")},
                        )
                    )
                )

            # Fonksiyon sonuçlarını modele geri gönder
            contents.append(candidate.content)
            contents.append({"role": "user", "parts": function_responses})

            response = await model.generate_content_async(
                contents,
                tools=AI_TOOLS,
                generation_config=genai.types.GenerationConfig(
                    temperature=temperature,
                    max_output_tokens=8192,
                ),
            )

        # Sonuç metnini al
        text = ""
        try:
            text = response.text
        except Exception:
            # function_call sonrası metin yoksa
            if executed_actions:
                text = "\n".join(a.get("message", "") for a in executed_actions)

        return {
            "text": text,
            "actions": executed_actions,
        }

    # Eski metod adı uyumluluğu
    async def get_legislation_assistance(self, query, context_type="general", user=None):
        return await self.chat(query, None, context_type, user)

    # ──────────── RAPOR ÜRETME ────────────
    async def generate_report(
        self,
        audit_id: str,
        instructions: str,
        section: str | None = None,
        user: Dict[str, Any] | None = None,
    ) -> str:
        """Denetim verisine göre tam rapor veya bölüm üretir. HTML formatında döner."""
        if not user or not user.get("uid"):
            raise ValueError("Kullanıcı doğrulaması eksik.")

        api_key, model_name, _temperature, _user_sp, is_premium = await _get_user_ai_settings(user["uid"])
        if not api_key:
            if is_premium and settings.GEMINI_API_KEY:
                api_key = settings.GEMINI_API_KEY
            else:
                raise ValueError("Henüz bir Gemini API anahtarı tanımlanmamış.")

        # Denetim verisini çek
        audit = await AuditService.get_audit(audit_id)
        if not audit:
            raise ValueError("Denetim kaydı bulunamadı.")

        # Mevzuat + bilgi bankası bağlamı
        knowledge_ctx, legislation_ctx = await asyncio.gather(
            self._get_knowledge_context(),
            self._get_legislation_context(user),
        )

        audit_info = f"""
DENETİM BİLGİLERİ:
- Kurum: {audit.get('title', '')}
- Konum: {audit.get('location', '')}
- Tarih: {audit.get('date', '')}
- Müfettiş: {audit.get('inspector', '')}
- Durum: {audit.get('status', '')}
- Kurum Türü: {audit.get('institution', '')}
- Açıklama: {audit.get('description', '')}
"""

        existing_content = audit.get('report_content', '')
        if existing_content and existing_content.strip() not in ('', '<h1></h1>', '<p><br></p>'):
            audit_info += f"\nMEVCUT RAPOR İÇERİĞİ:\n{existing_content}\n"

        section_instruction = ""
        if section:
            section_map = {
                "giris": "Sadece GİRİŞ bölümünü yaz: Denetimin amacı, kapsamı, yasal dayanağı, denetim ekibi bilgileri.",
                "tespitler": "Sadece TESPİTLER/BULGULAR bölümünü yaz: Denetim sırasında tespit edilen eksiklikler, uygunsuzluklar, ihlaller.",
                "tenkit": "Sadece TENKİT MADDELERİ bölümünü yaz: Her tespit için yasal dayanaklı resmi tenkit metni.",
                "sonuc": "Sadece SONUÇ VE ÖNERİLER bölümünü yaz: Genel değerlendirme, öneriler, süre verilmesi gereken konular.",
                "tamamini": "Raporun TAMAMINI (Giriş, Tespitler, Tenkit Maddeleri, Sonuç ve Öneriler) yaz.",
            }
            section_instruction = section_map.get(section, f"Şu bölümü yaz: {section}")

        system_prompt = f"""Sen deneyimli bir T.C. Bakanlık Müfettişisin. Denetim raporu yazıyorsun.

RAPOR YAZIM KURALLARI:
1. DİL: Resmi Türkçe, müfettişlik raporu dili. Kısa, net, hukuki cümleler.
2. FORMAT: HTML formatında yaz. <h1>, <h2>, <h3>, <p>, <ul>, <li>, <strong> etiketleri kullan.
3. YASAL DAYANAK: Her tenkit maddesi için mutlaka ilgili kanun/yönetmelik madde numarasını belirt.
4. MEVZUAT: Aşağıdaki mevzuat belgelerinden faydalanarak raporu yasal zemine oturt.
5. TENKİT: Bilgi bankasındaki hazır tenkit metinlerini temel al, gerektiğinde adapte et.
6. PROFESYONELLIK: Gerçek bir müfettişlik raporundan ayırt edilemez kalitede olmalı.

═══════════════════════════════════════
MEVZUAT BELGELERİ:
═══════════════════════════════════════
{legislation_ctx}

═══════════════════════════════════════
TENKİT MADDELERİ BİLGİ BANKASI:
═══════════════════════════════════════
{knowledge_ctx}

{audit_info}

GÜNCEL TARİH: {datetime.now().strftime('%d.%m.%Y')}
"""

        user_prompt = instructions
        if section_instruction:
            user_prompt = f"{section_instruction}\n\nEK TALİMATLAR: {instructions}" if instructions else section_instruction

        if not user_prompt.strip():
            user_prompt = "Bu denetim için eksiksiz, profesyonel bir denetim raporu taslağı oluştur."

        model = _build_model(api_key, model_name, system_instruction=system_prompt)

        response = await model.generate_content_async(
            user_prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.4,
                max_output_tokens=16384,
            ),
        )
        return response.text

    # ──────────── MEVZUAT ANALİZ ────────────
    async def analyze_legislation(
        self,
        query: str,
        legislation_id: str | None = None,
        user: Dict[str, Any] | None = None,
    ) -> str:
        """Belirli bir mevzuatı veya tüm mevzuatı analiz eder."""
        if not user or not user.get("uid"):
            raise ValueError("Kullanıcı doğrulaması eksik.")

        api_key, model_name, _temperature, _user_sp, is_premium = await _get_user_ai_settings(user["uid"])
        if not api_key:
            if is_premium and settings.GEMINI_API_KEY:
                api_key = settings.GEMINI_API_KEY
            else:
                raise ValueError("Henüz bir Gemini API anahtarı tanımlanmamış.")

        # Belirli bir belge mi yoksa tümü mü?
        if legislation_id:
            leg_context = await self._get_single_legislation_text(legislation_id)
        else:
            leg_context = await self._get_legislation_context(user)

        system_prompt = f"""Sen uzman bir hukuk danışmanısın. Türk idare hukuku ve denetim mevzuatı konusunda derin bilgiye sahipsin.

MEVZUAT BELGELERİ:
{leg_context}

TALİMATLAR:
- Mevzuat hakkındaki soruları detaylı ve madde numaralarıyla yanıtla.
- İlgili kanun/yönetmelik maddelerini doğrudan alıntıla.
- Karşılaştırma istenirse tablo formatında sun.
- Denetim bulgularına uygulanacak mevzuatı tespit et.
- Güncel tarih: {datetime.now().strftime('%d.%m.%Y')}
"""

        model = _build_model(api_key, model_name, system_instruction=system_prompt)

        response = await model.generate_content_async(
            query,
            generation_config=genai.types.GenerationConfig(
                temperature=0.3,
                max_output_tokens=8192,
            ),
        )
        return response.text

    # ──────────── CONTEXT BUILDERS ────────────

    async def _get_legislation_context(self, user: Dict[str, Any] | None = None) -> str:
        """Firestore'daki tüm mevzuat kayıtlarını ve dosya içeriklerini çeker."""
        try:
            legs_ref = db.collection('legislations')
            # Public + user's private
            public_query = legs_ref.where('is_public', '==', True).where('is_archived', '==', False).limit(30)
            docs = await asyncio.to_thread(lambda: list(public_query.stream()))

            if user and user.get("uid"):
                private_query = legs_ref.where('is_public', '==', False).where('owner_id', '==', user["uid"]).where('is_archived', '==', False).limit(10)
                private_docs = await asyncio.to_thread(lambda: list(private_query.stream()))
                docs.extend(private_docs)

            context_parts = []
            for doc in docs:
                d = doc.to_dict()
                title = d.get('title', 'Başlıksız')
                category = d.get('category', '')
                doc_type = d.get('doc_type', '')
                summary = d.get('summary', '')

                part = f"\n📄 BELGE: {title}"
                if category:
                    part += f" | Kategori: {category}"
                if doc_type:
                    part += f" | Tür: {doc_type}"
                if summary:
                    part += f"\nÖZET: {summary}"

                # İçerik varsa doğrudan ekle
                content = d.get('content', '')
                if content:
                    # Max 3000 karakter per belge
                    part += f"\nİÇERİK:\n{content[:3000]}"

                # Performans için dosya içeriğini her mesajda okumuyoruz. 
                # (Asistan ihtiyaç duyarsa read_legislation aracı ile detaya inebilir)
                context_parts.append(part)

            # Ayrıca lokal Mevzuat klasöründeki dosyaları da tara
            local_texts = await self._scan_local_mevzuat()
            if local_texts:
                context_parts.append("\n── YEREL MEVZUAT DOSYALARI ──")
                context_parts.extend(local_texts)

            return "\n".join(context_parts) if context_parts else "Mevzuat kütüphanesinde henüz belge bulunmuyor."
        except Exception as e:
            return f"Mevzuat verileri yüklenirken hata: {str(e)}"

    async def _get_single_legislation_text(self, legislation_id: str) -> str:
        """Tek bir mevzuat belgesinin tam içeriğini döner."""
        try:
            doc_ref = db.collection('legislations').document(legislation_id)
            doc = await asyncio.to_thread(doc_ref.get)
            if not doc.exists:
                return "Belge bulunamadı."
            d = doc.to_dict()

            parts = [f"BELGE: {d.get('title', '')}"]
            content = d.get('content', '')
            if content:
                parts.append(f"İÇERİK:\n{content}")

            file_text = await self._read_legislation_file(d)
            if file_text:
                parts.append(f"DOSYA İÇERİĞİ:\n{file_text[:8000]}")

            return "\n".join(parts)
        except Exception:
            return "Belge okunamadı."

    async def _read_legislation_file(self, leg_data: dict) -> str:
        """Mevzuat belgesine ait dosyayı (PDF/DOCX) okur."""
        try:
            local_path = leg_data.get('local_path', '')
            document_url = leg_data.get('document_url', '')

            # Önce lokal dosya dene
            if local_path:
                abs_path = os.path.join(os.path.dirname(MEVZUAT_DIR), local_path.lstrip('/'))
                if os.path.exists(abs_path):
                    return await self._extract_file_text(abs_path)

            # Firebase Storage'dan dene
            if document_url and 'storage.googleapis.com' in document_url:
                try:
                    blob_path = document_url.split('/o/')[-1].split('?')[0] if '/o/' in document_url else None
                    if not blob_path:
                        # Public URL format
                        parts = document_url.split('.appspot.com/')
                        if len(parts) > 1:
                            blob_path = parts[1].split('?')[0]
                    if blob_path:
                        from urllib.parse import unquote
                        blob_path = unquote(blob_path)
                        blob = bucket.blob(blob_path)
                        content = await asyncio.to_thread(blob.download_as_bytes)
                        if blob_path.lower().endswith('.pdf'):
                            return await asyncio.to_thread(_extract_text_from_pdf, content)
                        elif blob_path.lower().endswith('.docx'):
                            return await asyncio.to_thread(_extract_text_from_docx, content)
                except Exception:
                    pass
        except Exception:
            pass
        return ""

    async def _extract_file_text(self, file_path: str) -> str:
        """Lokal dosyadan metin çıkarır."""
        ext = os.path.splitext(file_path)[1].lower()
        try:
            def _read():
                with open(file_path, 'rb') as f:
                    content = f.read()
                if ext == '.pdf':
                    return _extract_text_from_pdf(content)
                elif ext == '.docx':
                    return _extract_text_from_docx(content)
                elif ext in ('.txt', '.md'):
                    return content.decode('utf-8', errors='ignore')
                return ""
            return await asyncio.to_thread(_read)
        except Exception:
            return ""

    async def _scan_local_mevzuat(self) -> List[str]:
        """Lokal Mevzuat klasörünü tarar, PDF/DOCX dosyalarını okur."""
        results = []
        if not os.path.isdir(MEVZUAT_DIR):
            return results
        try:
            def _scan():
                found = []
                for root, dirs, files in os.walk(MEVZUAT_DIR):
                    # Kisisel klasörünü atla (gizlilik)
                    if 'Kisisel' in root:
                        continue
                    for fname in files:
                        ext = os.path.splitext(fname)[1].lower()
                        if ext in ('.pdf', '.docx', '.txt', '.md'):
                            rel = os.path.relpath(os.path.join(root, fname), MEVZUAT_DIR)
                            found.append((rel, os.path.join(root, fname)))
                return found

            files = await asyncio.to_thread(_scan)
            for rel_path, abs_path in files[:20]:  # Max 20 dosyanın sadece adını yükle
                results.append(f"📁 {rel_path} (İçeriği okumak için 'read_file_content' aracını kullanabilirsiniz)")
        except Exception:
            pass
        return results

    async def _get_knowledge_context(self) -> str:
        query = db.collection('ai_knowledge').limit(50)
        docs = await asyncio.to_thread(query.stream)
        context = ""
        for doc in docs:
            d = doc.to_dict()
            context += f"--- \nKONU: {d.get('topic')}\nKRİTER: {d.get('description')}\nTENKİT METNİ: {d.get('standard_remark')}\n"
        return context or "Yapay zeka bilgi bankasında henüz özel kural tanımlanmamış."

    async def _get_audit_context(self, user: Dict[str, Any]) -> str:
        docs = await AuditService.get_all_audits(
            user_id=user.get("uid"),
            user_email=user.get("email"),
        )
        context = ""
        for d in docs[:10]:
            context += (
                f"- [{d.get('title')}] Kurum: {d.get('institution')}, "
                f"Konum: {d.get('location')}, Tarih: {d.get('date')}, "
                f"Durum: {d.get('status')}, Müfettiş: {d.get('inspector')}\n"
            )
        return context or "Henüz denetim kaydı bulunmuyor."

    async def _get_contacts_context(self, user: Dict[str, Any]) -> str:
        contacts_ref = db.collection('contacts')
        shared_query = contacts_ref.where('is_shared', '==', True).limit(20)
        docs = await asyncio.to_thread(shared_query.stream)
        context_items = []
        for doc in docs:
            d = doc.to_dict()
            context_items.append(d)

        owner_query = contacts_ref.where('owner_id', '==', user.get("uid")).limit(10)
        owner_docs = await asyncio.to_thread(owner_query.stream)
        for doc in owner_docs:
            d = doc.to_dict()
            context_items.append(d)

        seen = set()
        context = ""
        for d in context_items:
            key = f"{d.get('name')}|{d.get('title')}|{d.get('phone')}"
            if key in seen:
                continue
            seen.add(key)
            context += f"- {d.get('name')} ({d.get('title')}): {d.get('unit')}, Tel: {d.get('phone') or '-'}\n"

        return context or "Kurumsal rehberde henüz kayıt bulunmuyor."
