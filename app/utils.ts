import { Option, GexDataPoint, ProcessedGexData } from "./types";

export function calculateGammaExposure(option: Option): number {
  const {
    contract: { multiplier, right },
    data: { gamma, undPrice, openInterest },
  } = option;

  let exposure = undPrice * gamma * openInterest * multiplier;

  // Puts should be negative
  if (right === "P") {
    exposure *= -1;
  }

  return exposure;
}

export function parseOptionsFile(jsonContent: string): Option[] {
  try {
    return JSON.parse(jsonContent);
  } catch (error) {
    throw new Error(`Invalid JSON file: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

export function processOptionsData(options: Option[]): ProcessedGexData {
  // Filter out options with missing or null data
  const validOptions = options.filter((option) => option.data != null);

  if (validOptions.length === 0) {
    throw new Error("No valid options data provided");
  }

  // Use the first valid option's underlying price as reference
  const underlierPrice = validOptions[0].data.undPrice;

  // Group options by expiration date and strike
  const strikeMapByExp = new Map<string, Map<number, GexDataPoint>>();

  validOptions.forEach((option) => {
    const expirationDate = option.contract.lastTradeDate;
    const strike = option.contract.strike;
    const gammaExposure = calculateGammaExposure(option);

    // Initialize maps for this expiration if needed
    if (!strikeMapByExp.has(expirationDate)) {
      strikeMapByExp.set(expirationDate, new Map());
    }

    const strikeMap = strikeMapByExp.get(expirationDate)!;

    if (strikeMap.has(strike)) {
      // Add to existing strike entry
      const existing = strikeMap.get(strike)!;
      existing.gammaExposure += gammaExposure;
    } else {
      // Create new strike entry
      strikeMap.set(strike, {
        strike,
        gammaExposure,
        underlying: underlierPrice,
        right: option.contract.right,
        openInterest: option.data.openInterest,
        multiplier: option.contract.multiplier,
        gamma: option.data.gamma,
      });
    }
  });

  // Convert to arrays and sort by expiration date
  const expirationDates = Array.from(strikeMapByExp.keys()).sort();
  const dataPointsByExpiration = new Map<string, GexDataPoint[]>();

  strikeMapByExp.forEach((strikeMap, expirationDate) => {
    const dataPoints = Array.from(strikeMap.values());
    dataPointsByExpiration.set(expirationDate, dataPoints);
  });

  // For backward compatibility, use all data points
  const allDataPoints = Array.from(dataPointsByExpiration.values()).flat();

  return {
    date: expirationDates[0] || validOptions[0].contract.lastTradeDate,
    dataPoints: allDataPoints,
    underlierPrice,
    expirationDates,
    dataPointsByExpiration,
  };
}

export function filterGexData(
  data: ProcessedGexData,
  selectedDates: string[],
  strikeRangeMin: number,
  strikeRangeMax: number
): GexDataPoint[] {
  // If no dates selected, return empty
  if (selectedDates.length === 0) {
    return [];
  }

  // Aggregate data points by strike across all selected dates
  const strikeMap = new Map<number, GexDataPoint>();

  selectedDates.forEach((date) => {
    const points = data.dataPointsByExpiration.get(date);
    if (points) {
      points.forEach((point) => {
        if (strikeMap.has(point.strike)) {
          // Aggregate gamma exposure for this strike
          const existing = strikeMap.get(point.strike)!;
          existing.gammaExposure += point.gammaExposure;
        } else {
          // Add new strike entry (create a copy to avoid mutations)
          strikeMap.set(point.strike, { ...point });
        }
      });
    }
  });

  // Convert to array, filter by strike range, and sort
  return Array.from(strikeMap.values())
    .filter((point) => point.strike >= strikeRangeMin && point.strike <= strikeRangeMax)
    .sort((a, b) => b.strike - a.strike);
}

export function findGammaFlips(dataPoints: GexDataPoint[]): number[] {
  // Find strikes where gamma exposure changes sign
  const flips: number[] = [];

  // Sort by strike ascending for easier comparison
  const sorted = [...dataPoints].sort((a, b) => a.strike - b.strike);

  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i].gammaExposure;
    const next = sorted[i + 1].gammaExposure;

    // Check if sign changes (flip occurs between these two strikes)
    if ((current < 0 && next > 0) || (current > 0 && next < 0)) {
      flips.push(sorted[i].strike);
    }
  }

  return flips;
}
