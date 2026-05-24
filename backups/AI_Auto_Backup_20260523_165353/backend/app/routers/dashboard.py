from fastapi import APIRouter
from app.schemas.dashboard import DashboardStats, NewsItem
from app.services.collaboration_service import CollaborationService
from datetime import datetime, timezone

router = APIRouter(tags=["dashboard"])

def format_relative_time(dt):
    if not dt: return ""
    
    try:
        # Handle Firestore Timestamp objects
        if hasattr(dt, 'to_datetime'):
            dt = dt.to_datetime()
        
        # Handle string format
        if isinstance(dt, str):
            try:
                dt = datetime.fromisoformat(dt.replace('Z', '+00:00'))
            except:
                return dt
                
        # Ensure dt is a datetime object at this point
        if not isinstance(dt, datetime):
            return str(dt)

        # Use timezone-aware UTC now for subtraction safely
        now = datetime.now(timezone.utc)
        
        # Ensure dt is timezone-aware
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        else:
            # Convert to UTC if it has a different timezone
            dt = dt.astimezone(timezone.utc)
            
        diff = now - dt
        
        if diff.days == 0:
            if diff.seconds < 3600:
                seconds_ago = max(1, diff.seconds // 60)
                return f"{seconds_ago} dakika önce"
            return f"{diff.seconds // 3600} saat önce"
        if diff.days == 1:
            return "Dün"
        return dt.strftime("%d.%m.%Y")
    except Exception as e:
        print(f"Time format error: {e}")
        return str(dt)

@router.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats(user_id: str = None):
    try:
        duyurular = await CollaborationService.get_posts(category="Duyurular", user_uid=user_id, limit=5)
        news_items = []
        for d in duyurular:
            news_items.append({
                "id": d.get('id', ''),
                "title": d.get('title', ''),
                "date": format_relative_time(d.get('created_at')),
                "category": d.get('category', 'Duyuru')
            })
            
        all_posts_raw = await CollaborationService.get_posts(user_uid=user_id, limit=20)
        forum_items = []
        for f in all_posts_raw:
            cat = f.get('category', 'Genel')
            if cat != "SSS":
                forum_items.append({
                    "id": f.get('id', ''),
                    "title": f.get('title', ''),
                    "date": format_relative_time(f.get('created_at')),
                    "category": cat
                })
                if len(forum_items) >= 5:
                    break
    except Exception as e:
        print(f"Dashboard news fetch error: {e}")
        news_items = []
        forum_items = []

    return {
        "stats": [
            {"title": "Aktif Denetimler", "value": "12", "trend": "+2 bu hafta", "color": "bg-primary text-white"},
            {"title": "Tamamlanan Raporlar", "value": "48", "trend": "+5 bu ay", "color": "bg-success text-white"},
            {"title": "Birim Personeli", "value": "156", "trend": "Güncel Rehber", "color": "bg-info text-white"},
            {"title": "Performans Skoru", "value": "%94", "trend": "+%2 artış", "color": "bg-warning text-white"},
        ],
        "news": news_items if news_items else [
            {"id": "0", "title": "Henüz duyuru bulunmamaktadır.", "date": "-", "category": "Bilgi"}
        ],
        "forum_posts": forum_items if forum_items else [
            {"id": "0", "title": "Henüz forum gönderisi bulunmamaktadır.", "date": "-", "category": "Bilgi"}
        ]
    }
