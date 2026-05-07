import asyncio
import os
import sys
from firebase_admin import auth

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from app.lib.firebase_admin import db

def scan_auth():
    print("--- AUTH KULLANICI LİSTESİ ---")
    page = auth.list_users()
    while page:
        for user in page.users:
            print(f"EMAIL: {user.email} | UID: {user.uid} | DISPLAY: {user.display_name}")
        page = page.get_next_page()

if __name__ == "__main__":
    scan_auth()
