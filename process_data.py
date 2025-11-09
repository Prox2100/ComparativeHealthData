#!/usr/bin/env python3
"""
Hospital Price Data Processor
Converts raw hospital pricing data into a web-friendly JSON format
"""

import json
import csv
from collections import defaultdict
from pathlib import Path
import pandas as pd

def load_hospital_price_data(filepath):
    """Load and parse the hospital price data"""
    print(f"Loading hospital price data from {filepath}...")

    hospitals_data = defaultdict(lambda: {
        'procedures': {},
        'total_volume': 0,
        'total_charges': 0,
        'total_cost': 0,
        'total_paid': 0
    })

    with open(filepath, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f, delimiter='|')

        for row in reader:
            provnum = row['provnum']
            category = row['category']  # CPT/HCPCS code
            volume = int(row['volume']) if row['volume'] else 0
            total_charges = float(row['TotalCharges']) if row['TotalCharges'] else 0
            total_cost = float(row['TotalCost']) if row['TotalCost'] else 0
            total_paid = float(row['TotalPaid']) if row['TotalPaid'] else 0

            # Calculate averages
            avg_charge = total_charges / volume if volume > 0 else 0
            avg_cost = total_cost / volume if volume > 0 else 0
            avg_paid = total_paid / volume if volume > 0 else 0

            # Store procedure data
            hospitals_data[provnum]['procedures'][category] = {
                'volume': volume,
                'total_charges': round(total_charges, 2),
                'total_cost': round(total_cost, 2),
                'total_paid': round(total_paid, 2),
                'avg_charge': round(avg_charge, 2),
                'avg_cost': round(avg_cost, 2),
                'avg_paid': round(avg_paid, 2)
            }

            # Update hospital totals
            hospitals_data[provnum]['total_volume'] += volume
            hospitals_data[provnum]['total_charges'] += total_charges
            hospitals_data[provnum]['total_cost'] += total_cost
            hospitals_data[provnum]['total_paid'] += total_paid

    print(f"Loaded data for {len(hospitals_data)} hospitals")
    return hospitals_data

def load_facility_data(filepath):
    """Load facility data including names and metadata from Excel file"""
    print(f"Loading facility data from {filepath}...")

    # CMS Hospital Type Codes
    hospital_type_map = {
        1: 'Short-Term Acute',
        1.0: 'Short-Term Acute',
        2: 'Psychiatric',
        2.0: 'Psychiatric',
        4: 'Rehabilitation',
        4.0: 'Rehabilitation',
        5: 'Religious Non-Medical',
        5.0: 'Religious Non-Medical',
        6: 'Childrens',
        6.0: 'Childrens',
        7: 'Critical Access',
        7.0: 'Critical Access',
        11: 'Long Term Care',
        11.0: 'Long Term Care'
    }

    # CMS Ownership Type Codes
    ownership_map = {
        '01': 'Government, Federal',
        '02': 'Government, State',
        '03': 'Government, Local',
        '04': 'Government, Hospital District',
        '05': 'Government, City/County',
        '06': 'Voluntary Non-Profit, Church',
        '07': 'Voluntary Non-Profit, Private',
        '08': 'Voluntary Non-Profit, Other',
        '09': 'Proprietary, Individual',
        '10': 'Proprietary, Partnership',
        '11': 'Proprietary, Corporation',
        '12': 'Proprietary, Limited Liability Company',
        '13': 'Voluntary Non-Profit, Private',
        '1A': 'Government, Federal',
        '1B': 'Government, State',
        '1C': 'Government, Local',
        '2A': 'Voluntary Non-Profit, Church',
        '2B': 'Voluntary Non-Profit, Other',
        '2C': 'Voluntary Non-Profit, Private',
        '30': 'Government, Other'
    }

    try:
        # Read the facility data Excel file
        df = pd.read_excel(filepath, dtype={'provnum': str, 'zip_code': str})

        # Create a mapping of provnum to facility data
        facility_map = {}
        for _, row in df.iterrows():
            provnum = str(row.get('provnum', '')).strip()
            facility_name = str(row.get('facility_name', '')).strip()

            if provnum and facility_name and facility_name != 'nan':
                # Extract metadata with safe defaults
                hospital_type_code = row.get('category_subtype_of_provider')
                ownership_code = row.get('type_of_control')

                # Convert codes to readable text
                hospital_type = hospital_type_map.get(hospital_type_code, '') if pd.notna(hospital_type_code) else ''
                ownership = ownership_map.get(str(ownership_code).strip(), '') if pd.notna(ownership_code) else ''

                facility_map[provnum] = {
                    'name': facility_name,
                    'city': str(row.get('city', '')).strip() if pd.notna(row.get('city')) else '',
                    'state': str(row.get('state_code', '')).strip() if pd.notna(row.get('state_code')) else '',
                    'zip_code': str(row.get('zip_code', '')).strip() if pd.notna(row.get('zip_code')) else '',
                    'beds_total': int(row.get('beds_total', 0)) if pd.notna(row.get('beds_total')) else 0,
                    'hospital_type': hospital_type,
                    'ownership': ownership
                }

        print(f"Loaded {len(facility_map)} facilities with metadata")
        return facility_map
    except Exception as e:
        print(f"Warning: Could not load facility data from Excel: {e}")
        print("Using provider numbers as names...")
        return {}

def load_procedure_names(filepath):
    """Load procedure names from Excel file"""
    print(f"Loading procedure names from {filepath}...")

    try:
        # Read the Web Addendum Excel file - header is at row 4 (0-indexed)
        df = pd.read_excel(filepath, header=4, dtype={'HCPCS Code': str})

        # Create a mapping of HCPCS code to description
        procedure_map = {}
        for _, row in df.iterrows():
            code = str(row.get('HCPCS Code', '')).strip()
            description = str(row.get('Short Descriptor', '')).strip()

            if code and description and code != 'nan' and description != 'nan':
                procedure_map[code] = description

        print(f"Loaded {len(procedure_map)} procedure descriptions")
        return procedure_map
    except Exception as e:
        print(f"Warning: Could not load procedure names from Excel: {e}")
        print("Using basic procedure names...")
        return {}

def load_service_categories(filepath):
    """Load service categories and shoppable service info from Excel file"""
    print(f"Loading service categories from {filepath}...")

    try:
        # Read the Service Category Xwalk file
        df = pd.read_excel(filepath, dtype={'HCPCS Code': str, 'CMS Shoppable': str})

        # Create mappings for both service category and shoppable status
        category_map = {}
        shoppable_map = {}
        categories_set = set()

        for _, row in df.iterrows():
            code = str(row.get('HCPCS Code', '')).strip()
            category = str(row.get('Service Category', '')).strip()
            shoppable = str(row.get('CMS Shoppable', '')).strip().upper()

            if code and code != 'nan':
                if category and category != 'nan':
                    category_map[code] = category
                    categories_set.add(category)

                if shoppable and shoppable != 'NAN':
                    shoppable_map[code] = shoppable

        # Sort categories alphabetically
        unique_categories = sorted(list(categories_set))

        print(f"Loaded {len(category_map)} service category mappings")
        print(f"Loaded {len(shoppable_map)} shoppable service mappings")
        print(f"Found {len(unique_categories)} unique categories")
        return category_map, shoppable_map, unique_categories
    except Exception as e:
        print(f"Warning: Could not load service categories from Excel: {e}")
        return {}, {}, []

def process_and_export_data():
    """Main processing function"""
    base_path = Path(__file__).parent.parent
    data_path = base_path / 'Data' / 'Hospital Price Data.txt'
    facility_data_path = base_path / 'Data' / 'chd_facility_data.xlsx'
    procedure_data_path = base_path / 'Data' / 'October 2025 Web Addendum B.09.26.25.xlsx'
    service_category_path = base_path / 'Data' / 'Service Category Xwalk.xlsx'
    output_path = Path(__file__).parent / 'data' / 'hospital_data.json'

    # Load hospital data
    hospitals_data = load_hospital_price_data(data_path)

    # Get facility data, procedure names, and service categories from Excel files
    facility_data = load_facility_data(facility_data_path)
    procedure_names = load_procedure_names(procedure_data_path)
    service_category_map, shoppable_map, service_categories = load_service_categories(service_category_path)

    # Create the final data structure
    output_data = {
        'hospitals': {},
        'procedure_codes': list(set(
            code
            for hospital in hospitals_data.values()
            for code in hospital['procedures'].keys()
        )),
        'procedure_names': procedure_names,
        'service_categories': service_categories,
        'service_category_map': service_category_map,
        'shoppable_map': shoppable_map
    }

    # Format hospital data
    for provnum, data in hospitals_data.items():
        facility_info = facility_data.get(provnum, {})

        output_data['hospitals'][provnum] = {
            'name': facility_info.get('name', f'Hospital {provnum}'),
            'provnum': provnum,
            'city': facility_info.get('city', ''),
            'state': facility_info.get('state', ''),
            'zip_code': facility_info.get('zip_code', ''),
            'beds_total': facility_info.get('beds_total', 0),
            'hospital_type': facility_info.get('hospital_type', ''),
            'ownership': facility_info.get('ownership', ''),
            'procedures': data['procedures'],
            'summary': {
                'total_volume': data['total_volume'],
                'total_charges': round(data['total_charges'], 2),
                'total_cost': round(data['total_cost'], 2),
                'total_paid': round(data['total_paid'], 2),
                'avg_charge_per_case': round(
                    data['total_charges'] / data['total_volume'] if data['total_volume'] > 0 else 0,
                    2
                )
            }
        }

    # Save to JSON
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, indent=2)

    print(f"\nData processing complete!")
    print(f"Output saved to: {output_path}")
    print(f"Total hospitals: {len(output_data['hospitals'])}")
    print(f"Total unique procedures: {len(output_data['procedure_codes'])}")

if __name__ == '__main__':
    process_and_export_data()
