import os
from dotenv import load_dotenv

# .env dosyasını yükle (MUFYARD_DESKTOP vb. için gerekli)
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

import uvicorn
from app.main import app


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)
