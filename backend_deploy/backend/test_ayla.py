from app.lib.firebase_admin import db
docs=db.collection('contacts').get()
for d in docs:
    data = d.to_dict()
    name = data.get('name', '')
    if 'ayla' in name.lower():
        print(f"NAME: {name}, EMAIL: {data.get('email')}")
