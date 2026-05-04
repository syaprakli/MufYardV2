from app.lib.firebase_admin import db
import asyncio

async def check():
    docs = db.collection('contacts').where('owner_id', '==', 'system_admin').stream()
    total = 0
    with_email = 0
    print("--- FIRST 5 SAMPLES ---")
    for d in docs:
        total += 1
        data = d.to_dict()
        email = data.get('email', '')
        if email:
            with_email += 1
        if total <= 5:
            print(f"ID: {d.id} | Name: {data.get('name')} | Email: {email}")
            
    print(f"\n--- SUMMARY ---")
    print(f"Total system contacts: {total}")
    print(f"Contacts with email: {with_email}")

if __name__ == "__main__":
    asyncio.run(check())
