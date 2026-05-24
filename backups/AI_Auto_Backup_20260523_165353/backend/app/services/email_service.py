import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.config import settings
import asyncio

class EmailService:
    @staticmethod
    async def send_email(subject: str, recipient: str, body_html: str):
        """
        Asenkron olarak SMTP üzerinden e-posta gönderir.
        """
        if not settings.SMTP_USERNAME or not settings.SMTP_PASSWORD:
            print("[!] E-posta ayarları eksik. Mail gönderimi terminale yazdırılıyor:")
            print(f"To: {recipient}\nSubject: {subject}\nBody: {body_html[:100]}...")
            return False

        try:
            # SMTP işlemleri blocking olduğu için thread içerisinde çalıştırıyoruz
            return await asyncio.to_thread(EmailService._sync_send, subject, recipient, body_html)
        except Exception as e:
            print(f"[ERROR] E-posta gönderilemedi: {str(e)}")
            return False

    @staticmethod
    def _sync_send(subject: str, recipient: str, body_html: str):
        msg = MIMEMultipart()
        msg['From'] = settings.MAIL_FROM or settings.SMTP_USERNAME
        msg['To'] = recipient
        msg['Subject'] = subject

        # HTML içeriği ekle
        msg.attach(MIMEText(body_html, 'html'))

        try:
            with smtplib.SMTP(settings.SMTP_SERVER, settings.SMTP_PORT) as server:
                server.starttls()  # TLS güvenliğini başlat
                server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
                server.send_message(msg)
            print(f"[SUCCESS] E-posta başarıyla gönderildi: {recipient}")
            return True
        except Exception as e:
            print(f"SMTP Error: {str(e)}")
            raise e

    @staticmethod
    def get_standard_template(title: str, message: str, action_url: str = None, action_text: str = None):
        """
        Kurumsal GSB laciverti ve kırmızı detaylı HTML şablonu.
        """
        button_html = ""
        if action_url and action_text:
            button_html = f'''
            <div style="margin-top: 30px;">
                <a href="{action_url}" style="background-color: #003366; color: white; padding: 12px 25px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                    {action_text}
                </a>
            </div>
            '''

        return f'''
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; color: #1e293b;">
            <div style="background-color: #003366; padding: 30px; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 24px; letter-spacing: -0.5px;">MufYard V-2.0</h1>
                <p style="color: #cbd5e1; margin-top: 5px; font-size: 14px;">Kurumsal Denetim ve Rehberlik Platformu</p>
            </div>
            <div style="padding: 40px; line-height: 1.6;">
                <h2 style="color: #0f172a; margin-top: 0;">{title}</h2>
                <p style="font-size: 16px;">{message}</p>
                {button_html}
                <p style="margin-top: 40px; font-size: 13px; color: #64748b; border-top: 1px solid #f1f5f9; pt-20px;">
                    Bu e-posta <b>MufYard</b> sistemi tarafından otomatik olarak oluşturulmuştur. Lütfen cevaplamayınız.
                </p>
            </div>
            <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
                <span style="color: #ef4444; font-weight: bold;">T.C. GENÇLİK VE SPOR BAKANLIĞI</span>
            </div>
        </div>
        '''
