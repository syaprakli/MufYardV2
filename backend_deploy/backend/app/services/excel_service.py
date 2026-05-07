import asyncio
import pandas as pd
from typing import List, Dict
import os

class ExcelService:
    @staticmethod
    async def load_audit_data(file_path: str) -> List[Dict]:
        """
        Excel dosyasından denetim verilerini veya mevzuat listesini yükler.
        """
        if not await asyncio.to_thread(os.path.exists, file_path):
            return []
            
        try:
            # pd.read_excel is blocking
            df = await asyncio.to_thread(pd.read_excel, file_path)
            # Veriyi temizle ve sözlük listesine çevir
            return df.to_dict(orient='records')
        except Exception as e:
            print(f"Excel okuma hatası: {e}")
            return []

    @staticmethod
    async def generate_context_from_excel(data: List[Dict]) -> str:
        """
        Excel verilerini AI asistanı için metin tabanlı bir bağlama dönüştürür.
        """
        # String manipulation is fast, but we'll make it async for consistency in the service layer
        context = "Aşağıdaki bilgiler Excel veritabanından alınmıştır:\n"
        for row in data[:20]: # İlk 20 satırı bağlam olarak al (limitasyon)
            context += f"- {row}\n"
        return context
