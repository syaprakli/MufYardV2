import asyncio
import json
import os.path
import datetime
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

SCOPES = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/drive.file'
]

class GoogleDriveService:
    def __init__(self):
        self.creds = None
        if os.path.exists('token.json'):
            self.creds = Credentials.from_authorized_user_file('token.json', SCOPES)
    
    async def authenticate(self, interactive: bool = False):
        if not self.creds or not self.creds.valid:
            if self.creds and self.creds.expired and self.creds.refresh_token:
                try:
                    await asyncio.to_thread(self.creds.refresh, Request())
                except Exception:
                    if not interactive: return None
            else:
                if not os.path.exists('credentials.json'):
                    return None
                if not interactive:
                    return None
                
                flow = await asyncio.to_thread(InstalledAppFlow.from_client_secrets_file,
                    'credentials.json', SCOPES)
                self.creds = await asyncio.to_thread(flow.run_local_server, port=0)
            
            if self.creds:
                with open('token.json', 'w') as token:
                    token.write(self.creds.to_json())
        
        if not self.creds: return None
        return await asyncio.to_thread(build, 'drive', 'v3', credentials=self.creds)

    async def upload_backup(self, file_path: str, filename: str):
        """Uploads a backup file to Google Drive."""
        service = await self.authenticate()
        if not service:
            return {"error": "credentials.json bulunamadı. Lütfen Google Console'dan yapılandırın."}
            
        from googleapiclient.http import MediaFileUpload
        
        file_metadata = {'name': filename}
        media = MediaFileUpload(file_path, mimetype='application/json')
        
        # execution of files().create() is blocking
        file_op = service.files().create(body=file_metadata,
                                        media_body=media,
                                        fields='id')
        
        file = await asyncio.to_thread(file_op.execute)
        return {"status": "success", "drive_id": file.get('id')}

class GoogleCalendarService:
    def __init__(self, user_id: str):
        self.user_id = user_id
        self.creds = None
        
    async def _get_creds_from_db(self):
        from app.lib.firebase_admin import db
        import asyncio
        
        doc_ref = db.collection('profiles').document(self.user_id).collection('calendar_tokens').document('google')
        doc = await asyncio.to_thread(doc_ref.get)
        
        if doc.exists:
            token_data = doc.to_dict()
            return Credentials.from_authorized_user_info(token_data, SCOPES)
        return None

    async def _save_creds_to_db(self, creds):
        from app.lib.firebase_admin import db
        import asyncio
        
        token_data = json.loads(creds.to_json())
        doc_ref = db.collection('profiles').document(self.user_id).collection('calendar_tokens').document('google')
        await asyncio.to_thread(doc_ref.set, token_data)

    async def authenticate(self, interactive: bool = False, code: str = None, redirect_uri: str = None):
        if not self.creds:
            self.creds = await self._get_creds_from_db()
            
        if not self.creds or not self.creds.valid:
            if self.creds and self.creds.expired and self.creds.refresh_token:
                try:
                    await asyncio.to_thread(self.creds.refresh, Request())
                    await self._save_creds_to_db(self.creds)
                except Exception:
                    if not interactive: return None
            elif code and redirect_uri:
                # Exchange code for tokens
                if not os.path.exists('credentials.json'):
                    return None
                
                flow = await asyncio.to_thread(InstalledAppFlow.from_client_secrets_file,
                    'credentials.json', SCOPES, redirect_uri=redirect_uri)
                await asyncio.to_thread(flow.fetch_token, code=code)
                self.creds = flow.credentials
                await self._save_creds_to_db(self.creds)
            else:
                return None
        
        if not self.creds: return None
        return await asyncio.to_thread(build, 'calendar', 'v3', credentials=self.creds)

    async def get_upcoming_events(self, max_results=10):
        service = await self.authenticate()
        if not service: return []
        
        now = datetime.datetime.utcnow().isoformat() + 'Z'
        
        events_op = service.events().list(calendarId='primary', timeMin=now,
                                          maxResults=max_results, singleEvents=True,
                                          orderBy='startTime')
        
        events_result = await asyncio.to_thread(events_op.execute)
        return events_result.get('items', [])


    async def create_event(self, summary: str, description: str, start_iso: str, end_iso: str):
        """Creates an event in Google Calendar."""
        service = await self.authenticate()
        if not service: return None
        
        # Ensure ISO format is clean (handle trailing Z or +00:00 if needed)
        # Google expects: 2024-04-08T10:00:00Z or with offset
        
        event = {
          'summary': summary,
          'description': description,
          'start': {
            'dateTime': start_iso,
            'timeZone': 'Europe/Istanbul',
          },
          'end': {
            'dateTime': end_iso,
            'timeZone': 'Europe/Istanbul',
          },
          'reminders': {
            'useDefault': True,
          },
        }
        
        try:
            event_op = service.events().insert(calendarId='primary', body=event)
            event_result = await asyncio.to_thread(event_op.execute)
            return event_result.get('htmlLink')
        except Exception as e:
            print(f"Calendar event creation failed: {e}")
            return None
