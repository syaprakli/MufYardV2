import asyncio
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from app.lib.firebase_admin import db
from app.schemas.notification import NotificationCreate
from app.services.email_service import EmailService
from app.services.profile_service import ProfileService

class NotificationService:
    @staticmethod
    async def create_notification(notification: NotificationCreate) -> Dict[str, Any]:
        notif_data = notification.dict()
        notif_data['created_at'] = datetime.utcnow()
        notif_data['read'] = False
        
        doc_ref = await asyncio.to_thread(db.collection('notifications').add, notif_data)
        doc = await asyncio.to_thread(doc_ref[1].get)
        new_notif = doc.to_dict()
        new_notif['id'] = doc_ref[1].id
        
        # E-posta Bildirimi Gönderme Mantığı
        asyncio.create_task(NotificationService._handle_email_notification(new_notif))
        
        # Real-time WebSocket Bildirimi
        try:
            from app.lib.notification_manager import notification_manager
            asyncio.create_task(notification_manager.notify_user(notification.user_id, new_notif))
        except Exception as e:
            print(f"[WS] Notification broadcast failed: {e}")
            
        return new_notif

    @staticmethod
    async def create_throttled_notification(notification: NotificationCreate, cooldown_minutes: int = 30) -> Optional[Dict[str, Any]]:
        """
        Belirli bir süre (cooldown_minutes) içinde aynı kullanıcıya, aynı oda (chat_room_id) için 
        tekrar bildirim gitmesini engeller.
        """
        if not notification.chat_room_id:
            return await NotificationService.create_notification(notification)

        notifs_ref = db.collection('notifications')
        since = datetime.utcnow() - timedelta(minutes=cooldown_minutes)
        
        # Firestore üzerinden son cooldown süresindeki benzer bildirimi kontrol et
        try:
            query = notifs_ref.where('user_id', '==', notification.user_id) \
                              .where('chat_room_id', '==', notification.chat_room_id) \
                              .where('created_at', '>=', since) \
                              .limit(1)
            
            docs = await asyncio.to_thread(lambda: list(query.stream()))
            if docs:
                # Yakın zamanda bildirim gönderilmiş, pas geç.
                return None
        except Exception as e:
            print(f"[THROTTLE] Check failed: {e}")
            
        return await NotificationService.create_notification(notification)


    @staticmethod
    async def _handle_email_notification(notification: Dict[str, Any]):
        """
        Kullanıcının tercihlerine göre e-posta gönderir.
        """
        user_id = notification.get('user_id')
        if not user_id:
            return

        try:
            profile = await ProfileService.get_profile(user_id)
            if not profile or not profile.get('notifications_enabled'):
                return

            # Bildirim tipine göre tercihi kontrol et
            type = notification.get('type')
            should_send = False
            
            if type == 'task_invite' and profile.get('email_assignments', True):
                should_send = True
            elif type == 'approval' and profile.get('email_approvals', True):
                should_send = True
            elif type == 'collaboration' and profile.get('email_collaboration', True):
                should_send = True

            if should_send:
                subject = f"MufYard: {notification.get('title')}"
                template = EmailService.get_standard_template(
                    title=notification.get('title'),
                    message=notification.get('message'),
                    action_url="https://mufyard.com/dashboard", # Dinamik link ileride eklenebilir
                    action_text="Programı Aç"
                )
                await EmailService.send_email(subject, profile['email'], template)
        except Exception as e:
            print(f"[ERROR] Email build failed: {str(e)}")

    @staticmethod
    async def get_user_notifications(user_id: str, limit: int = 20) -> List[Dict[str, Any]]:
        notifs_ref = db.collection('notifications')
        # Fetch slightly more than limit so in-memory sort is still accurate
        fetch_limit = min(limit * 3, 150)
        query = notifs_ref.where('user_id', '==', user_id).limit(fetch_limit)
        
        docs = await asyncio.to_thread(query.stream)
        
        notifications = []
        for doc in docs:
            item = doc.to_dict()
            item['id'] = doc.id
            notifications.append(item)
            
        # Sort in memory by created_at descending
        notifications.sort(key=lambda x: x.get('created_at') if x.get('created_at') else datetime.min, reverse=True)
        
        return notifications[:limit]

    @staticmethod
    async def mark_as_read(notification_id: str) -> bool:
        doc_ref = db.collection('notifications').document(notification_id)
        exists = await asyncio.to_thread(lambda: doc_ref.get().exists)
        if not exists:
            return False
        await asyncio.to_thread(doc_ref.update, {'read': True})
        return True

    @staticmethod
    async def mark_all_as_read(user_id: str) -> int:
        notifs_ref = db.collection('notifications')
        query = notifs_ref.where('user_id', '==', user_id).where('read', '==', False).limit(400)
        docs = await asyncio.to_thread(query.stream)
        doc_list = list(docs)
        if not doc_list:
            return 0

        def _batch_update():
            batch = db.batch()
            for doc in doc_list:
                batch.update(doc.reference, {'read': True})
            batch.commit()

        await asyncio.to_thread(_batch_update)
        return len(doc_list)

    @staticmethod
    async def delete_notification(notification_id: str) -> bool:
        doc_ref = db.collection('notifications').document(notification_id)
        exists = await asyncio.to_thread(lambda: doc_ref.get().exists)
        if not exists:
            return False
        await asyncio.to_thread(doc_ref.delete)
        return True

    @staticmethod
    async def delete_all(user_id: str) -> int:
        notifs_ref = db.collection('notifications')
        query = notifs_ref.where('user_id', '==', user_id).limit(400)
        docs = await asyncio.to_thread(query.stream)
        doc_list = list(docs)
        if not doc_list:
            return 0

        def _batch_delete():
            batch = db.batch()
            for doc in doc_list:
                batch.delete(doc.reference)
            batch.commit()

        await asyncio.to_thread(_batch_delete)
        return len(doc_list)


    @staticmethod
    async def notify_task_invitation(task_id: str, task_name: str, owner_name: str, collaborator_id: str):
        """Görev daveti için bildirim oluşturur."""
        notif = NotificationCreate(
            user_id=collaborator_id,
            title="Yeni Görev Daveti",
            message=f"{owner_name} sizi '{task_name}' görevine davet etti.",
            type="task_invite",
            task_id=task_id
        )
        return await NotificationService.create_notification(notif)
