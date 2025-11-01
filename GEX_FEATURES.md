# Gamma Exposure Analysis (GEX)

A Next.js web application for analyzing gamma exposure from options data using interactive visualizations.

## Features

### File Upload
- Upload JSON files containing options contract data
- Supports the same format as the provided `options_sample.json`

### Gamma Exposure Calculation
The gamma exposure for each strike is calculated as:

$$GEX = \text{Underlying Price} \times \gamma \times \text{Open Interest} \times \text{Multiplier}$$

For put options (right = "P"), the result is multiplied by -1.

### Interactive Chart
- Bar chart displaying gamma exposure by strike price
- Green bars represent positive gamma exposure (bullish)
- Red bars represent negative gamma exposure (bearish)
- Strikes are ordered from highest to lowest on the chart

### Filtering & Controls

#### Strike Range Filter
- **Default Range**: 0.8x to 1.2x the underlying price (automatically set on file upload)
- **Manual Range**: Adjust using sliders or direct number input
- **Quick Range Buttons**:
  - ±20% (default)
  - ±10%
  - ±5%
  - All Strikes

#### Date Filter
- Filter by trade date (from the `lastTradeDate` field)

### Detailed Data Table
- View detailed gamma exposure data for each strike
- Columns include:
  - Strike price
  - Option type (Call/Put)
  - Open interest
  - Gamma value
  - Calculated gamma exposure

## Project Structure

```
app/
├── types.ts              # TypeScript type definitions
├── utils.ts              # Utility functions for data processing
├── gex-analysis.tsx      # Main component with UI and logic
├── page.tsx              # Home page (uses GexAnalysis component)
├── layout.tsx            # Root layout
└── globals.css           # Global styles
```

## Data Format

The uploaded JSON file should be an array of option objects with this structure:

```json
[
  {
    "contract": {
      "symbol": "ES",
      "secType": "FOP",
      "lastTradeDateOrContractMonth": "20251219 15:30:00 Europe/Berlin",
      "lastTradeDate": "20251219",
      "strike": 2400,
      "right": "P",
      "exchange": "CME",
      "currency": "USD",
      "localSymbol": "ESZ5 P2400",
      "tradingClass": "ES",
      "conId": 495665717,
      "multiplier": 50,
      "primaryExch": ""
    },
    "data": {
      "iv": 0.8489243618457641,
      "delta": -0.00016276970166636845,
      "price": 0.09399551162931076,
      "pvDividend": 0,
      "gamma": 2.897013047825834e-7,
      "vega": 0.022829380952312087,
      "theta": -0.011874877780469167,
      "undPrice": 6903.50244140625,
      "openInterest": 1036
    }
  }
]
```

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## Build for Production

```bash
npm run build
npm start
```

## Technologies Used

- **Framework**: Next.js 16.0.1
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **React**: 19.2.0

## Key Functions

### `calculateGammaExposure(option: Option): number`
Calculates the gamma exposure for a single option, accounting for sign (positive for calls, negative for puts).

### `parseOptionsFile(jsonContent: string): Option[]`
Parses a JSON file containing options data with error handling.

### `processOptionsData(options: Option[]): ProcessedGexData`
Processes an array of options and returns aggregated gamma exposure data organized by strike.

### `filterGexData(data: ProcessedGexData, selectedDate: string | null, strikeRangeMin: number, strikeRangeMax: number): GexDataPoint[]`
Filters and sorts gamma exposure data based on date and strike range (sorted highest to lowest).

## Usage Example

1. Start the application: `npm run dev`
2. Click on the file upload input to select a JSON file with options data
3. The chart will automatically display with a default ±20% strike range
4. Use the filter controls to adjust the strike range
5. Use quick range buttons for common ranges (±5%, ±10%, ±20%, All)
6. View detailed data in the table below the chart

## Notes

- Gamma exposure is negative for puts, indicating they decrease in value as the underlying price increases
- The underlying price is taken from the first option in the file
- All strikes within the selected range are displayed, sorted from highest to lowest
