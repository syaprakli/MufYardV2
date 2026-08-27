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

        # Clean and auto-complete the URL parameters
        from urllib.parse import urlparse, parse_qsl, urlencode, urlunparse
        try:
            parsed = urlparse(url)
            qsl = parse_qsl(parsed.query)
            params = {k: v for k, v in qsl}
            
            if "MevzuatNo" in params:
                if not params.get("MevzuatTertip") or params.get("MevzuatTertip").strip() == "":
                    params["MevzuatTertip"] = "5"
                
                clean_params = {k: v for k, v in params.items() if v and v.strip()}
                new_query = urlencode(clean_params)
                url = urlunparse(parsed._replace(query=new_query))
                logger.info(f"Cleaned mevzuat.gov.tr URL: {url}")
        except Exception as e:
            logger.warning(f"Failed to clean URL: {e}")

        try:
            async with httpx.AsyncClient(timeout=30.0, follow_redirects=True, verify=False) as client:
                headers = {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
                    "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7"
                }
                response = await client.get(url, headers=headers)
                response.raise_for_status()
                
                html = response.text
                soup = BeautifulSoup(html, 'html.parser')
                
                # EGER SAYFA BIR IFRAME KABUGU ISE (Mevzuat.gov.tr ana sayfasi gibi)
                iframe_tag = soup.find('iframe', id='mevzuatDetayIframe')
                if iframe_tag and iframe_tag.get('src'):
                    iframe_url = iframe_tag.get('src')
                    if iframe_url.startswith('/'):
                        from urllib.parse import urljoin
                        iframe_url = urljoin("https://www.mevzuat.gov.tr", iframe_url)
                    
                    logger.info(f"Iframe tespit edildi, yonleniliyor: {iframe_url}")
                    return await LegislationCrawlerService.fetch_from_mevzuat_gov_tr(iframe_url)

                # Mevzuat bilgilerini ayikla (Iframe icinden veya direkt sayfadan)
                data = {
                    "title": "",
                    "doc_type": "Mevzuat",
                    "official_gazette_info": "",
                    "content": "",
                    "summary": "",
                    "document_url": url
                }
                
                # 1. Baslik (Mevzuat Adi)
                title_tag = soup.find('h1') or soup.find('h2') or soup.find(id='MevzuatAdi')
                if title_tag:
                    data['title'] = title_tag.get_text(strip=True)
                else:
                    # Fallback for Word-exported HTML: First non-empty paragraph or bold text
                    first_p = soup.find('p') or soup.find('b')
                    if first_p:
                        data['title'] = first_p.get_text(strip=True)
                    else:
                        data['title'] = soup.title.string if soup.title else "Bilinmeyen Mevzuat"
                
                # 2. Resmi Gazete Bilgileri
                info_table = soup.find('table', class_='mevzuat-info-table') or soup.find(id='divMevzuatBilgi')
                if info_table:
                    text = info_table.get_text()
                    date_match = re.search(r'(\d{2}\.\d{2}\.\d{4})', text)
                    number_match = re.search(r'(Sayı|Sayısı)\s*:?\s*(\d+)', text, re.IGNORECASE)
                    
                    if date_match and number_match:
                        data['official_gazette_info'] = f"{date_match.group(1)} / {number_match.group(2)}"
                else:
                    # Search globally for RG pattern if table not found
                    all_text = soup.get_text()
                    # Resmî Gazete Tarihi : 23.07.1965 Resmî Gazete Sayısı : 12056
                    rg_match = re.search(r'Resmî Gazete Tarihi\s*:?\s*(\d{2}\.\d{2}\.\d{4})\s*Resmî Gazete Sayısı\s*:?\s*(\d+)', all_text, re.IGNORECASE)
                    if rg_match:
                        data['official_gazette_info'] = f"{rg_match.group(1)} / {rg_match.group(2)}"
                    else:
                        # Try separate searches
                        d_m = re.search(r'Tarihi\s*:?\s*(\d{2}\.\d{2}\.\d{4})', all_text, re.IGNORECASE)
                        s_m = re.search(r'Sayısı\s*:?\s*(\d+)', all_text, re.IGNORECASE)
                        if d_m and s_m:
                            data['official_gazette_info'] = f"{d_m.group(1)} / {s_m.group(2)}"
                
                # 3. Mevzuat Turu
                page_text = soup.get_text()
                if "Kanun" in page_text: data['doc_type'] = "Kanun"
                elif "Yönetmelik" in page_text: data['doc_type'] = "Yönetmelik"
                elif "Karar" in page_text: data['doc_type'] = "Cumhurbaşkanı Kararı"
                
                # 4. Ana Metin (Content)
                content_div = soup.find(id='MevzuatMetni') or soup.find('div', class_='mevzuat-content') or soup.find('body')
                if content_div:
                    # Clean the content
                    text_content = content_div.get_text(separator='\n', strip=True)
                    data['content'] = text_content[:100000] # Increased limit
                    data['summary'] = text_content[:300].strip() + "..." if len(text_content) > 300 else text_content
                
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
