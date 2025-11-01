"use client";

import React, { useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";
import {
  parseOptionsFile,
  processOptionsData,
  filterGexData,
  findGammaFlips,
} from "./utils";
import { ProcessedGexData } from "./types";

interface ChartDataPoint {
  strike: number;
  gammaExposure: number;
  color: string;
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
        const options = parseOptionsFile(content);
        const processed = processOptionsData(options);

        setGexData(processed);
        setUnderlierPrice(processed.underlierPrice);
        // Initialize with all available expiration dates
        setSelectedDates(processed.expirationDates);

        // Set default strike range as 0.8-1.2 of underlying
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
    return filteredData.map((point) => ({
      strike: point.strike,
      gammaExposure: point.gammaExposure,
      color: getBarColor(point.gammaExposure),
    }));
  }, [filteredData]);

  const closestStrikeToUnderlying = useMemo(() => {
    if (chartData.length === 0) return null;
    return chartData.reduce((closest, current) => {
      const currentDiff = Math.abs(current.strike - underlierPrice);
      const closestDiff = Math.abs(closest.strike - underlierPrice);
      return currentDiff < closestDiff ? current : closest;
    }).strike;
  }, [chartData, underlierPrice]);

  const gammaFlips = useMemo(() => {
    return findGammaFlips(filteredData);
  }, [filteredData]);

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">
          Gamma Exposure Analysis
        </h1>

        {/* File Upload Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Upload Options JSON File
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
                <strong>Underlying Price:</strong> ${underlierPrice.toFixed(2)} |{" "}
                <strong>Trade Date:</strong> {gexData.date} |{" "}
                <strong>Total Strikes:</strong> {gexData.dataPoints.length}
              </p>
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

            {/* Chart Section */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Gamma Exposure by Strike
              </h2>
              {filteredData.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart
                    data={chartData}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      type="number"
                      label={{
                        value: "Gamma Exposure",
                        position: "insideBottomRight",
                        offset: -5,
                      }}
                    />
                    <YAxis
                      dataKey="strike"
                      type="category"
                      label={{
                        value: "Strike Price ($)",
                        angle: -90,
                        position: "insideLeft",
                      }}
                    />
                    {closestStrikeToUnderlying !== null && (
                      <ReferenceLine
                        y={closestStrikeToUnderlying}
                        stroke="#3b82f6"
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        label={{
                          value: `Underlying: $${underlierPrice.toFixed(2)}`,
                          position: "top",
                          fill: "#3b82f6",
                          fontSize: 12,
                          fontWeight: "bold",
                          offset: 10,
                        }}
                      />
                    )}
                    {gammaFlips.map((flipStrike) => (
                      <ReferenceLine
                        key={`flip-${flipStrike}`}
                        y={flipStrike}
                        stroke="#f59e0b"
                        strokeWidth={1.5}
                        strokeDasharray="3 3"
                      />
                    ))}
                    <Tooltip
                      formatter={(value) =>
                        typeof value === "number"
                          ? value.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })
                          : value
                      }
                      labelFormatter={(label) => `Strike: $${label}`}
                    />
                    <Bar
                      dataKey="gammaExposure"
                      radius={[0, 8, 8, 0]}
                      isAnimationActive={false}
                    >
                      {chartData.map((entry: ChartDataPoint, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-gray-500 text-center py-8">
                  No data available for the selected filters
                </p>
              )}
              <div className="mt-4 flex items-center gap-6 text-sm flex-wrap">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded"></div>
                  <span>Positive Gamma Exposure</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded"></div>
                  <span>Negative Gamma Exposure</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-blue-600 font-semibold">Underlying: ${underlierPrice.toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-1 bg-amber-500"></div>
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

            {/* Data Table Section */}
            <div className="bg-white rounded-lg shadow-md p-6 mt-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Detailed Data
              </h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Strike
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Open Interest
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Gamma
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Gamma Exposure
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredData.map((point, idx: number) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          ${point.strike}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {point.right === "C" ? "Call" : "Put"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {point.openInterest?.toLocaleString() ?? "N/A"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {point.gamma != null ? point.gamma.toExponential(2) : "N/A"}
                        </td>
                        <td
                          className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${
                            point.gammaExposure >= 0
                              ? "text-green-600"
                              : "text-red-600"
                          }`}
                        >
                          {point.gammaExposure.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
