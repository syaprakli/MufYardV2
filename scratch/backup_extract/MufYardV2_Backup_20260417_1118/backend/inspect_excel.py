import pandas as pd
import os

file_path = "rehber.xlsx"
if os.path.exists(file_path):
    df = pd.read_excel(file_path, header=None)
    print(f"Total Rows: {len(df)}")
    print(f"Total Cols: {len(df.columns)}")
    print("-" * 50)
    for i, row in df.iloc[0:60].iterrows():
        print(f"Row {i}: {row.values.tolist()}")
else:
    print("File not found")
