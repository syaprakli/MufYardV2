
import os
from PIL import Image

def slice_avatars_precise(input_path, output_dir, rows=5, cols=7):
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    img = Image.open(input_path).convert("RGBA")
    width, height = img.size
    
    # Resmin kenarlarındaki beyaz boşlukları (trim) atalım eğer varsa
    # (Bu görselde genelde kenar payı olur)
    
    # 5 satır 7 sütun için milimetrik hesaplama
    # Her bir hücrenin başlangıç ve bitişini biraz içten alalım (padding)
    
    cell_w = width / cols
    cell_h = height / rows
    
    count = 1
    for r in range(rows):
        for c in range(cols):
            # Hücre sınırları
            left = c * cell_w
            top = r * cell_h
            right = (c + 1) * cell_w
            bottom = (r + 1) * cell_h
            
            # Biraz içten kırpalım ki yandaki avatarın kenarı gelmesin (Padding: %2)
            pad_w = cell_w * 0.02
            pad_h = cell_h * 0.02
            
            crop_box = (
                left + pad_w,
                top + pad_h,
                right - pad_w,
                bottom - pad_h
            )
            
            avatar = img.crop(crop_box)
            
            # Şeffaf arka planı beyaz yapalım (veya olduğu gibi bırakalım PNG)
            avatar_path = os.path.join(output_dir, f"avatar_{count}.png")
            avatar.save(avatar_path, "PNG")
            print(f"Precise Slice: {avatar_path}")
            count += 1

if __name__ == "__main__":
    input_file = r"C:\Users\sefa\.gemini\antigravity\brain\d10f2748-aada-4e13-b6a3-e16190d9fbbd\media__1778589988427.png"
    output_path = r"c:\Users\sefa\.gemini\antigravity\playground\TAMAMLANANLAR\MUF YARD\MufYardV2\frontend\public\avatars"
    slice_avatars_precise(input_file, output_path)
