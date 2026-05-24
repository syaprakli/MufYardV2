import pandas as pd

df = pd.read_excel('rehber.xlsx', header=None)

dropped_due_to_no_title = []
for _, row in df.iterrows():
    vals = row.values.tolist()
    if len(vals) < 2: continue
    
    # Check if Name is missing
    if pd.isna(vals[0]) or str(vals[0]).strip() == "":
        continue
        
    # Check if Title is missing
    if pd.isna(vals[1]) or str(vals[1]).strip() == "":
        # We considered this a category header.
        # But what if they have a phone or room number?
        has_other_data = False
        for i in range(2, min(6, len(vals))):
            if not pd.isna(vals[i]) and str(vals[i]).strip() != "":
                has_other_data = True
                break
                
        if has_other_data:
            dropped_due_to_no_title.append(str(vals[0]).strip())

print(f"Dropped due to no title (but has other data): {len(dropped_due_to_no_title)}")
print(dropped_due_to_no_title)
