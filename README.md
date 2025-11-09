# Hospital Price Comparison Web Application

A modern, user-friendly web application for comparing hospital pricing across facilities and procedures.

## Features

- **Select Target Hospital**: Choose the primary hospital you want to analyze
- **Comparison Options**:
  - **Single Hospital**: Compare against one specific hospital
  - **Hospital Group**: Compare against multiple hospitals (peer group)
- **Procedure Filtering**: Filter results by specific CPT/HCPCS codes (optional)
- **Comprehensive Analysis**:
  - Overall weighted average variance
  - Procedure-level price comparisons
  - Volume-weighted calculations
  - Detailed metrics and statistics
- **Export Capabilities**:
  - Export results to CSV
  - Print-friendly report view
- **Modern UI**: Apple-inspired design with responsive layout

## Quick Start

### 1. Process the Data (One-time setup)

First, convert the raw hospital data into a web-friendly JSON format:

```bash
cd web-app
python3 process_data.py
```

This will create `data/hospital_data.json` containing all hospital pricing information.

### 2. Start the Local Server

Start a simple HTTP server to run the application:

```bash
# Using Python 3
python3 -m http.server 8000

# Or using Python 2
python -m SimpleHTTPServer 8000
```

### 3. Open in Browser

Open your web browser and navigate to:

```
http://localhost:8000
```

## How to Use

### Basic Comparison (Single Hospital)

1. **Select Target Hospital**: Choose the hospital you want to analyze from the first dropdown
2. **Select Comparison Hospital**: Choose a hospital to compare against
3. **Optional**: Enter a specific CPT/HCPCS code to filter results
4. **Click "Compare Prices"**: View the comparison results

### Group Comparison

1. **Select Target Hospital**: Choose the hospital you want to analyze
2. **Click "Hospital Group" tab**: Switch to group comparison mode
3. **Select Multiple Hospitals**: Check the boxes for hospitals you want to include in the peer group
4. **Optional**: Filter by procedure code
5. **Click "Compare Prices"**: View the aggregated comparison

### Understanding the Results

#### Summary Cards
- **Target Hospital**: The hospital you're analyzing
- **Comparison**: The hospital(s) you're comparing against
- **Overall Variance**: Percentage difference (weighted average)
  - Positive (red): Target hospital charges MORE than comparison
  - Negative (green): Target hospital charges LESS than comparison

#### Overall Metrics
- **Procedures Compared**: Number of matching procedures found
- **Target Weighted Avg**: Volume-weighted average charge for target hospital
- **Comparison Weighted Avg**: Volume-weighted average for comparison group
- **Price Difference**: Dollar and percentage variance

#### Procedure-Level Table
Detailed breakdown by CPT/HCPCS code showing:
- Procedure code and name
- Average charges for both target and comparison
- Dollar difference
- Percentage variance (sorted by highest variance first)

### Exporting Results

- **Export to CSV**: Download a CSV file with all comparison data
- **Print Report**: Opens a print-friendly view (removes filters and controls)

## Project Structure

```
web-app/
├── index.html          # Main HTML structure
├── css/
│   └── styles.css      # Apple-inspired styling
├── js/
│   └── app.js          # Application logic and comparison calculations
├── data/
│   └── hospital_data.json  # Processed hospital data (generated)
├── process_data.py     # Data processing script
└── README.md           # This file
```

## Technical Details

### Data Processing

The `process_data.py` script:
- Reads the raw Hospital Price Data.txt file (pipe-delimited)
- Processes 2.8M+ pricing records across 41,000+ hospitals
- Calculates average charges, costs, and payments per procedure
- Generates a JSON file optimized for web performance

### Calculation Methodology

**Weighted Average Variance**:
- Uses volume-weighted averages for fair comparison
- Compares procedures that exist in both target and comparison hospitals
- For group comparisons, averages the comparison hospitals' prices for each procedure
- Overall variance is calculated using target hospital's procedure volumes as weights

**Procedure-Level Variance**:
```
% Variance = ((Target Avg - Comparison Avg) / Comparison Avg) × 100
```

### Browser Compatibility

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Responsive design for mobile and tablet
- No external dependencies (vanilla JavaScript)

## Data Sources

- **Hospital Price Data**: CMS Hospital Price Transparency data
- **Procedure Codes**: CPT/HCPCS codes with descriptions
- **Facility Information**: Hospital names and provider numbers

## Performance

- Handles 41,000+ hospitals efficiently
- 7,300+ unique procedure codes
- Client-side processing for instant results
- Optimized data structure for fast lookups

## Future Enhancements

Potential improvements based on PROJECT_PLAN.md:
- Integration with facility demographic data (beds, location, type)
- Geographic filtering (by state, city, zip code, radius)
- Service category grouping
- Interactive charts and visualizations
- Historical trend analysis
- API integration
- Advanced filtering options

## License

This application is for educational and research purposes. Hospital pricing data is sourced from publicly available CMS transparency requirements.

## Support

For issues or questions, please refer to the PROJECT_PLAN.md for comprehensive project documentation.
