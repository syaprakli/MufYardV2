from app.lib.firebase_admin import db
docs = db.collection('contacts').get()
for d in docs:
    data = d.to_dict()
    name = data.get('name', '')
    title = data.get('title', '')
    if 'kazım' in name.lower() or 'kazim' in name.lower() or 'toplantı' in name.lower() or 'toplanti' in name.lower():
        print(f"NAME: {name} | TITLE: {title}")
