# Gamma Exposure Analysis - User Guide

## Overview

The Gamma Exposure Analysis (GEX) application helps traders visualize and analyze gamma exposure across different strike prices in options markets.

### What is Gamma Exposure?

Gamma exposure represents the aggregate impact of gamma across all options at different strikes. It's calculated by multiplying:
- The underlying asset price
- The gamma value (rate of delta change)
- The open interest (number of contracts)
- The contract multiplier

Negative gamma exposure indicates puts (which lose value as the price increases), while positive exposure indicates calls.

## Getting Started

### 1. Upload a File

1. Click the **"Choose File"** button in the "Upload Options JSON File" section
2. Select a JSON file containing options data (see format below)
3. The application will automatically process the data

### 2. View the Chart

After uploading:
- A bar chart displays gamma exposure by strike
- **Green bars** = Positive gamma exposure (calls)
- **Red bars** = Negative gamma exposure (puts)
- Strikes are ordered from **highest to lowest**

### 3. Filter the Data

#### Strike Range Controls

**Sliders & Number Input:**
- Adjust the minimum and maximum strike prices
- Changes update the chart in real-time

**Quick Range Buttons:**
- **±20%**: Default range around the underlying price
- **±10%**: Tighter range for focusing on near-the-money options
- **±5%**: Very tight range for deeply nested options
- **All Strikes**: View every strike in the data

#### Information Panel

The blue information box displays:
- **Underlying Price**: Current price of the underlying asset
- **Trade Date**: Settlement date for the options
- **Total Strikes**: Number of unique strikes in the file

### 4. View Detailed Data

Below the chart, a **Detailed Data Table** shows:
- **Strike**: Strike price of the option
- **Type**: Whether it's a Call (C) or Put (P)
- **Open Interest**: Number of open contracts at this strike
- **Gamma**: The gamma value (shown in scientific notation)
- **Gamma Exposure**: The calculated gamma exposure for this strike

## JSON File Format

Your upload file should be an array of options with this structure:

```json
[
  {
    "contract": {
      "symbol": "ES",                    // Underlying symbol
      "secType": "FOP",                  // Security type
      "lastTradeDate": "20251219",       // Settlement date (YYYYMMDD)
      "strike": 2400,                    // Strike price
      "right": "P",                      // "C" for Call, "P" for Put
      "exchange": "CME",                 // Exchange
      "currency": "USD",                 // Currency
      "multiplier": 50                   // Contract multiplier
    },
    "data": {
      "gamma": 2.897013047825834e-7,    // Gamma value
      "undPrice": 6903.50244140625,     // Underlying price
      "openInterest": 1036               // Open interest
    }
  }
]
```

## Tips for Analysis

1. **Default Range**: The application automatically shows strikes ±20% from the underlying price, which covers most liquidity
2. **Volatility Analysis**: Wider ranges of positive/negative gamma suggest higher volatility
3. **Market Direction**: 
   - High positive gamma = market expects less volatility
   - High negative gamma = market expects more volatility
4. **Practical Filtering**: Use ±10% for active trading levels, or ±5% for very precise strike focus

## Interpreting Results

- **Strong Green Bar**: Significant positive gamma exposure at that strike (heavy call options)
- **Strong Red Bar**: Significant negative gamma exposure at that strike (heavy put options)
- **Flat Pattern**: Balanced gamma across strikes
- **Spike Pattern**: Concentrated gamma at specific strikes (common at round numbers)

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Invalid JSON file" error | Ensure your file is valid JSON matching the required format |
| No data displayed | Check that your JSON file contains at least one option record |
| Unexpected numbers in chart | Verify the `undPrice`, `gamma`, `openInterest`, and `multiplier` values are correct |
