
import asyncio
import os
import sys

# Backend klasörünü path'e ekle
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.lib.firebase_admin import db
import google.generativeai as genai

async def debug_models():
    print("--- Gemini API Model Kontrolü ---")
    
    # Tüm profilleri çekip API key olanı bulalım (veya belirli bir UID varsa ona bakalım)
    # Burada kullanıcı UID'sini loglardan alabilirdik ama genel listeleme yapalım
    profiles = db.collection("profiles").stream()
    
    found_key = None
    for p in profiles:
        data = p.to_dict()
        if data.get("gemini_api_key"):
            found_key = data["gemini_api_key"]
            print(f"Kullanıcı: {data.get('full_name')} ({p.id})")
            print(f"API Key bulundu (Maskeli): {found_key[:6]}...{found_key[-4:]}")
            break
            
    if not found_key:
        print("HATA: Firestore'da kayıtlı API key bulunamadı.")
        return

    try:
        genai.configure(api_key=found_key)
        print("\nErişilebilir Modeller Listeleniyor...")
        
        models = genai.list_models()
        count = 0
        for m in models:
            if 'generateContent' in m.supported_generation_methods:
                print(f"- {m.name} (Görünen Ad: {m.display_name})")
                count += 1
        
        if count == 0:
            print("UYARI: Bu API key ile 'generateContent' destekleyen hiçbir model bulunamadı.")
        else:
            print(f"\nToplam {count} adet uyumlu model bulundu.")
            
    except Exception as e:
        print(f"\nBAĞLANTI HATASI: {type(e).__name__} - {str(e)}")

if __name__ == "__main__":
    asyncio.run(debug_models())
