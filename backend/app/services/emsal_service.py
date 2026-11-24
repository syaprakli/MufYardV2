"""Emsal arama: kullanıcının erişebildiği eski raporlar ve tenkitler içinde tam metin arama.

Yalnızca kullanıcının sahibi olduğu / atandığı / paylaşılan denetimler aranır (AuditService.get_all_audits).
Rapor metinleri liste sorgusunda gelmediği için ayrıca okunur; kullanıcı başına kısa süre önbelleğe alınır.
"""
import asyncio
import html
import re
import time
from typing import Any, Dict, List, Optional, Tuple

from app.lib.firebase_admin import db
from app.services.audit_service import AuditService

_TR = {"ı": "i", "İ": "i", "I": "i", "ş": "s", "Ş": "s", "ğ": "g", "Ğ": "g", "ü": "u", "Ü": "u",
       "ö": "o", "Ö": "o", "ç": "c", "Ç": "c", "â": "a", "Â": "a", "î": "i", "Î": "i", "û": "u", "Û": "u"}
ONBELLEK_SN = 120
_onbellek: Dict[str, Tuple[float, Dict[str, Any]]] = {}
_kilitler: Dict[str, asyncio.Lock] = {}
_ES_ZAMANLI_OKUMA = 16


def norm(s: str) -> str:
    """Karakter karakter normalleştirir: uzunluk korunur (eşleşme konumu asıl metne taşınabilsin)."""
    out = []
    for c in s:
        if c in _TR:
            out.append(_TR[c])
        else:
            lc = c.lower()
            out.append(lc[0] if lc else c)
    return "".join(out)


def html_to_text(s: str) -> str:
    if not s:
        return ""
    s = re.sub(r"(?is)<(script|style)[^>]*>.*?</\1>", " ", s)
    s = re.sub(r"(?i)<br\s*/?>|</(p|div|li|h[1-6]|tr|td)>", " ", s)
    s = re.sub(r"<[^>]+>", " ", s)
    s = html.unescape(s)
    return re.sub(r"\s+", " ", s).strip()


def terimler(q: str) -> List[str]:
    """Sorgu terimleri; tırnak içindeki ifade tek terim sayılır."""
    ifadeler = re.findall(r'"([^"]+)"', q)
    kalan = re.sub(r'"[^"]*"', " ", q)
    t = [norm(x.strip()) for x in ifadeler if x.strip()] + [norm(x) for x in re.split(r"\s+", kalan) if len(x) >= 2]
    return list(dict.fromkeys(t))[:8]


def ozet(metin: str, t: List[str], genislik: int = 110) -> str:
    """İlk eşleşmenin çevresinden kısa alıntı."""
    n = norm(metin)
    konumlar = [n.find(x) for x in t if n.find(x) >= 0]
    if not konumlar:
        return metin[: genislik * 2]
    i = min(konumlar)
    bas = max(0, i - genislik)
    son = min(len(metin), i + genislik)
    return ("…" if bas > 0 else "") + metin[bas:son].strip() + ("…" if son < len(metin) else "")


def puan(alanlar: List[Tuple[str, int]], t: List[str]) -> int:
    """Tüm terimler (alanların herhangi birinde) geçmiyorsa 0; geçiyorsa ağırlıklı geçme sayısı."""
    toplam = 0
    for x in t:
        say = sum(norm(a).count(x) * w for a, w in alanlar if a)
        if say == 0:
            return 0
        toplam += say
    return toplam


async def _belgeler(koleksiyon: str, idler: List[str]) -> Dict[str, Dict[str, Any]]:
    sem = asyncio.Semaphore(_ES_ZAMANLI_OKUMA)

    async def oku(i: str):
        async with sem:
            d = await asyncio.to_thread(db.collection(koleksiyon).document(i).get)
            return i, (d.to_dict() or {}) if d.exists else None

    sonuc = await asyncio.gather(*(oku(i) for i in idler))
    return {i: d for i, d in sonuc if d is not None}


async def _tenkitler(audit_idler: List[str]) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for k in range(0, len(audit_idler), 30):  # Firestore "in" sınırı 30
        parca = audit_idler[k:k + 30]
        q = db.collection("tenkitler").where("audit_id", "in", parca).limit(3000)
        docs = await asyncio.to_thread(lambda: list(q.stream()))
        out.extend({**(d.to_dict() or {}), "id": d.id} for d in docs)
    return out


async def dizin(user: Dict[str, Any]) -> Dict[str, Any]:
    """Kullanıcının erişebildiği raporlar/tenkitler (önbellekli)."""
    uid = user.get("uid") or ""
    anahtar = f"{uid}|{(user.get('email') or '').lower()}"
    simdi = time.monotonic()
    kayit = _onbellek.get(anahtar)
    if kayit and simdi - kayit[0] < ONBELLEK_SN:
        return kayit[1]
    kilit = _kilitler.setdefault(anahtar, asyncio.Lock())
    async with kilit:
        kayit = _onbellek.get(anahtar)
        if kayit and time.monotonic() - kayit[0] < ONBELLEK_SN:
            return kayit[1]
        denetimler = await AuditService.get_all_audits(uid, user.get("email"))
        idler = [a["id"] for a in denetimler if a.get("id")]
        icerik, gorevler, tenkitler = await asyncio.gather(
            _belgeler("audits", idler),
            _belgeler("tasks", list({a.get("task_id") for a in denetimler if a.get("task_id")})),
            _tenkitler(idler),
        )
        raporlar = []
        for a in denetimler:
            tam = icerik.get(a["id"]) or {}
            g = gorevler.get(a.get("task_id") or "") or {}
            raporlar.append({
                "audit_id": a["id"],
                "task_id": a.get("task_id"),
                "baslik": a.get("title") or "",
                "tarih": a.get("date") or a.get("created_at") or "",
                "rapor_turu": g.get("rapor_turu") or "",
                "birim": g.get("rapor_adi") or "",
                "metin": html_to_text(tam.get("report_content") or ""),
            })
        basliklar = {r["audit_id"]: r for r in raporlar}
        veri = {"raporlar": raporlar, "tenkitler": tenkitler, "basliklar": basliklar}
        _onbellek[anahtar] = (time.monotonic(), veri)
        if len(_onbellek) > 500:  # bellek sınırı
            for k in sorted(_onbellek, key=lambda k: _onbellek[k][0])[:100]:
                _onbellek.pop(k, None)
        return veri


def onbellegi_temizle(uid: Optional[str] = None) -> None:
    if uid is None:
        _onbellek.clear()
    else:
        for k in [k for k in _onbellek if k.startswith(f"{uid}|")]:
            _onbellek.pop(k, None)


async def ara(user: Dict[str, Any], q: str, rapor_turu: Optional[str] = None, limit: int = 30) -> Dict[str, Any]:
    t = terimler(q)
    if not t:
        return {"terimler": [], "raporlar": [], "tenkitler": []}
    v = await dizin(user)
    rt = norm(rapor_turu) if rapor_turu else None

    raporlar = []
    for r in v["raporlar"]:
        if rt and norm(r["rapor_turu"]) != rt:
            continue
        p = puan([(r["baslik"], 5), (r["birim"], 3), (r["metin"], 1)], t)
        if p:
            raporlar.append({k: r[k] for k in ("audit_id", "task_id", "baslik", "tarih", "rapor_turu", "birim")}
                            | {"ozet": ozet(r["metin"] or r["baslik"], t), "puan": p})
    raporlar.sort(key=lambda x: (-x["puan"], str(x["tarih"])), reverse=False)

    tenkitler = []
    for k in v["tenkitler"]:
        r = v["basliklar"].get(k.get("audit_id")) or {}
        if rt and norm(r.get("rapor_turu") or "") != rt:
            continue
        p = puan([(k.get("baslik") or "", 5), (k.get("aciklama") or "", 2), (k.get("dayanak") or "", 2),
                  (k.get("birim_cevabi") or "", 1), (k.get("birim_adi") or "", 1)], t)
        if p:
            tenkitler.append({
                "id": k["id"], "audit_id": k.get("audit_id"), "task_id": r.get("task_id"),
                "baslik": k.get("baslik") or "", "durum": k.get("durum"), "onem": k.get("onem"),
                "dayanak": k.get("dayanak"), "birim_adi": k.get("birim_adi") or r.get("birim") or "",
                "rapor_turu": r.get("rapor_turu") or "", "denetim_basligi": r.get("baslik") or "",
                "denetim_tarihi": r.get("tarih") or "",
                "ozet": ozet(" ".join(x for x in [k.get("aciklama"), k.get("birim_cevabi")] if x) or k.get("baslik") or "", t),
                "birim_cevabi": (k.get("birim_cevabi") or "")[:400],
                "puan": p,
            })
    tenkitler.sort(key=lambda x: -x["puan"])
    return {"terimler": t, "raporlar": raporlar[:limit], "tenkitler": tenkitler[:limit],
            "toplam": {"rapor": len(raporlar), "tenkit": len(tenkitler)}}
