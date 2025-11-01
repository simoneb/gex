import { Option, GexDataPoint, ProcessedGexData, CBOEData, CBOEOptionData } from "./types";
import { norm } from "./stats-utils";

// ===== Format Detection =====
function isCBOEFormat(data: unknown): boolean {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;
  return Boolean(
    obj.data &&
    typeof obj.data === "object" &&
    (obj.data as Record<string, unknown>).options &&
    Array.isArray((obj.data as Record<string, unknown>).options) &&
    ((obj.data as Record<string, unknown>).options as unknown[]).length > 0 &&
    typeof (((obj.data as Record<string, unknown>).options as unknown[])[0] as Record<string, unknown>).option === "string" &&
    typeof (obj.data as Record<string, unknown>).current_price === "number" &&
    obj.symbol
  );
}

function isLegacyFormat(data: unknown): boolean {
  if (!Array.isArray(data) || data.length === 0) return false;
  const first = data[0] as Record<string, unknown>;
  return Boolean(
    first.contract &&
    first.data &&
    typeof (first.contract as Record<string, unknown>).strike === "number"
  );
}

// ===== Black-Scholes Gamma Calculation (ported from Python) =====
export function calcGammaEx(
  S: number, // Spot price
  K: number, // Strike price
  vol: number, // Volatility (IV)
  T: number, // Time to expiration (as fraction of year)
  r: number, // Risk-free rate
  q: number, // Dividend yield
  optType: "call" | "put",
  OI: number // Open interest
): number {
  if (T === 0 || vol === 0) {
    return 0;
  }

  const dp = (Math.log(S / K) + (r - q + 0.5 * vol ** 2) * T) / (vol * Math.sqrt(T));
  const dm = dp - vol * Math.sqrt(T);

  let gamma = 0;
  if (optType === "call") {
    gamma = Math.exp(-q * T) * norm.pdf(dp) / (S * vol * Math.sqrt(T));
  } else {
    // Gamma is same for calls and puts, this is just to cross-check
    gamma = (K * Math.exp(-r * T) * norm.pdf(dm)) / (S * S * vol * Math.sqrt(T));
  }

  return OI * 100 * S * S * 0.01 * gamma;
}

// ===== Parse Options File (Detect Format) =====
export function parseOptionsFile(jsonContent: string): Option[] | CBOEData {
  try {
    const data = JSON.parse(jsonContent);

    if (isCBOEFormat(data)) {
      return data;
    } else if (isLegacyFormat(data)) {
      return data;
    } else {
      throw new Error("Unrecognized JSON format");
    }
  } catch (error) {
    throw new Error(
      `Invalid JSON file: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

// ===== Legacy Format Processing =====
function calculateGammaExposureLegacy(option: Option): number {
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

export function processLegacyOptions(options: Option[]): ProcessedGexData {
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
    const gammaExposure = calculateGammaExposureLegacy(option);

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
        expirationDate,
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
    symbol: validOptions[0].contract.symbol,
    dataPoints: allDataPoints,
    underlierPrice,
    expirationDates,
    dataPointsByExpiration,
    fileFormat: "legacy",
  };
}

// ===== CBOE Format Processing =====
function parseCBOEOption(option: CBOEOptionData): {
  strike: number;
  callPut: "C" | "P";
  expirationDate: string;
} {
  // Parse option string like "CMG251031C00016000"
  // Format: SYMBOL + YYMMDD + C/P + STRIKE (8 digits, padded with zeros)
  const optionStr = option.option;
  const callPut = optionStr.slice(-9, -8) as "C" | "P";
  const expirationStr = optionStr.slice(-15, -9); // YYMMDD
  const strikeStr = optionStr.slice(-8); // Strike (8 digits)
  
  const year = 2000 + parseInt(expirationStr.slice(0, 2));
  const month = parseInt(expirationStr.slice(2, 4));
  const day = parseInt(expirationStr.slice(4, 6));
  const expirationDate = new Date(year, month - 1, day).toISOString().split("T")[0];
  const strike = parseInt(strikeStr) / 1000; // Convert from format where 00016000 = 16.00

  return { strike, callPut, expirationDate };
}

export function processCBOEData(data: CBOEData): ProcessedGexData {
  const underlierPrice = data.data.current_price;
  const symbol = data.symbol;
  const timestamp = data.timestamp;

  // Group options by expiration date and strike
  const strikeMapByExp = new Map<string, Map<number, GexDataPoint>>();

  data.data.options.forEach((option) => {
    try {
      const { strike, callPut, expirationDate } = parseCBOEOption(option);

      // Initialize maps for this expiration if needed
      if (!strikeMapByExp.has(expirationDate)) {
        strikeMapByExp.set(expirationDate, new Map());
      }

      const strikeMap = strikeMapByExp.get(expirationDate)!;

      if (!strikeMap.has(strike)) {
        strikeMap.set(strike, {
          strike,
          gammaExposure: 0,
          underlying: underlierPrice,
          callGEX: 0,
          putGEX: 0,
          callOpenInt: 0,
          putOpenInt: 0,
          callGamma: 0,
          putGamma: 0,
          callIV: 0,
          putIV: 0,
          expirationDate,
        });
      }

      const dataPoint = strikeMap.get(strike)!;

      if (callPut === "C") {
        dataPoint.callOpenInt = option.open_interest;
        dataPoint.callGamma = option.gamma;
        dataPoint.callIV = option.iv;
        // Gamma Exposure = gamma * open_interest * 100 * spot_price * spot_price * 0.01
        dataPoint.callGEX = option.gamma * option.open_interest * 100 * underlierPrice * underlierPrice * 0.01;
      } else {
        dataPoint.putOpenInt = option.open_interest;
        dataPoint.putGamma = option.gamma;
        dataPoint.putIV = option.iv;
        // Puts are negative
        dataPoint.putGEX = option.gamma * option.open_interest * 100 * underlierPrice * underlierPrice * 0.01 * -1;
      }

      dataPoint.gammaExposure = (dataPoint.callGEX || 0) + (dataPoint.putGEX || 0);
    } catch (e) {
      console.warn("Failed to parse option:", option, e);
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

  // Calculate total gamma (sum of all call and put GEX)
  const totalGamma = allDataPoints.reduce((sum, point) => {
    return sum + ((point.callGEX || 0) + (point.putGEX || 0));
  }, 0) / 1e9; // Convert to billions

  return {
    date: timestamp,
    symbol,
    dataPoints: allDataPoints,
    underlierPrice,
    expirationDates,
    dataPointsByExpiration,
    fileFormat: "cboe",
    totalGamma,
  };
}

// ===== Main Processing Function =====

// ===== Main Processing Function =====
export function processOptionsData(data: Option[] | CBOEData): ProcessedGexData {
  if (isLegacyFormat(data)) {
    return processLegacyOptions(data as Option[]);
  } else if (isCBOEFormat(data)) {
    return processCBOEData(data as CBOEData);
  } else {
    throw new Error("Unable to process data: unrecognized format");
  }
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

export function findGammaFlips(profile: Array<{ spot: number; totalGamma: number }>): number[] {
  // Find where gamma exposure changes sign in the profile
  // Returns array with single flip point if it exists
  const flips: number[] = [];

  for (let i = 0; i < profile.length - 1; i++) {
    const current = profile[i].totalGamma;
    const next = profile[i + 1].totalGamma;

    // Check if sign changes
    if ((current < 0 && next > 0) || (current > 0 && next < 0)) {
      flips.push(profile[i].spot);
    }
  }

  return flips;
}

// ===== Business Days Calculation =====
export function countBusinessDays(from: Date, to: Date): number {
  let count = 0;
  const current = new Date(from);
  
  while (current <= to) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) { // Not weekend
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  
  return count;
}

// ===== Helper: Check if date is third Friday of month =====
function isThirdFriday(dateStr: string): boolean {
  const d = new Date(dateStr + "T00:00:00");
  return d.getDay() === 5 && d.getDate() >= 15 && d.getDate() <= 21;
}

// ===== Gamma Profile Calculation (for Chart 4) =====
export function calculateGammaProfile(
  dataPoints: GexDataPoint[],
  strikeRange: { min: number; max: number },
  numLevels: number = 30
): Array<{
  spot: number;
  totalGamma: number;
  exNextGamma: number;
  exMonthlyGamma: number;
}> {
  const levels = Array.from({ length: numLevels }, (_, i) => {
    return strikeRange.min + ((strikeRange.max - strikeRange.min) / (numLevels - 1)) * i;
  });

  // Find next expiry and next monthly expiry
  const expirationDates = Array.from(new Set(dataPoints.map(p => p.expirationDate).filter(Boolean) as string[])).sort();
  const nextExpiry = expirationDates[0];
  const thirdFridays = expirationDates.filter(d => isThirdFriday(d));
  const nextMonthlyExp = thirdFridays[0];

  const profile = levels.map((spotLevel) => {
    let totalCallGamma = 0;
    let totalPutGamma = 0;
    let totalCallGammaExNext = 0;
    let totalPutGammaExNext = 0;
    let totalCallGammaExMonthly = 0;
    let totalPutGammaExMonthly = 0;

    const today = new Date();

    dataPoints.forEach((point) => {
      // Calculate days to expiration
      const expDate = point.expirationDate ? new Date(point.expirationDate + "T00:00:00") : today;
      const daysToExp = Math.max(1, countBusinessDays(today, expDate)) / 252; // Business days / trading days in year

      // Calculate gamma exposure at this spot level
      if (point.callOpenInt && point.callIV && point.callIV > 0) {
        const callGex = calcGammaEx(
          spotLevel,
          point.strike,
          point.callIV,
          daysToExp,
          0,
          0,
          "call",
          point.callOpenInt
        );
        totalCallGamma += callGex;
        
        // Ex-next expiry
        if (point.expirationDate !== nextExpiry) {
          totalCallGammaExNext += callGex;
        }
        
        // Ex-next monthly expiry
        if (point.expirationDate !== nextMonthlyExp) {
          totalCallGammaExMonthly += callGex;
        }
      }

      if (point.putOpenInt && point.putIV && point.putIV > 0) {
        const putGex = calcGammaEx(
          spotLevel,
          point.strike,
          point.putIV,
          daysToExp,
          0,
          0,
          "put",
          point.putOpenInt
        );
        totalPutGamma -= putGex; // Puts are negative
        
        // Ex-next expiry
        if (point.expirationDate !== nextExpiry) {
          totalPutGammaExNext -= putGex;
        }
        
        // Ex-next monthly expiry
        if (point.expirationDate !== nextMonthlyExp) {
          totalPutGammaExMonthly -= putGex;
        }
      }
    });

    return {
      spot: spotLevel,
      totalGamma: totalCallGamma + totalPutGamma,
      exNextGamma: totalCallGammaExNext + totalPutGammaExNext,
      exMonthlyGamma: totalCallGammaExMonthly + totalPutGammaExMonthly,
    };
  });

  return profile;
}

// ===== Find Gamma Flip Point (with linear interpolation) =====
export function findGammaFlipPoint(profile: Array<{ spot: number; totalGamma: number }>): number | null {
  for (let i = 0; i < profile.length - 1; i++) {
    const current = profile[i].totalGamma;
    const next = profile[i + 1].totalGamma;

    // Check if sign changes
    if ((current < 0 && next > 0) || (current > 0 && next < 0)) {
      // Linear interpolation to find the exact flip point
      // Formula: zeroGamma = posStrike - ((posStrike - negStrike) * posGamma / (posGamma - negGamma))
      const negStrike = profile[i].spot;
      const posStrike = profile[i + 1].spot;
      const negGamma = current;
      const posGamma = next;
      
      const flipPoint = posStrike - ((posStrike - negStrike) * posGamma / (posGamma - negGamma));
      return flipPoint;
    }
  }

  return null;
}
