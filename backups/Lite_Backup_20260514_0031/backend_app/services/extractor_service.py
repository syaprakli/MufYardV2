import asyncio
import os
from io import BytesIO
from pydoc import doc
from pypdf import PdfReader
from docx import Document
from fastapi import UploadFile

class ExtractorService:
    @staticmethod
    async def extract_text(file: UploadFile) -> str:
        """Extracts plain text from PDF and Word (.docx) files."""
        extension = os.path.splitext(file.filename)[1].lower()
        
        # File reading should be awaited or wrapped
        content = await asyncio.to_thread(file.file.read)
        
        if extension == '.pdf':
            return await ExtractorService._extract_pdf(content)
        elif extension == '.docx':
            return await ExtractorService._extract_docx(content)
        elif extension in ['.txt', '.md']:
            return content.decode('utf-8')
        else:
            raise ValueError(f"Desteklenmeyen dosya türü: {extension}. Lütfen PDF veya Word (.docx) dosyası yükleyin.")

    @staticmethod
    async def _extract_pdf(content: bytes) -> str:
        """Extracts text from PDF bytes using pypdf."""
        def blocking_extract():
            reader = PdfReader(BytesIO(content))
            text = ""
            for page in reader.pages:
                text += page.extract_text() + "\n"
            return text.strip()
            
        return await asyncio.to_thread(blocking_extract)

    @staticmethod
    async def _extract_docx(content: bytes) -> str:
        """Extracts text from DOCX bytes using python-docx."""
        def blocking_extract():
            doc = Document(BytesIO(content))
            text = ""
            for para in doc.paragraphs:
                text += para.text + "\n"
            return text.strip()
            
        return await asyncio.to_thread(blocking_extract)
