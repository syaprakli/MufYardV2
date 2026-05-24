
import os
from PIL import Image

def slice_mega_avatars(input_path, output_dir):
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    img = Image.open(input_path).convert("RGBA")
    width, height = img.size
    
    rows = 10
    cols = 6
    
    # Grid dimensions based on the 10x6 layout
    cell_w = width / cols
    cell_h = height / rows
    
    count = 1
    for r in range(rows):
        # This image has 6 columns for first 5 rows, 5 columns for next 5 rows
        current_cols = 6 if r < 5 else 5
        
        for c in range(current_cols):
            left = c * cell_w
            top = r * cell_h
            right = (c + 1) * cell_w
            bottom = (r + 1) * cell_h
            
            # Padding (%2) to avoid edges
            pad_w = cell_w * 0.02
            pad_h = cell_h * 0.02
            
            crop_box = (
                left + pad_w,
                top + pad_h,
                right - pad_w,
                bottom - pad_h
            )
            
            avatar = img.crop(crop_box)
            
            # Save as avatar_mega_{count}.png
            avatar_path = os.path.join(output_dir, f"avatar_mega_{count}.png")
            # Resize to a higher resolution for crispness (e.g. 256x256)
            avatar = avatar.resize((256, 256), Image.Resampling.LANCZOS)
            avatar.save(avatar_path, "PNG", quality=95)
            print(f"Resliced High-Res: {avatar_path}")
            count += 1
            
    return count - 1

if __name__ == "__main__":
    input_file = r"C:\Users\sefa\.gemini\antigravity\brain\1094b0ec-e531-45ba-8e96-77ab14ad1044\media__1778620451881.jpg"
    output_path = r"c:\Users\sefa\.gemini\antigravity\playground\TAMAMLANANLAR\MUF YARD\MufYardV2\frontend\public\avatars"
    slice_mega_avatars(input_file, output_path)
