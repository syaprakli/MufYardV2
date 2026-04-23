from pydantic import BaseModel
from typing import List

class StatItem(BaseModel):
    title: str
    value: str
    trend: str
    color: str

class NewsItem(BaseModel):
    id: str
    title: str
    date: str
    category: str

class DashboardStats(BaseModel):
    stats: List[StatItem]
    news: List[NewsItem]
