import pandas as pd
import os

files = [
    "EMDAT Data for App Making.xlsx",
    "Military Personnel Totals.xlsx",
    "Survey of Military Mobilization - National Security and Natural Disasters.xlsx"
]

for file in files:
    print(f"\n--- {file} ---")
    try:
        df = pd.read_excel(file)
        print(f"Columns: {df.columns.tolist()}")
        print(f"Sample data:\n{df.head(3)}")
    except Exception as e:
        print(f"Error reading {file}: {e}")
