import sys

def check_delimiters(file_path):
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        print(f"Error reading file: {e}")
        return

    stack = []
    pairs = {'{': '}', '(': ')', '[': ']'}
    
    for i, char in enumerate(content):
        if char in pairs:
            stack.append((char, i))
        elif char in pairs.values():
            if not stack:
                line = content.count('\n', 0, i) + 1
                print(f"Unmatched closing {char} at line {line}, index {i}")
                continue
            open_char, open_idx = stack.pop()
            if pairs[open_char] != char:
                line = content.count('\n', 0, i) + 1
                print(f"Mismatched {open_char} from index {open_idx} with {char} at line {line}, index {i}")
    
    if stack:
        for char, idx in stack:
            line = content.count('\n', 0, idx) + 1
            print(f"Unclosed {char} at line {line}, index {idx}")

if __name__ == "__main__":
    check_delimiters(sys.argv[1])
