import httpx
from bs4 import BeautifulSoup
import logging
import re
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

class LegislationCrawlerService:
    @staticmethod
    async def fetch_from_mevzuat_gov_tr(url: str) -> Optional[Dict[str, Any]]:
        """
        mevzuat.gov.tr URL'sinden mevzuat bilgilerini ceker.
        """
        if "mevzuat.gov.tr" not in url:
            return None

        try:
            async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
                headers = {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                }
                response = await client.get(url, headers=headers)
                response.raise_for_status()
                
                html = response.text
                soup = BeautifulSoup(html, 'html.parser')
                
                # Mevzuat bilgilerini ayikla
                data = {
                    "title": "",
                    "doc_type": "Mevzuat",
                    "official_gazette_info": "",
                    "content": "",
                    "summary": "",
                    "document_url": url
                }
                
                # 1. Baslik (Genelde #MevzuatAdi veya h1/h2 icindedir)
                title_tag = soup.find('h1') or soup.find('h2') or soup.find(id='MevzuatAdi')
                if title_tag:
                    data['title'] = title_tag.get_text(strip=True)
                
                # 2. Resmi Gazete Bilgileri (Tarih / Sayi)
                # Genelde tablolarin icinde veya meta etiketlerinde olur
                info_table = soup.find('table', class_='mevzuat-info-table') or soup.find(id='divMevzuatBilgi')
                if info_table:
                    text = info_table.get_text()
                    # RegEx ile Tarih (01.01.2024) ve Sayi (12345) ayiklama
                    date_match = re.search(r'(\d{2}\.\d{2}\.\d{4})', text)
                    number_match = re.search(r'(Sayı|Sayısı)\s*:?\s*(\d+)', text, re.IGNORECASE)
                    
                    if date_match and number_match:
                        data['official_gazette_info'] = f"{date_match.group(1)} / {number_match.group(2)}"
                    elif date_match:
                        data['official_gazette_info'] = f"{date_match.group(1)}"
                
                # 3. Mevzuat Turu
                if "Kanun" in html: data['doc_type'] = "Kanun"
                elif "Yönetmelik" in html: data['doc_type'] = "Yönetmelik"
                elif "Karar" in html: data['doc_type'] = "Cumhurbaşkanı Kararı"
                elif "Tebliğ" in html: data['doc_type'] = "Tebliğ"

                # 4. Ana Metin (Content)
                # Mevzuat Gov Tr genelde metni bir div icinde sunar
                content_div = soup.find(id='MevzuatMetni') or soup.find('div', class_='mevzuat-content')
                if content_div:
                    # HTML'i markdown veya temiz text'e cevir
                    data['content'] = content_div.get_text(separator='\n', strip=True)[:50000] # Max 50k char
                    # Ilk 200 karakterden bir ozet olustur
                    data['summary'] = data['content'][:200] + "..." if len(data['content']) > 200 else data['content']
                
                return data
                
        except Exception as e:
            logger.error(f"Mevzuat Crawler Hatasi: {e}")
            return None

    @staticmethod
    def get_search_url(mevzuat_no: str, mevzuat_tur: str) -> str:
        """
        Mevzuat No ve Turune gore direkt arama URL'si olusturur.
        Turler: 1: Kanun, 3: Tuzuk, 7: Yonetmelik vb. (Mevzuat Gov Tr Kodlari)
        """
        # Bu kisim mevzuat.gov.tr parametre yapisina gore ozellestirilebilir
        return f"https://www.mevzuat.gov.tr/mevzuat?MevzuatNo={mevzuat_no}&MevzuatTur={mevzuat_tur}&MevzuatTertip=5"
