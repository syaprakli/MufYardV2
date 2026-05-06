from datetime import datetime
import asyncio
from typing import List, Optional, Dict, Any
from google.cloud.firestore_v1.base_query import FieldFilter
from app.lib.firebase_admin import db
from app.schemas.messaging import MessageCreate, DirectMessageCreate
from app.schemas.post import PostCreate, PostUpdate

class CollaborationService:
    @staticmethod
    def _normalize_dm_room_id(room_id: str) -> str:
        return room_id[3:] if room_id.startswith("dm_") else room_id

    @staticmethod
    def _where_eq(query: Any, field_name: str, value: Any):
        """Firestore yeni filter API'sini kullanır; mock db için eski imzaya düşer."""
        try:
            return query.where(filter=FieldFilter(field_name, "==", value))
        except TypeError:
            return query.where(field_name, "==", value)

    # --- Messaging Service ---
    @staticmethod
    async def get_messages(limit: int = 50) -> List[Dict[str, Any]]:
        messages_ref = db.collection('messages')
        # to_thread used for blocking .stream()
        docs = await asyncio.to_thread(
            lambda: messages_ref.order_by('timestamp', direction='DESCENDING').limit(limit).stream()
        )
        
        messages = []
        for doc in docs:
            msg_data = doc.to_dict()
            msg_data['id'] = doc.id
            if 'timestamp' in msg_data and hasattr(msg_data['timestamp'], 'isoformat'):
                msg_data['timestamp'] = msg_data['timestamp'].isoformat()
            messages.append(msg_data)
        
        # DESCENDING alındığı için kronolojik sırayı düzeltmek adına ters çeviriyoruz
        messages.reverse()
        return messages

    @staticmethod
    async def save_message(message: MessageCreate) -> Dict[str, Any]:
        msg_data = message.dict()
        msg_data['timestamp'] = datetime.utcnow()
        
        # .add() and .get() are blocking
        doc_ref = await asyncio.to_thread(db.collection('messages').add, msg_data)
        new_msg_doc = await asyncio.to_thread(doc_ref[1].get)
        new_msg = new_msg_doc.to_dict()
        new_msg['id'] = doc_ref[1].id
        return new_msg

    # --- Private Messaging (DM) Service ---
    @staticmethod
    async def get_private_messages(uid1: str, uid2: str, limit: int = 50) -> List[Dict[str, Any]]:
        """İki kullanıcı arasındaki özel mesaj geçmişini getirir."""
        room_id = "_".join(sorted([uid1, uid2]))
        messages_ref = db.collection('private_messages').document(room_id).collection('chats')
        
        docs = await asyncio.to_thread(
            lambda: messages_ref.order_by('timestamp', direction='DESCENDING').limit(limit).stream()
        )
        
        messages = []
        for doc in docs:
            msg_data = doc.to_dict()
            msg_data['id'] = doc.id
            if 'timestamp' in msg_data and hasattr(msg_data['timestamp'], 'isoformat'):
                msg_data['timestamp'] = msg_data['timestamp'].isoformat()
            messages.append(msg_data)
        
        messages.reverse()
        return messages

    @staticmethod
    async def save_private_message(sender_id: str, sender_name: str, message: DirectMessageCreate) -> Dict[str, Any]:
        """Özel mesaj kaydeder."""
        room_id = "_".join(sorted([sender_id, message.recipient_id]))
        msg_data = message.dict()
        msg_data['sender_id'] = sender_id
        msg_data['sender_name'] = sender_name
        msg_data['timestamp'] = datetime.utcnow()
        msg_data['is_deleted'] = False
        
        doc_ref = await asyncio.to_thread(db.collection('private_messages').document(room_id).collection('chats').add, msg_data)
        new_msg_doc = await asyncio.to_thread(doc_ref[1].get)
        new_msg = new_msg_doc.to_dict()
        new_msg['id'] = doc_ref[1].id
        
        if 'timestamp' in new_msg and hasattr(new_msg['timestamp'], 'isoformat'):
            new_msg['timestamp'] = new_msg['timestamp'].isoformat()
            
        return new_msg

    @staticmethod
    async def delete_private_message(room_id: str, message_id: str, requester_uid: str) -> bool:
        """Özel mesajı siler (Herkesten sil). Sadece gönderen silebilir."""
        normalized_room_id = CollaborationService._normalize_dm_room_id(room_id)
        doc_ref = db.collection('private_messages').document(normalized_room_id).collection('chats').document(message_id)
        doc = await asyncio.to_thread(doc_ref.get)
        
        if not doc.exists:
            return False
            
        data = doc.to_dict()
        if data.get('sender_id') != requester_uid:
            # Sadece mesajı atan silebilir (Herkesten sil mantığı)
            return False
            
        await asyncio.to_thread(doc_ref.delete)
        return True

    @staticmethod
    async def update_private_message(room_id: str, message_id: str, requester_uid: str, content: str) -> Optional[Dict[str, Any]]:
        """Özel mesajı düzenler. Sadece gönderen düzenleyebilir."""
        normalized_room_id = CollaborationService._normalize_dm_room_id(room_id)
        doc_ref = db.collection('private_messages').document(normalized_room_id).collection('chats').document(message_id)
        doc = await asyncio.to_thread(doc_ref.get)
        if not doc.exists:
            return None

        data = doc.to_dict() or {}
        if data.get('sender_id') != requester_uid:
            return None

        now = datetime.utcnow()
        await asyncio.to_thread(doc_ref.update, {
            'content': content,
            'edited': True,
            'updated_at': now,
        })

        updated_doc = await asyncio.to_thread(doc_ref.get)
        updated = updated_doc.to_dict() or {}
        updated['id'] = message_id
        if 'timestamp' in updated and hasattr(updated['timestamp'], 'isoformat'):
            updated['timestamp'] = updated['timestamp'].isoformat()
        if 'updated_at' in updated and hasattr(updated['updated_at'], 'isoformat'):
            updated['updated_at'] = updated['updated_at'].isoformat()
        return updated

    @staticmethod
    async def clear_private_messages(room_id: str, requester_uid: str) -> int:
        """Kullanıcının kendi gönderdiği özel mesajları temizler."""
        normalized_room_id = CollaborationService._normalize_dm_room_id(room_id)
        chats_ref = db.collection('private_messages').document(normalized_room_id).collection('chats')
        docs = await asyncio.to_thread(
            lambda: list(chats_ref.where('sender_id', '==', requester_uid).stream())
        )
        if not docs:
            return 0

        def _batch_delete() -> None:
            batch = db.batch()
            for doc in docs:
                batch.delete(doc.reference)
            batch.commit()

        await asyncio.to_thread(_batch_delete)
        return len(docs)

    # --- Forum/Post Service ---
    @staticmethod
    async def get_posts(
        category: Optional[str] = None,
        user_uid: Optional[str] = None,
        limit: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        posts_ref = db.collection('posts')
        query = posts_ref
        
        if category and category != "Hepsi" and category != "Genel":
            query = CollaborationService._where_eq(query, 'category', category)
            
        posts = []
        try:
            docs = await asyncio.to_thread(lambda: query.limit(200).stream())
            for doc in docs:
                item = doc.to_dict()
                item['id'] = doc.id
                
                # Visibility logic
                is_public = item.get('is_public', True)
                is_approved = item.get('is_approved', True)
                shared_with = item.get('shared_with', [])
                author_id = item.get('author_id')
                
                # Admin/Moderator her şeyi görür
                if user_uid and user_uid == "admin": # Not: user_uid role kontrolü ile güncellenmeli
                    posts.append(item)
                # Normal kullanıcı: Public + Approved olanları VEYA kendisine özel paylaşılanları VEYA kendi postlarını görür
                elif is_public:
                    if is_approved or (user_uid and user_uid == author_id):
                        posts.append(item)
                elif user_uid and (user_uid in shared_with or user_uid == author_id):
                    posts.append(item)

            # Firestore composite index ihtiyacını azaltmak için sıralama uygulama tarafında yapılıyor.
            # created_at datetime, string veya eksik gelebileceği için güvenli bir anahtar kullanıyoruz.
            def sort_key(p: Dict[str, Any]):
                v = p.get('created_at')
                if hasattr(v, 'timestamp'):
                    try:
                        return v.timestamp()
                    except Exception:
                        return 0
                if isinstance(v, str):
                    try:
                        return datetime.fromisoformat(v.replace('Z', '+00:00')).timestamp()
                    except Exception:
                        return 0
                return 0

            posts.sort(key=sort_key, reverse=True)
            if limit and limit > 0:
                posts = posts[:limit]
        except Exception as e:
            print(f"Error fetching posts: {e}")
            # Fallback: if category filter causes index error, try without filter
            try:
                docs = await asyncio.to_thread(lambda: posts_ref.order_by('created_at', direction='DESCENDING').limit(20).stream())
                for doc in docs:
                    item = doc.to_dict()
                    item['id'] = doc.id
                    if not category or item.get('category') == category:
                        posts.append(item)
            except Exception as e2:
                print(f"Fallback fetch failed: {e2}")
                
        return posts

    @staticmethod
    async def create_post(post: PostCreate, is_admin: bool = False) -> Dict[str, Any]:
        post_data = post.dict()
        post_data['created_at'] = datetime.utcnow()
        post_data['likes_count'] = 0
        
        # Onay mekanizması
        if not is_admin and post_data.get('is_public', True):
            post_data['is_approved'] = False
        else:
            post_data['is_approved'] = True
            
        doc_ref = await asyncio.to_thread(db.collection('posts').add, post_data)
        new_post_doc = await asyncio.to_thread(doc_ref[1].get)
        new_post = new_post_doc.to_dict()
        new_post['id'] = doc_ref[1].id
        return new_post

    @staticmethod
    async def approve_post(post_id: str, admin_name: str) -> bool:
        doc_ref = db.collection('posts').document(post_id)
        doc = await asyncio.to_thread(doc_ref.get)
        if not doc.exists:
            return False
            
        await asyncio.to_thread(doc_ref.update, {
            'is_approved': True,
            'approved_by': admin_name,
            'approved_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        })
        return True

    @staticmethod
    async def reject_post(post_id: str) -> bool:
        doc_ref = db.collection('posts').document(post_id)
        doc = await asyncio.to_thread(doc_ref.get)
        if not doc.exists:
            return False
        
        await asyncio.to_thread(doc_ref.delete)
        return True

    @staticmethod
    async def delete_post(post_id: str) -> bool:
        doc_ref = db.collection('posts').document(post_id)
        exists = await asyncio.to_thread(lambda: doc_ref.get().exists)
        if not exists:
            return False
            
        await asyncio.to_thread(doc_ref.delete)
        return True

    # --- Forum Comments Service ---
    @staticmethod
    async def get_comments(post_id: str) -> List[Dict[str, Any]]:
        comments_ref = db.collection('posts').document(post_id).collection('comments')
        # Order by creation date to show thread in sequence
        docs = await asyncio.to_thread(lambda: comments_ref.order_by('created_at', direction='ASCENDING').limit(200).stream())
        
        comments = []
        for doc in docs:
            item = doc.to_dict()
            item['id'] = doc.id
            # Convert datetime to ISO string for JSON serialization
            if 'created_at' in item and hasattr(item['created_at'], 'isoformat'):
                item['created_at'] = item['created_at'].isoformat()
            comments.append(item)
        return comments

    @staticmethod
    async def add_comment(post_id: str, comment_data: Dict[str, Any]) -> Dict[str, Any]:
        comment_data['created_at'] = datetime.utcnow()
        doc_ref = await asyncio.to_thread(db.collection('posts').document(post_id).collection('comments').add, comment_data)
        
        new_doc = await asyncio.to_thread(doc_ref[1].get)
        new_comment = new_doc.to_dict()
        new_comment['id'] = new_doc.id
        # Convert datetime to ISO string
        if 'created_at' in new_comment and hasattr(new_comment['created_at'], 'isoformat'):
            new_comment['created_at'] = new_comment['created_at'].isoformat()
        return new_comment

    @staticmethod
    async def delete_comment(post_id: str, comment_id: str) -> bool:
        doc_ref = db.collection('posts').document(post_id).collection('comments').document(comment_id)
        exists = await asyncio.to_thread(lambda: doc_ref.get().exists)
        if not exists:
            return False
            
        await asyncio.to_thread(doc_ref.delete)
        return True

    @staticmethod
    async def delete_message(message_id: str, requester_uid: str, is_admin: bool = False) -> bool:
        doc_ref = db.collection('messages').document(message_id)
        doc = await asyncio.to_thread(doc_ref.get)
        if not doc.exists:
            return False

        data = doc.to_dict() or {}
        if not is_admin and data.get('author_id') != requester_uid:
            return False
            
        await asyncio.to_thread(doc_ref.delete)
        return True

    @staticmethod
    async def update_message(message_id: str, text: str, requester_uid: str, is_admin: bool = False) -> Optional[Dict[str, Any]]:
        doc_ref = db.collection('messages').document(message_id)
        doc = await asyncio.to_thread(doc_ref.get)
        if not doc.exists:
            return None

        existing = doc.to_dict() or {}
        if not is_admin and existing.get('author_id') != requester_uid:
            return None

        update_data = {
            'text': text,
            'edited': True,
            'updated_at': datetime.utcnow(),
        }
        await asyncio.to_thread(doc_ref.update, update_data)

        updated_doc = await asyncio.to_thread(doc_ref.get)
        updated = updated_doc.to_dict() or {}
        updated['id'] = message_id
        if 'timestamp' in updated and hasattr(updated['timestamp'], 'isoformat'):
            updated['timestamp'] = updated['timestamp'].isoformat()
        if 'updated_at' in updated and hasattr(updated['updated_at'], 'isoformat'):
            updated['updated_at'] = updated['updated_at'].isoformat()
        return updated

    @staticmethod
    async def clear_messages(requester_uid: str, is_admin: bool = False) -> int:
        if is_admin:
            query = db.collection('messages').limit(500)
        else:
            query = CollaborationService._where_eq(db.collection('messages'), 'author_id', requester_uid).limit(500)

        docs = await asyncio.to_thread(lambda: list(query.stream()))
        if not docs:
            return 0

        def _batch_delete() -> None:
            batch = db.batch()
            for doc in docs:
                batch.delete(doc.reference)
            batch.commit()

        await asyncio.to_thread(_batch_delete)
        return len(docs)

    @staticmethod
    async def update_post(post_id: str, post_update: PostUpdate) -> Optional[Dict[str, Any]]:
        try:
            doc_ref = db.collection('posts').document(post_id)
            update_data = {k: v for k, v in post_update.dict().items() if v is not None}
            if not update_data: return None
            
            update_data['updated_at'] = datetime.utcnow()
            await asyncio.to_thread(doc_ref.update, update_data)
            
            updated_doc = await asyncio.to_thread(doc_ref.get)
            updated = updated_doc.to_dict()
            updated['id'] = post_id
            return updated
        except Exception:
            return None

    @staticmethod
    async def update_comment(post_id: str, comment_id: str, content: str) -> Optional[Dict[str, Any]]:
        try:
            doc_ref = db.collection('posts').document(post_id).collection('comments').document(comment_id)
            exists = await asyncio.to_thread(lambda: doc_ref.get().exists)
            if not exists: return None
            
            update_data = {
                'content': content,
                'updated_at': datetime.utcnow()
            }
            await asyncio.to_thread(doc_ref.update, update_data)
            
            updated_doc = await asyncio.to_thread(doc_ref.get)
            updated = updated_doc.to_dict()
            updated['id'] = comment_id
            if 'created_at' in updated and hasattr(updated['created_at'], 'isoformat'):
                updated['created_at'] = updated['created_at'].isoformat()
            if 'updated_at' in updated and hasattr(updated['updated_at'], 'isoformat'):
                updated['updated_at'] = updated['updated_at'].isoformat()
            return updated
        except Exception:
            return None

    @staticmethod
    async def toggle_like(post_id: str) -> Dict[str, Any]:
        doc_ref = db.collection('posts').document(post_id)
        post = await asyncio.to_thread(doc_ref.get)
        if not post.exists:
            return {"error": "Post bulunamadı."}
        
        post_data = post.to_dict()
        current_likes = post_data.get('likes_count', 0)
        new_likes = current_likes + 1
        
        await asyncio.to_thread(doc_ref.update, {'likes_count': new_likes})
        return {"id": post_id, "likes_count": new_likes}

    # --- Category Management ---
    @staticmethod
    async def get_categories() -> List[str]:
        # Varsayılan kategoriler
        default_cats = ["Hepsi", "Mevzuat", "Denetim İpuçları", "Soru-Cevap", "Duyurular", "Genel"]
        try:
            docs = await asyncio.to_thread(db.collection('collaboration_categories').stream)
            db_cats = [doc.to_dict().get('name') for doc in docs if doc.to_dict().get('name')]
            # Birleştir ve unique yap
            return list(dict.fromkeys(default_cats + db_cats))
        except Exception:
            return default_cats

    @staticmethod
    async def add_category(name: str) -> bool:
        if not name: return False
        try:
            # Var mı diye bak
            existing = await asyncio.to_thread(lambda: db.collection('collaboration_categories').where('name', '==', name).limit(1).get())
            if len(existing) > 0:
                return True
            
            await asyncio.to_thread(db.collection('collaboration_categories').add, {'name': name, 'created_at': datetime.utcnow()})
            return True
        except Exception:
            return False

    # --- Generic Collaboration Approval ---
    @staticmethod
    async def accept_resource(resource_type: str, resource_id: str, user_id: str) -> bool:
        """Paylaşılan bir kaynağı (Task, Note, Contact) kabul eder."""
        collection_map = {
            'TASK': 'tasks',
            'NOTE': 'notes',
            'CONTACT': 'contacts'
        }
        collection_name = collection_map.get(resource_type.upper())
        if not collection_name:
            return False

        try:
            doc_ref = db.collection(collection_name).document(resource_id)
            doc = await asyncio.to_thread(doc_ref.get)
            if not doc.exists:
                return False
            
            data = doc.to_dict()
            pending = data.get('pending_collaborators', [])
            accepted = data.get('accepted_collaborators', [])

            if user_id in pending:
                pending.remove(user_id)
                if user_id not in accepted:
                    accepted.append(user_id)
                
                await asyncio.to_thread(doc_ref.update, {
                    'pending_collaborators': pending,
                    'accepted_collaborators': accepted
                })
                return True
            return False
        except Exception as e:
            print(f"Error accepting resource {resource_type}: {e}")
            return False

    @staticmethod
    async def reject_resource(resource_type: str, resource_id: str, user_id: str) -> bool:
        """Paylaşılan bir kaynağı (Task, Note, Contact) reddeder."""
        collection_map = {
            'TASK': 'tasks',
            'NOTE': 'notes',
            'CONTACT': 'contacts'
        }
        collection_name = collection_map.get(resource_type.upper())
        if not collection_name:
            return False

        try:
            doc_ref = db.collection(collection_name).document(resource_id)
            doc = await asyncio.to_thread(doc_ref.get)
            if not doc.exists:
                return False
            
            data = doc.to_dict()
            pending = data.get('pending_collaborators', [])
            shared_with = data.get('shared_with', [])

            changed = False
            if user_id in pending:
                pending.remove(user_id)
                changed = True
            
            if user_id in shared_with:
                shared_with.remove(user_id)
                changed = True

            if changed:
                await asyncio.to_thread(doc_ref.update, {
                    'pending_collaborators': pending,
                    'shared_with': shared_with
                })
                return True
            return False
        except Exception as e:
            print(f"Error rejecting resource {resource_type}: {e}")
            return False

    @staticmethod
    async def get_pending_requests(user_id: str) -> List[Dict[str, Any]]:
        """Kullanıcının onay bekleyen tüm paylaşım isteklerini getirir."""
        results = []
        
        # 1. Bekleyen Görevler/Raporlar
        tasks = await asyncio.to_thread(
            lambda: list(db.collection('tasks').where('pending_collaborators', 'array_contains', user_id).stream())
        )
        for t in tasks:
            td = t.to_dict()
            results.append({
                'id': t.id,
                'type': 'TASK',
                'title': td.get('rapor_adi') or td.get('title') or 'İsimsiz Görev',
                'sender_name': td.get('owner_name') or 'Bir Müfettiş',
                'created_at': td.get('created_at')
            })

        # 2. Bekleyen Notlar
        notes = await asyncio.to_thread(
            lambda: list(db.collection('notes').where('pending_collaborators', 'array_contains', user_id).stream())
        )
        for n in notes:
            nd = n.to_dict()
            results.append({
                'id': n.id,
                'type': 'NOTE',
                'title': nd.get('title') or 'İsimsiz Not',
                'sender_name': nd.get('owner_name') or 'Bir Müfettiş',
                'created_at': nd.get('created_at')
            })

        # 3. Bekleyen Rehber Kayıtları
        contacts = await asyncio.to_thread(
            lambda: list(db.collection('contacts').where('pending_collaborators', 'array_contains', user_id).stream())
        )
        for c in contacts:
            cd = c.to_dict()
            results.append({
                'id': c.id,
                'type': 'CONTACT',
                'title': cd.get('name') or 'İsimsiz Kişi',
                'sender_name': cd.get('owner_name') or 'Bir Müfettiş',
                'created_at': cd.get('created_at')
            })

        return results

