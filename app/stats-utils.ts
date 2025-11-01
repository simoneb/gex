// Normal distribution utilities for Black-Scholes calculations
// Implementation of cumulative distribution function and probability density function

/**
 * Calculates the cumulative standard normal distribution (Φ)
 * Uses the Abramowitz and Stegun approximation
 */
function normCDF(x: number): number {
  // Constants for the approximation
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  // Save the sign of x
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);

  // Abramowitz and Stegun approximation
  const t = 1.0 / (1.0 + p * x);
  const t2 = t * t;
  const t3 = t2 * t;
  const t4 = t3 * t;
  const t5 = t4 * t;

  const y = 1.0 - (a5 * t5 + a4 * t4 + a3 * t3 + a2 * t2 + a1 * t) * Math.exp(-x * x);

  return 0.5 * (1.0 + sign * y);
}

/**
 * Calculates the probability density function (PDF) of the standard normal distribution
 */
function pdf(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

export const norm = {
  cdf: normCDF,
  pdf: pdf,
};
