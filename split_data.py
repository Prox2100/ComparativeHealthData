#!/usr/bin/env python3
"""
Split the large hospital_data.json into smaller chunks for easier browser loading
"""
import json
import os

print("Loading hospital data...")
with open('data/hospital_data.json', 'r') as f:
    data = json.load(f)

print(f"Loaded data with {len(data.get('hospitals', {}))} hospitals")

# Create chunks directory
os.makedirs('data/chunks', exist_ok=True)

# Save metadata (procedure codes, names, etc.) separately
metadata = {
    'procedure_codes': data.get('procedure_codes', {}),
    'procedure_names': data.get('procedure_names', {}),
    'service_categories': data.get('service_categories', {}),
    'service_category_map': data.get('service_category_map', {}),
    'shoppable_map': data.get('shoppable_map', {})
}

print("Saving metadata...")
with open('data/chunks/metadata.json', 'w') as f:
    json.dump(metadata, f, separators=(',', ':'))

# Split hospitals into chunks of 1000 each
hospitals = data.get('hospitals', {})
hospital_items = list(hospitals.items())
chunk_size = 1000

print(f"Splitting {len(hospital_items)} hospitals into chunks of {chunk_size}...")

chunks_info = []
for i in range(0, len(hospital_items), chunk_size):
    chunk_num = i // chunk_size
    chunk = dict(hospital_items[i:i + chunk_size])

    filename = f'hospitals_{chunk_num:03d}.json'
    filepath = f'data/chunks/{filename}'

    with open(filepath, 'w') as f:
        json.dump(chunk, f, separators=(',', ':'))

    file_size = os.path.getsize(filepath) / (1024 * 1024)  # MB
    chunks_info.append({
        'file': filename,
        'hospitals': len(chunk),
        'size_mb': round(file_size, 2)
    })

    print(f"  Created {filename}: {len(chunk)} hospitals, {file_size:.2f} MB")

# Save chunk index
index = {
    'total_hospitals': len(hospital_items),
    'chunk_size': chunk_size,
    'chunks': chunks_info
}

with open('data/chunks/index.json', 'w') as f:
    json.dump(index, f, indent=2)

print(f"\nDone! Created {len(chunks_info)} chunks in data/chunks/")
print(f"Total hospitals: {len(hospital_items)}")
print(f"Chunk index saved to: data/chunks/index.json")
