import os

def read_logs():
    documents_path = os.path.join(os.path.expanduser("~"), "Documents")
    log_path = os.path.join(documents_path, "MufYARD", "backend_logs.txt")
    
    if not os.path.exists(log_path):
        print(f"Log file not found at: {log_path}")
        return
        
    print(f"Reading recent logs from: {log_path}")
    with open(log_path, 'r', encoding='utf-8', errors='ignore') as f:
        lines = f.readlines()
        recent = lines[-100:]
        for line in recent:
            print(line, end='')

if __name__ == "__main__":
    read_logs()
