import sys
import os
import asyncio
import traceback

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.services.ai_service import AIService

async def test():
    service = AIService()
    user = {"uid": "D9aQ38CQb3U35QoRDtPMVhy4O2G2", "email": "sefa@test.com"}
    print("Testing AI Service Chat...")
    try:
        res = await service.chat(message="Merhaba", user=user)
        print("BASSARILI!")
        print(res)
    except Exception as e:
        print("=== HATA OLUSTU ===")
        print(traceback.format_exc())

if __name__ == "__main__":
    asyncio.run(test())
