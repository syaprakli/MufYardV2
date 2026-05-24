
import os
from PIL import Image

def slice_mega_avatars(input_path, output_dir):
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    img = Image.open(input_path).convert("RGBA")
    width, height = img.size
    
    rows = 10
    cols = 6
    
    cell_w = width / cols
    cell_h = height / rows
    
    count = 1
    for r in range(rows):
        for c in range(cols):
            # Son 3 satırda sadece 5 avatar var (sağ taraf boş)
            if r >= 7 and c >= 5:
                continue
            
            left = c * cell_w
            top = r * cell_h
            right = (c + 1) * cell_w
            bottom = (r + 1) * cell_h
            
            # Padding (%3) - Kenarlardan biraz içe girelim ki pürüzsüz olsun
            pad_w = cell_w * 0.03
            pad_h = cell_h * 0.03
            
            crop_box = (
                left + pad_w,
                top + pad_h,
                right - pad_w,
                bottom - pad_h
            )
            
            avatar = img.crop(crop_box)
            
            avatar_path = os.path.join(output_dir, f"avatar_mega_{count}.png")
            avatar.save(avatar_path, "PNG")
            print(f"Mega Slice: {avatar_path}")
            count += 1
    return count - 1

if __name__ == "__main__":
    input_file = r"C:\Users\sefa\.gemini\antigravity\brain\d10f2748-aada-4e13-b6a3-e16190d9fbbd\media__1778591096362.jpg"
    output_path = r"c:\Users\sefa\.gemini\antigravity\playground\TAMAMLANANLAR\MUF YARD\MufYardV2\frontend\public\avatars"
    slice_mega_avatars(input_file, output_path)
