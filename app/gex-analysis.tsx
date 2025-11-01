"use client";

import React, { useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
  Legend,
  ComposedChart,
} from "recharts";
import {
  parseOptionsFile,
  processOptionsData,
  filterGexData,
  findGammaFlips,
  calculateGammaProfile,
  findGammaFlipPoint,
} from "./utils";
import { ProcessedGexData } from "./types";

interface ChartDataPoint {
  strike: number;
  gammaExposure: number;
  color: string;
}

interface OIChartPoint {
  strike: number;
  callOI: number;
  putOI: number;
}

interface GammaChartPoint {
  strike: number;
  callGamma: number;
  putGamma: number;
}

export default function GexAnalysis() {
  const [gexData, setGexData] = useState<ProcessedGexData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [strikeRangeMin, setStrikeRangeMin] = useState<number>(0);
  const [strikeRangeMax, setStrikeRangeMax] = useState<number>(10000);
  const [underlierPrice, setUnderlierPrice] = useState<number>(0);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = parseOptionsFile(content);
        const processed = processOptionsData(parsed);

        setGexData(processed);
        setUnderlierPrice(processed.underlierPrice);
        setSelectedDates(processed.expirationDates);

        const minDefault = Math.floor(processed.underlierPrice * 0.8);
        const maxDefault = Math.ceil(processed.underlierPrice * 1.2);
        setStrikeRangeMin(minDefault);
        setStrikeRangeMax(maxDefault);

        setError(null);
      } catch (err) {
        setError(
          `Error processing file: ${err instanceof Error ? err.message : "Unknown error"}`
        );
      }
    };
    reader.readAsText(file);
  };

  const getBarColor = (value: number) => {
    return value >= 0 ? "#10b981" : "#ef4444"; // Green for positive, red for negative
  };

  const filteredData = useMemo(() => {
    if (!gexData) return [];
    return filterGexData(
      gexData,
      selectedDates,
      strikeRangeMin,
      strikeRangeMax
    );
  }, [gexData, selectedDates, strikeRangeMin, strikeRangeMax]);

  const chartData: ChartDataPoint[] = useMemo(() => {
    const data = filteredData.map((point) => ({
      strike: point.strike,
      gammaExposure: point.gammaExposure / 1e9,
      color: getBarColor(point.gammaExposure),
    }));
    // Sort in descending order by strike for vertical axis
    return data.sort((a, b) => b.strike - a.strike);
  }, [filteredData]);

  const oiChartData: OIChartPoint[] = useMemo(() => {
    const data = filteredData.map((point) => ({
      strike: point.strike,
      callOI: point.callOpenInt || 0,
      putOI: -(point.putOpenInt || 0),
    }));
    // Sort in descending order by strike for vertical axis
    return data.sort((a, b) => b.strike - a.strike);
  }, [filteredData]);

  const gammaChartData: GammaChartPoint[] = useMemo(() => {
    const data = filteredData.map((point) => ({
      strike: point.strike,
      callGamma: (point.callGEX || 0) / 1e9,
      putGamma: (point.putGEX || 0) / 1e9,
    }));
    // Sort in descending order by strike for vertical axis
    return data.sort((a, b) => b.strike - a.strike);
  }, [filteredData]);

  const gammaProfile = useMemo(() => {
    if (!gexData) return [];
    // Use all data points for gamma profile, not filtered data
    const allDataPoints = gexData.dataPoints;
    return calculateGammaProfile(allDataPoints, {
      min: strikeRangeMin,
      max: strikeRangeMax,
    });
  }, [gexData, strikeRangeMin, strikeRangeMax]);

  const gammaFlipPoint = useMemo(() => {
    if (gammaProfile.length === 0) return null;
    return findGammaFlipPoint(gammaProfile);
  }, [gammaProfile]);

  const gammaFlips = useMemo(() => {
    if (gammaProfile.length === 0) return [];
    const flips = findGammaFlips(gammaProfile);
    return flips.length > 0 ? [flips[0]] : []; // Only return the first flip
  }, [gammaProfile]);

  const totalGamma = useMemo(() => {
    return filteredData.reduce((sum, point) => sum + point.gammaExposure, 0) / 1e9;
  }, [filteredData]);

  // Find the closest strike to the underlying price for reference line
  const closestStrike = useMemo(() => {
    if (filteredData.length === 0) return null;
    return filteredData.reduce((closest, point) => {
      const distance = Math.abs(point.strike - underlierPrice);
      const closestDistance = Math.abs(closest.strike - underlierPrice);
      return distance < closestDistance ? point : closest;
    }).strike;
  }, [filteredData, underlierPrice]);

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">
          Gamma Exposure Analysis
        </h1>

        {/* File Upload Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Upload Options JSON File (CBOE or Legacy Format)
          </label>
          <input
            type="file"
            accept=".json"
            onChange={handleFileUpload}
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-md file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100
              cursor-pointer"
          />
          {error && (
            <p className="mt-2 text-sm text-red-600">
              {error}
            </p>
          )}
        </div>

        {gexData && (
          <>
            {/* Info Section */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
              <p className="text-sm text-blue-800">
                <strong>Symbol:</strong> {gexData.symbol} | <strong>Price:</strong> ${underlierPrice.toFixed(2)} | <strong>Date:</strong> {gexData.date} | <strong>Format:</strong> {gexData.fileFormat}
              </p>
              {gexData.totalGamma !== undefined && (
                <p className="text-sm text-blue-800 mt-2">
                  <strong>Total Gamma:</strong> ${gexData.totalGamma.toFixed(2)} Bn per 1% move
                </p>
              )}
            </div>

            {/* Filters Section */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Filters</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Expiration Date Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Expiration Dates
                  </label>
                  <select
                    multiple
                    value={selectedDates}
                    onChange={(e) => {
                      const options = Array.from(e.target.options);
                      setSelectedDates(
                        options
                          .filter((option) => option.selected)
                          .map((option) => option.value)
                      );
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
                    size={Math.min(gexData.expirationDates.length, 5)}
                  >
                    {gexData.expirationDates.map((date) => (
                      <option key={date} value={date}>
                        {date}
                      </option>
                    ))}
                  </select>
                  <p className="mt-2 text-xs text-gray-500">
                    Hold Ctrl (Cmd on Mac) to select multiple dates
                  </p>
                </div>

                {/* Strike Range Filters */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Minimum Strike: ${strikeRangeMin}
                  </label>
                  <input
                    type="range"
                    min={Math.min(...gexData.dataPoints.map((p) => p.strike))}
                    max={strikeRangeMax}
                    value={strikeRangeMin}
                    onChange={(e) =>
                      setStrikeRangeMin(Math.max(0, parseInt(e.target.value)))
                    }
                    className="w-full"
                  />
                  <input
                    type="number"
                    value={strikeRangeMin}
                    onChange={(e) =>
                      setStrikeRangeMin(Math.max(0, parseInt(e.target.value) || 0))
                    }
                    className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Maximum Strike: ${strikeRangeMax}
                  </label>
                  <input
                    type="range"
                    min={strikeRangeMin}
                    max={Math.max(...gexData.dataPoints.map((p) => p.strike))}
                    value={strikeRangeMax}
                    onChange={(e) =>
                      setStrikeRangeMax(
                        Math.min(10000, parseInt(e.target.value))
                      )
                    }
                    className="w-full"
                  />
                  <input
                    type="number"
                    value={strikeRangeMax}
                    onChange={(e) =>
                      setStrikeRangeMax(
                        Math.min(10000, parseInt(e.target.value) || 10000)
                      )
                    }
                    className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>

                {/* Quick Range Buttons */}
                <div className="col-span-1 md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Quick Ranges
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => {
                        const min = Math.floor(underlierPrice * 0.8);
                        const max = Math.ceil(underlierPrice * 1.2);
                        setStrikeRangeMin(min);
                        setStrikeRangeMax(max);
                      }}
                      className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                    >
                      ±20%
                    </button>
                    <button
                      onClick={() => {
                        const min = Math.floor(underlierPrice * 0.9);
                        const max = Math.ceil(underlierPrice * 1.1);
                        setStrikeRangeMin(min);
                        setStrikeRangeMax(max);
                      }}
                      className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                    >
                      ±10%
                    </button>
                    <button
                      onClick={() => {
                        const min = Math.floor(underlierPrice * 0.95);
                        const max = Math.ceil(underlierPrice * 1.05);
                        setStrikeRangeMin(min);
                        setStrikeRangeMax(max);
                      }}
                      className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                    >
                      ±5%
                    </button>
                    <button
                      onClick={() => {
                        const min = Math.floor(
                          Math.min(...gexData.dataPoints.map((p) => p.strike))
                        );
                        const max = Math.ceil(
                          Math.max(...gexData.dataPoints.map((p) => p.strike))
                        );
                        setStrikeRangeMin(min);
                        setStrikeRangeMax(max);
                      }}
                      className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
                    >
                      All Strikes
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Chart 1: Gamma by Strike */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Chart 1: Total Gamma Exposure by Strike
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                Gamma: ${totalGamma.toFixed(2)} Bn per 1% {gexData.symbol} Move
              </p>
              {filteredData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 60, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" label={{ value: "Gamma ($ Bn/1%)", position: "insideBottomRight", offset: -5 }} />
                    <YAxis type="category" dataKey="strike" label={{ value: "Strike ($)", angle: -90, position: "insideLeft" }} />
                    {closestStrike && (
                      <ReferenceLine 
                        y={closestStrike} 
                        stroke="#3b82f6" 
                        strokeDasharray="5 5" 
                        strokeWidth={2}
                        label={{ value: `Spot: $${underlierPrice.toFixed(2)}`, position: "right" as const, fill: "#3b82f6", fontSize: 11 }} 
                      />
                    )}
                    <Tooltip formatter={(v) => typeof v === "number" ? v.toFixed(2) : v} />
                    <Bar dataKey="gammaExposure" radius={[0, 8, 8, 0]} isAnimationActive={false}>
                      {chartData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-gray-500 text-center py-8">No data available</p>
              )}
            </div>

            {/* Chart 2: Open Interest */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Chart 2: Open Interest by Calls and Puts
              </h2>
              {oiChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={oiChartData} layout="vertical" margin={{ top: 5, right: 30, left: 60, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" label={{ value: "Open Interest", position: "insideBottomRight", offset: -5 }} />
                    <YAxis type="category" dataKey="strike" label={{ value: "Strike ($)", angle: -90, position: "insideLeft" }} />
                    {closestStrike && (
                      <ReferenceLine 
                        y={closestStrike} 
                        stroke="#3b82f6" 
                        strokeDasharray="5 5" 
                        strokeWidth={2}
                        label={{ value: `Spot: $${underlierPrice.toFixed(2)}`, position: "right" as const, fill: "#3b82f6", fontSize: 11 }} 
                      />
                    )}
                    <Tooltip formatter={(v) => Math.abs(v as number).toLocaleString()} />
                    <Bar dataKey="callOI" fill="#10b981" name="Call OI" />
                    <Bar dataKey="putOI" fill="#ef4444" name="Put OI" />
                    <Legend />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-gray-500 text-center py-8">No data available</p>
              )}
            </div>

            {/* Chart 3: Call vs Put Gamma */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Chart 3: Gamma Exposure by Calls and Puts
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                Gamma: ${totalGamma.toFixed(2)} Bn per 1% {gexData.symbol} Move
              </p>
              {gammaChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={gammaChartData} layout="vertical" margin={{ top: 5, right: 30, left: 60, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" label={{ value: "Gamma ($ Bn/1%)", position: "insideBottomRight", offset: -5 }} />
                    <YAxis type="category" dataKey="strike" label={{ value: "Strike ($)", angle: -90, position: "insideLeft" }} />
                    {closestStrike && (
                      <ReferenceLine 
                        y={closestStrike} 
                        stroke="#3b82f6" 
                        strokeDasharray="5 5" 
                        strokeWidth={2}
                        label={{ value: `Spot: $${underlierPrice.toFixed(2)}`, position: "right" as const, fill: "#3b82f6", fontSize: 11 }} 
                      />
                    )}
                    <Tooltip formatter={(v) => typeof v === "number" ? v.toFixed(2) : v} />
                    <Bar dataKey="callGamma" fill="#10b981" name="Call Gamma" />
                    <Bar dataKey="putGamma" fill="#ef4444" name="Put Gamma" />
                    <Legend />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-gray-500 text-center py-8">No data available</p>
              )}
            </div>

            {/* Chart 4: Gamma Profile */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Chart 4: Gamma Exposure Profile
              </h2>
              {gammaProfile.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={gammaProfile} margin={{ top: 20, right: 30, left: 60, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="spot" 
                      type="number"
                      label={{ value: "Price ($)", position: "insideBottomRight", offset: -5 }} 
                    />
                    <YAxis label={{ value: "Gamma ($ Bn/1%)", angle: -90, position: "insideLeft" }} />
                    <Line type="monotone" dataKey="totalGamma" stroke="#06b6d4" strokeWidth={2.5} name="All Expiries" isAnimationActive={false} dot={false} />
                    <Line type="monotone" dataKey="exNextGamma" stroke="#8b5cf6" strokeWidth={2} name="Ex-Next Expiry" isAnimationActive={false} dot={false} />
                    <Line type="monotone" dataKey="exMonthlyGamma" stroke="#f59e0b" strokeWidth={2} name="Ex-Next Monthly" isAnimationActive={false} dot={false} />
                    <ReferenceLine y={0} stroke="#6b7280" strokeWidth={1} />
                    <ReferenceLine 
                      x={underlierPrice} 
                      stroke="#3b82f6" 
                      strokeDasharray="5 5" 
                      strokeWidth={3}
                      label={{ value: `Spot: $${underlierPrice.toFixed(2)}`, position: "top" as const, fill: "#3b82f6", fontSize: 12, offset: 5 }} 
                    />
                    {gammaFlipPoint && (
                      <ReferenceLine 
                        x={gammaFlipPoint} 
                        stroke="#22c55e" 
                        strokeWidth={3}
                        label={{ value: `Flip: $${gammaFlipPoint.toFixed(0)}`, position: "top" as const, fill: "#22c55e", fontSize: 12, offset: 5 }} 
                      />
                    )}
                    <Tooltip formatter={(v) => typeof v === "number" ? v.toFixed(2) : v} />
                    <Legend />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-gray-500 text-center py-8">No data available</p>
              )}
            </div>

            {/* Legend */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Legend</h2>
              <div className="flex flex-wrap gap-6">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded"></div>
                  <span>Positive Gamma (Long)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded"></div>
                  <span>Negative Gamma (Short)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-0.5 h-4 bg-blue-500"></div>
                  <span>Spot Price</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-0.5 h-4 bg-green-500"></div>
                  <span>Gamma Flip</span>
                </div>
              </div>
            </div>

            {/* Gamma Flip Section */}
            {gammaFlips.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mt-8">
                <h3 className="text-lg font-semibold text-amber-900 mb-2">
                  Gamma Flips
                </h3>
                <p className="text-sm text-amber-800 mb-3">
                  Gamma exposure changes sign at the following strike prices:
                </p>
                <div className="flex flex-wrap gap-2">
                  {gammaFlips.map((strike) => (
                    <div
                      key={`flip-badge-${strike}`}
                      className="bg-amber-500 text-white px-3 py-1 rounded-full text-sm font-semibold"
                    >
                      ${strike}
                    </div>
                  ))}
                </div>
              </div>
            )}


          </>
        )}
      </div>
    </div>
  );
}
