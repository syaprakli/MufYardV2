import sys

def clean_file(file_path):
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Remove any non-standard characters if needed, but here we just want to ensure clean UTF-8
        # and maybe fix any obvious issues.
        # However, let's just re-write it as clean UTF-8.
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print("File cleaned and rewritten.")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    clean_file(sys.argv[1])
