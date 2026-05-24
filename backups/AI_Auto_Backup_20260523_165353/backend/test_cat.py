import pandas as pd
df = pd.read_excel('rehber.xlsx', header=None)
categories = set()
for _,row in df.iterrows():
    vals=row.values.tolist()
    if len(vals)<2: continue
    if pd.isna(vals[0]) or str(vals[0]).strip()=='': continue
    is_title_empty = pd.isna(vals[1]) or str(vals[1]).strip() == ''
    is_phone_empty = len(vals) <= 2 or pd.isna(vals[2]) or str(vals[2]).strip() == ''
    is_ext_empty = len(vals) <= 3 or pd.isna(vals[3]) or str(vals[3]).strip() == ''
    if is_title_empty and is_phone_empty and is_ext_empty:
        pot=str(vals[0]).strip()
        if len(pot)>3 and 'ADI SOYADI' not in pot:
            categories.add(pot.title())
print('Captured Categories:', categories)
