// ===== Legacy Format (IB-style) =====
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

// ===== CBOE Format =====
export interface CBOEOptionData {
  option: string; // e.g. "CMG251031C00016000"
  bid: number;
  bid_size: number;
  ask: number;
  ask_size: number;
  iv: number;
  open_interest: number;
  volume: number;
  delta: number;
  gamma: number;
  vega: number;
  theta: number;
  rho: number;
  theo: number;
  change: number;
  open: number;
  high: number;
  low: number;
  tick: string;
  last_trade_price: number;
  last_trade_time: string | null;
  percent_change: number;
  prev_day_close: number;
}

export interface CBOEData {
  timestamp: string;
  data: {
    options: CBOEOptionData[];
    symbol: string;
    security_type: string;
    exchange_id: number;
    current_price: number;
    price_change: number;
    price_change_percent: number;
    bid: number;
    ask: number;
    bid_size: number;
    ask_size: number;
    open: number;
    high: number;
    low: number;
    close: number;
    prev_day_close: number;
    volume: number;
    iv30: number;
    iv30_change: number;
    iv30_change_percent: number;
    seqno: number;
    last_trade_time: string;
    tick: string;
  };
  symbol: string;
}

// ===== Normalized Data Structure =====
export interface GexDataPoint {
  strike: number;
  gammaExposure: number;
  callGamma?: number;
  putGamma?: number;
  callGEX?: number;
  putGEX?: number;
  callOpenInt?: number;
  putOpenInt?: number;
  callIV?: number;
  putIV?: number;
  underlying: number;
  right?: "C" | "P";
  openInterest?: number;
  multiplier?: number;
  gamma?: number;
  expirationDate?: string;
}

export interface ProcessedGexData {
  date: string;
  symbol: string;
  dataPoints: GexDataPoint[];
  underlierPrice: number;
  expirationDates: string[];
  dataPointsByExpiration: Map<string, GexDataPoint[]>;
  fileFormat: "cboe" | "legacy";
  totalGamma?: number; // Total gamma in billions for CBOE format
}
