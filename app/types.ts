export interface OptionContract {
  symbol: string;
  secType: string;
  lastTradeDateOrContractMonth: string;
  lastTradeDate: string;
  strike: number;
  right: "C" | "P";
  exchange: string;
  currency: string;
  localSymbol: string;
  tradingClass: string;
  conId: number;
  multiplier: number;
  primaryExch: string;
}

export interface OptionData {
  iv: number;
  delta: number;
  price: number;
  pvDividend: number;
  gamma: number;
  vega: number;
  theta: number;
  undPrice: number;
  openInterest: number;
}

export interface Option {
  contract: OptionContract;
  data: OptionData;
}

export interface GexDataPoint {
  strike: number;
  gammaExposure: number;
  underlying: number;
  right: "C" | "P";
  openInterest: number;
  multiplier: number;
  gamma: number;
}

export interface ProcessedGexData {
  date: string;
  dataPoints: GexDataPoint[];
  underlierPrice: number;
  expirationDates: string[];
  dataPointsByExpiration: Map<string, GexDataPoint[]>;
}
