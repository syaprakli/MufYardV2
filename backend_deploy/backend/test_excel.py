import pandas as pd

df = pd.read_excel('rehber.xlsx', header=None)
print("Total rows:", len(df))

count = 0
dropped = []

for idx, row in df.iterrows():
    vals = row.values.tolist()
    if len(vals) < 2:
        continue
    
    # Check if Name is missing
    if pd.isna(vals[0]) or str(vals[0]).strip() == "":
        continue
        
    # Categories have missing titles (col 1) usually, what if Title is NOT missing?
    # Wait, the v6 logic says: if Title is missing, it's a category.
    # What if Title is NOT missing, but it's a valid contact? We process them.
    
    name = str(vals[0]).strip()
    if "ADI SOYADI" in name:
        continue
        
    if pd.isna(vals[1]) or str(vals[1]).strip() == "":
        continue # It's a header category.
        
    if len(name) < 3 or name.replace(" ", "").isdigit():
        dropped.append(name)
        continue
        
    count += 1
    
print("Total Valid Personnel Count:", count)
print("Dropped Names:", dropped)

