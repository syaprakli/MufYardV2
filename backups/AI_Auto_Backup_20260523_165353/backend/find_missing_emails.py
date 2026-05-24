from app.lib.firebase_admin import db
import asyncio

async def find_missing():
    docs = db.collection('contacts').where('owner_id', '==', 'system_admin').stream()
    print("--- PEOPLE WITHOUT EMAILS ---")
    count = 0
    for d in docs:
        data = d.to_dict()
        if not data.get('email') or data.get('email') == '-':
            count += 1
            print(f"{count}. {data.get('name')} | {data.get('title')}")

if __name__ == "__main__":
    asyncio.run(find_missing())
