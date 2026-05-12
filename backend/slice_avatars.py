
import os
from PIL import Image

def slice_avatars(input_path, output_dir, rows=5, cols=7):
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    img = Image.open(input_path)
    width, height = img.size
    
    cell_width = width / cols
    cell_height = height / rows
    
    count = 1
    for r in range(rows):
        for c in range(cols):
            left = c * cell_width
            top = r * cell_height
            right = (c + 1) * cell_width
            bottom = (r + 1) * cell_height
            
            # Crop the avatar
            avatar = img.crop((left, top, right, bottom))
            
            # Save it
            avatar_path = os.path.join(output_dir, f"avatar_{count}.png")
            avatar.save(avatar_path, "PNG")
            print(f"Saved {avatar_path}")
            count += 1

if __name__ == "__main__":
    input_file = r"C:\Users\sefa\.gemini\antigravity\brain\d10f2748-aada-4e13-b6a3-e16190d9fbbd\media__1778589988427.png"
    output_path = r"c:\Users\sefa\.gemini\antigravity\playground\TAMAMLANANLAR\MUF YARD\MufYardV2\frontend\public\avatars"
    slice_avatars(input_file, output_path)
