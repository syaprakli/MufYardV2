from app.lib.firebase_admin import db
contacts = db.collection('contacts').get()
for c in contacts:
    d = c.to_dict()
    name = d.get('name', '')
    title = d.get('title', '')
    if 'kazim' in name.lower() or 'kazım' in name.lower() or 'toplantı' in name.lower() or 'toplanti' in name.lower():
        print(f"NAME: {name} | TITLE: {title}")
