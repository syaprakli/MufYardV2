from datetime import datetime
import asyncio
from typing import List, Optional, Dict, Any
from app.lib.firebase_admin import db
from app.schemas.contact import ContactCreate, ContactUpdate

class ContactService:
    @staticmethod
    async def _delete_system_imported_contacts() -> int:
        docs = await asyncio.to_thread(
            lambda: list(db.collection('contacts').where('owner_id', '==', 'system_admin').stream())
        )

        if not docs:
            return 0

        deleted_count = 0
        batch = db.batch()
        for doc in docs:
            batch.delete(doc.reference)
            deleted_count += 1

            if deleted_count % 400 == 0:
                await asyncio.to_thread(batch.commit)
                batch = db.batch()

        if deleted_count % 400 != 0:
            await asyncio.to_thread(batch.commit)

        return deleted_count

    @staticmethod
    async def get_contacts(category: str, user_id: Optional[str] = None) -> List[Dict[str, Any]]:
        contacts_ref = db.collection('contacts')
        
        if category == 'corporate':
            # Kurumsal rehber: Paylaşılan her şey
            query = contacts_ref.where('is_shared', '==', True).limit(500)
        else:
            # Kişisel rehber: Sadece bana ait olan her şey
            if not user_id:
                return []
            query = contacts_ref.where('owner_id', '==', user_id).limit(300)
            
        docs = await asyncio.to_thread(query.stream)
        
        contacts = []
        for doc in docs:
            contact_data = doc.to_dict()
            contact_data['id'] = doc.id
            contacts.append(contact_data)
            
        if category == 'corporate':
            contacts.sort(key=lambda x: (x.get('sort_order') is None, x.get('sort_order', 10**9), x.get('name', '').lower()))
        else:
            contacts.sort(key=lambda x: x.get('name', '').lower())
        return contacts

    @staticmethod
    async def get_contact_by_id(contact_id: str) -> Optional[Dict[str, Any]]:
        doc_ref = db.collection('contacts').document(contact_id)
        doc = await asyncio.to_thread(doc_ref.get)
        if doc.exists:
            contact_data = doc.to_dict()
            contact_data['id'] = doc.id
            return contact_data
        return None

    @staticmethod
    async def create_contact(contact: ContactCreate) -> Dict[str, Any]:
        contact_data = contact.dict()
        contact_data['created_at'] = datetime.utcnow()
        
        # Add to Firestore
        doc_ref = await asyncio.to_thread(db.collection('contacts').add, contact_data)
        
        # Get the created document
        new_doc = await asyncio.to_thread(doc_ref[1].get)
        new_contact = new_doc.to_dict()
        new_contact['id'] = doc_ref[1].id
        return new_contact

    @staticmethod
    async def update_contact(contact_id: str, contact_update: ContactUpdate, user_id: str) -> Optional[Dict[str, Any]]:
        doc_ref = db.collection('contacts').document(contact_id)
        doc = await asyncio.to_thread(doc_ref.get)
        if not doc.exists:
            return None
            
        update_data = {k: v for k, v in contact_update.dict().items() if v is not None}
        update_data['updated_at'] = datetime.utcnow()
        
        await asyncio.to_thread(doc_ref.update, update_data)
        
        updated_doc_res = await asyncio.to_thread(doc_ref.get)
        updated_doc = updated_doc_res.to_dict()
        updated_doc['id'] = contact_id
        return updated_doc

    @staticmethod
    async def share_contact(contact_id: str, user_id: str) -> bool:
        doc_ref = db.collection('contacts').document(contact_id)
        doc = await asyncio.to_thread(doc_ref.get)
        if not doc.exists:
            return False
            
        # Check ownership
        if doc.to_dict().get('owner_id') != user_id:
            raise PermissionError("Sadece kendi eklediğiniz kişileri paylaşabilirsiniz.")
            
        await asyncio.to_thread(doc_ref.update, {'is_shared': True, 'updated_at': datetime.utcnow()})
        return True

    @staticmethod
    async def delete_contact(contact_id: str, user_id: str) -> bool:
        doc_ref = db.collection('contacts').document(contact_id)
        doc = await asyncio.to_thread(doc_ref.get)
        if not doc.exists:
            return False
            
        # Check ownership
        if doc.to_dict().get('owner_id') != user_id:
            raise PermissionError("Sadece kendi eklediğiniz kişileri silebilirsiniz.")
            
        await asyncio.to_thread(doc_ref.delete)
        return True

    @staticmethod
    async def sync_from_rdb_rehber_v6(file_path: str = None) -> Dict[str, Any]:
        """
        rehber.xlsx dosyasını 'Kurumsal Rehber' koleksiyonuna aktarır.
        Excel yapısı: Sıra No(0), İsim(1), Ünvan(2), Cep(3), Dahili(4), Oda(5), Kat(6).
        Bölüm başlıklarını korur ve eski sistem aktarımlarını temizleyerek yinelenen/hatalı kayıt birikimini önler.
        """
        import os
        import pandas as pd
        import hashlib
        
        if file_path is None:
            base_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
            file_path = os.path.join(base_dir, "Rdb_rehber.xlsx")
            
        if not os.path.exists(file_path):
            file_path = os.path.join(os.path.dirname(file_path), "rehber.xlsx")
            
        if not os.path.exists(file_path):
            return {"status": "error", "message": "Excel dosyası bulunamadı."}
            
        try:
            df = await asyncio.to_thread(pd.read_excel, file_path, header=None)
            
            sync_count = 0
            batch = db.batch()
            contacts_ref = db.collection('contacts')
            now = datetime.utcnow()
            
            current_category_title = "Personel"

            def clean_text(value: Any) -> str:
                if pd.isna(value):
                    return ""
                text = str(value).strip()
                if text.lower() == "nan":
                    return ""
                # Remove anything in brackets like (inc. Sor.biti?) but keep the name clean
                if "(" in text:
                    # If it contains common titles we want to keep, handle specifically, 
                    # otherwise strip additional notes
                    keep_titles = ["VEKALETEN", "HİZMET ALIMI"]
                    upper_text = text.upper()
                    if not any(t in upper_text for t in keep_titles):
                        text = text.split("(")[0].strip()
                return " ".join(text.split())

            def get_verified_email(name: str) -> str:
                # 126 Verified Email Directory
                email_map = {
                    "enginkoca": "engin.koca@gsb.gov.tr", "subutayhankarayel": "subutayhan.karayel@gsb.gov.tr",
                    "adnangurbet": "adnan.gurbet@gsb.gov.tr", "ayfercengizoker": "ayfer.oker@gsb.gov.tr",
                    "osmanbaytekin": "osman.baytekin@gsb.gov.tr", "yasarsen": "yasar.sen@gsb.gov.tr",
                    "duysevaksoy": "duysev.aksoy@gsb.gov.tr", "erkanaltiok": "erkan.altiok@gsb.gov.tr",
                    "kemalbag": "kemal.bag@gsb.gov.tr", "dilekozturk": "dilek.ozturk@gsb.gov.tr",
                    "kadirkemaloglu": "kadir.kemaloglu@gsb.gov.tr", "ercankaraoglu": "ercan.karaoglu@gsb.gov.tr",
                    "yavuzyamak": "yavuz.yamak@gsb.gov.tr", "ismailsert": "ismail.sert@gsb.gov.tr",
                    "huseyinguner": "Hueseyin.GUeNER@gsb.gov.tr", "kazimmertacikgoz": "mert.acikgoz@gsb.gov.tr",
                    "aylavuraldemirkan": "ayla.vuraldemirkan@gsb.gov.tr", "mahmutoguz": "Mahmut.OGUZ@gsb.gov.tr",
                    "mustafabaydar": "Mustafa.BAYDAR@gsb.gov.tr", "hayatisallan": "Hayati.SALLAN@gsb.gov.tr",
                    "tugrulkolat": "Tugrul.KOLAT@gsb.gov.tr", "mehmetnezirsaidoglu": "nezir.saidoglu@gsb.gov.tr",
                    "ozgurcoskun": "Ozgur.COSKUN@gsb.gov.tr", "erensumengen": "Eren.SUMENGEN@gsb.gov.tr",
                    "elifseydasarac": "Seyda.SARAC@gsb.gov.tr", "abdullaherdogand": "Abdullah.ERDOGAN@gsb.gov.tr",
                    "abdullaherdogan": "Abdullah.ERDOGAN@gsb.gov.tr", "tarkantasci": "Tarkan.TASCI@gsb.gov.tr",
                    "aliozturk": "ali.ozturk@gsb.gov.tr", "metinyilmaz": "MetinYILMAZ@gsb.gov.tr",
                    "aynurkendigelen": "Aynur.KENDIGELEN@gsb.gov.tr", "muratozdogan": "Murat.OZDOGAN@gsb.gov.tr",
                    "ufukaltan": "Ufuk.ALTAN@gsb.gov.tr", "cavattas": "cavat.tas@gsb.gov.tr",
                    "muratusanmaz": "Murat.USANMAZ@gsb.gov.tr", "bilalarslan": "Bilal.ARSLAN@gsb.gov.tr",
                    "salmanmalkoc": "salmanmalkoc@gsb.gov.tr", "mehmettuncer": "Mehmet.TUNCER@gsb.gov.tr",
                    "ibrahimavci": "Ibrahim.AVCI@gsb.gov.tr", "mehmetdiri": "Mehmet.DIRI@gsb.gov.tr",
                    "sefayaprakli": "Sefa.YAPRAKLI@gsb.gov.tr", "mehmetbarman": "Mehmet.BARMAN@gsb.gov.tr",
                    "selimvural": "Selim.VURAL2@gsb.gov.tr", "alimurat": "Ali.MURAT@gsb.gov.tr",
                    "bilalakdere": "Bilal.AKDERE@gsb.gov.tr", "murataslan": "Murat.ASLAN2@gsb.gov.tr",
                    "omerdemirci": "Omer.DEMIRCI@gsb.gov.tr", "nihataltuntas": "Nihat.ALTUNTAS@gsb.gov.tr",
                    "kadirdokmeci": "Kadir.DOKMECI@gsb.gov.tr", "ahmetisgoren": "Ahmet.ISGOREN@gsb.gov.tr",
                    "elifhisar": "Elif.HISAR@gsb.gov.tr", "harunaytekin": "Harun.AYTEKIN@gsb.gov.tr",
                    "minesahin": "Mine.SAHIN@gsb.gov.tr", "muhammetarslan": "Muhammet.ARSLAN@gsb.gov.tr",
                    "muzafferdemirel": "Muzaffer.DEMIREL@gsb.gov.tr", "muhammedmete": "Muhammed.METE@gsb.gov.tr",
                    "baharaydogdu": "Bahar.AYDOGDU@gsb.gov.tr", "baharbaser": "Bahar.BASER@gsb.gov.tr",
                    "meltemsoysal": "Meltem.SOYSAL@gsb.gov.tr", "selinkusaksiz": "Selin.KUSAKSIZ@gsb.gov.tr",
                    "nesrinaltiparmak": "Nesrin.ALTIPARMAK@gsb.gov.tr", "canerkaragoz": "Caner.KARAGOZ@gsb.gov.tr",
                    "seyfullahyuce": "Seyfullah.YUCE@gsb.gov.tr", "recepdemir": "Rep.DEMIR2@gsb.gov.tr", 
                    "ugurkaraoglanlar": "Ugur.KARAOGLANLAR@gsb.gov.tr", "tugcebulut": "Tugce.BULUT@gsb.gov.tr",
                    "mahmutalbayrak": "Mahmut.ALBAYRAK@gsb.gov.tr", "ahmetdinc": "Ahmet.DINC@gsb.gov.tr",
                    "zekeriyayilmaz": "Zekeriya.YILMAZ@gsb.gov.tr", "eyuparabaci": "Eyup.ARABACI@gsb.gov.tr",
                    "ethemunal": "ethem.unal@gsb.gov.tr", "nurigozukara": "Nuri.GOZUKARA@gsb.gov.tr",
                    "savastaskin": "Savas.TASKIN@gsb.gov.tr", "ayhanozturk": "Ayhan.OZTURK@gsb.gov.tr",
                    "tutkuozkok": "Tutku.OZKOK@gsb.gov.tr", "asliyurtlak": "Asli.YURTLAK@gsb.gov.tr",
                    "dilanonderoglu": "Dilan.ONDEROGLU@gsb.gov.tr", "refikkucukyilmaz": "Refik.KUCUKYILMAZ@gsb.gov.tr",
                    "onurtomas": "Onur.TOMAS@gsb.gov.tr", "tugbayegen": "Tugba.YEGEN@gsb.gov.tr",
                    "emremujdeci": "Emre.MUJDECI@gsb.gov.tr", "omerozcan": "Omer.OZCAN2@gsb.gov.tr",
                    "omurfurkansimsek": "Omurfurkan.SIMSEK@gsb.gov.tr", "muratyurtsever": "Murat.YURTSEVER@gsb.gov.tr",
                    "berkkilinc": "Berk.KILINC@gsb.gov.tr", "mehmeteminkaya": "Mehmetemin.KAYA@gsb.gov.tr",
                    "emreaydin": "Emre.AYDIN3@gsb.gov.tr", "sahinsalkim": "sahin.salkim@gsb.gov.tr",
                    "gizemkapti": "gizem.kapti@gsb.gov.tr", "muhammedcagrikacar": "muhammedcagri.kacar@gsb.gov.tr",
                    "furkanneseli": "furkan.neseli@gsb.gov.tr", "fatihulber": "fatih.ulber@gsb.gov.tr",
                    "ceyhunkucukler": "ceyhun.kucukler@gsb.gov.tr", "ulkuyanik": "ulku.yanik@gsb.gov.tr",
                    "leylakartalci": "leyla.kartalci@gsb.gov.tr", "muhammedalicioglu": "muhammed.alicioglu@gsb.gov.tr",
                    "ahmetdeveli": "ahmet.develi@gsb.gov.tr", "alpersefikgokcer": "alpersefik.gokcer@gsb.gov.tr",
                    "yavuzelkol": "yavuz.elkol@gsb.gov.tr", "yelizmolo": "yeliz.molo@gsb.gov.tr",
                    "onurcelik": "onur.celik3@gsb.gov.tr", "yusufyilmaz": "yusuf.yilmaz3@gsb.gov.tr",
                    "tulaycicek": "tulay.cicek@gsb.gov.tr", "dundarkaratas": "dundar.karatas@gsb.gov.tr",
                    "yavuztok": "yavuz.tok@gsb.gov.tr", "handekargaci": "hande.kargaci@gsb.gov.tr",
                    "edaaltiner": "eda.altiner@gsb.gov.tr", "alisansariaslan": "alisan.sariaslan@gsb.gov.tr",
                    "fatmaserpilcaylan": "fatmaserpil.caylan@gsb.gov.tr", "nazlicanduran": "nazlican.duran@gsb.gov.tr",
                    "mervesengul": "merve.sengul@gsb.gov.tr", "dogancanyildiz": "dogancan.yildiz@gsb.gov.tr",
                    "fatmabaskaya": "fatma.baskaya@gsb.gov.tr", "burakyigitonur": "burakyigit.onur@gsb.gov.tr",
                    "cerenerdal": "ceren.erdal@gsb.gov.tr", "esrasubasi": "esra.subasi@gsb.gov.tr",
                    "serifekiper": "Serife.Kiper@gsb.gov.tr", "mustafaburan": "Mustafa.BURAN@gsb.gov.tr",
                    "didemboslu": "Didem.BOSLU@gsb.gov.tr", "bilgehandogan": "Bilgehan.DOGAN@gsb.gov.tr",
                    "gulaytufekci": "Gulay.TUFEKCI@gsb.gov.tr", "mevludecandan": "Mevlude.CANDAN@gsb.gov.tr",
                    "sukrupehlivanoglu": "Sukru.PEHLIVANOGLU@gsb.gov.tr", "sibelgunes": "Sibel.GUNES@gsb.gov.tr",
                    "erengulgungor": "Erengul.GUNGOR@gsb.gov.tr", "didemmetan": "Didem.METAN@gsb.gov.tr",
                    "duygucelik": "Duygu.celik@gsb.gov.tr", "hulyaduner": "Hulya.DUNER@gsb.gov.tr",
                    "tulunaltinsoy": "Tulun.ALTINSOY@gsb.gov.tr", "cevriyemoral": "Cevriye.MORAL@gsb.gov.tr",
                    "yasemindinc": "Yasemin.DINC@gsb.gov.tr", "zuleyhacanak": "Zuleyha.CANAK@gsb.gov.tr",
                    "veysialimoglu": "Veysi.ALIMOGLU@gsb.gov.tr", "ahmettuncdoken": "Ahmet.TUNCDOKEN@gsb.gov.tr",
                    "haticebulut": "Hatice.BULUT@gsb.gov.tr", "aysesenci": "Ayse.SENCI@gsb.gov.tr",
                    "sehersayar": "Seher.SAYAR@gsb.gov.tr", "yelizyamakli": "yeliz.yamakli@gsb.gov.tr",
                    "ozgenatas": "ozgen.atas@gsb.gov.tr", "merveeroglu": "merve.eroglu@gsb.gov.tr",
                    "tugcekocabas": "tugce.kocabas@gsb.gov.tr", "ozlemalagoz": "ozlem.alagoz@gsb.gov.tr",
                    "hilalbolukbasi": "Hilal.BOLUKBASI@gsb.gov.tr", "semanurnuhoglu": "semanur.nuhoglu@gsb.gov.tr",
                    "yasinturan": "Yasin.Turan@gsb.gov.tr"
                }
                
                def normalize(n):
                    return n.lower().replace(' ', '').replace('ı','i').replace('ş','s').replace('ğ','g').replace('ü','u').replace('ö','o').replace('ç','c').replace('(','').replace(')','')
                
                norm_name = normalize(name)
                # Use partial matching to catch names with middle names or slightly different last names
                for k, v in email_map.items():
                    if k in norm_name or norm_name in k:
                        return v
                return ""

            def clean_number_text(value: Any) -> str:
                text = str(value).strip()
                if text.lower() in ["nan", "none", ""]:
                    return ""
                if text.endswith('.0'):
                    return text[:-2]
                return text

            def format_label(value: str) -> str:
                if not value: return ""
                lower_map = {"I": "ı", "İ": "i"}
                upper_map = {"i": "İ", "ı": "I"}
                def turkish_lower(text: str) -> str:
                    return "".join(lower_map.get(char, char.lower()) for char in text)
                def turkish_upper_char(char: str) -> str:
                    return upper_map.get(char, char.upper())
                def format_word(word: str) -> str:
                    if not word: return ""
                    lowered = turkish_lower(word)
                    return turkish_upper_char(lowered[:1]) + lowered[1:]
                return " ".join(format_word(part) for part in value.split())
            
            for _, row in df.iterrows():
                vals = row.tolist()
                if len(vals) < 2: continue

                sequence = clean_number_text(vals[0] if len(vals) > 0 else "")
                raw_name = clean_text(vals[1] if len(vals) > 1 else "")
                title_cell = clean_text(vals[2] if len(vals) > 2 else "")
                mobile_phone = clean_number_text(vals[3] if len(vals) > 3 else "")
                extension = clean_number_text(vals[4] if len(vals) > 4 else "")
                room = clean_number_text(vals[5] if len(vals) > 5 else "")
                floor = clean_number_text(vals[6] if len(vals) > 6 else "")
                excel_email = clean_text(vals[7] if len(vals) > 7 else "")

                if not raw_name or raw_name.upper() == "ADI SOYADI": continue

                is_category_row = not sequence and not title_cell and not mobile_phone and not extension and not room and not floor
                if is_category_row:
                    current_category_title = format_label(raw_name)
                    continue

                if len(raw_name) < 2: continue

                name = format_label(raw_name)
                title = format_label(title_cell) or current_category_title
                phone = mobile_phone or (f"Dahili: {extension}" if extension else "-")
                
                # Priority: 1. Excel'deki mail, 2. Dahili havuzdaki mail
                email = excel_email or get_verified_email(name)

                unit_parts = []
                if current_category_title: unit_parts.append(f"Birim: {current_category_title}")
                if floor: unit_parts.append(f"Kat: {floor}")
                if room: unit_parts.append(f"Oda: {room}")
                if extension: unit_parts.append(f"Dahili: {extension}")
                unit_info = " | ".join(unit_parts) if unit_parts else current_category_title
                
                uid_seed = "|".join([name, title, current_category_title, mobile_phone, extension, room, floor])
                uid = hashlib.md5(uid_seed.encode('utf-8')).hexdigest()

                contact_entry = {
                    "name": name, "title": title, "phone": phone, "email": email,
                    "unit": unit_info, "tags": [current_category_title] if current_category_title else [],
                    "category": current_category_title, "sort_order": int(sequence) if sequence.isdigit() else None,
                    "is_shared": True, "owner_id": "system_admin", "updated_at": now,
                }

                doc_ref = contacts_ref.document(uid)
                # merge=True preserves manually set fields but our 'email' 
                # mapping will overwrite empty strings with verified ones.
                # If email in Firestore is already set and not empty, we could choose to preserve it,
                # but our get_verified_email is more authoritative for Kurumsal Rehber.
                batch.set(doc_ref, contact_entry, merge=True)
                sync_count += 1
                
                if sync_count % 400 == 0:
                    await asyncio.to_thread(batch.commit)
                    batch = db.batch()
            
            if sync_count % 400 != 0:
                await asyncio.to_thread(batch.commit)
            
            return {
                "status": "success", "processed": sync_count,
                "message": f"{sync_count} personel rehbere aktarıldı/güncellendi. Mailler otomatik eşitlendi."
            }
            
        except Exception as e:
            return {"status": "error", "message": f"V6 senkronizasyon hatası: {str(e)}"}
