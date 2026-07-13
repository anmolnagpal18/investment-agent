/**
 * Formats a raw number as currency (USD).
 */
export const formatCurrency = (value) => {
  if (value === null || value === undefined || isNaN(value)) return '$0';
  
  const absValue = Math.abs(value);
  if (absValue >= 1.0e12) {
    return `${value < 0 ? '-' : ''}$${(absValue / 1.0e12).toFixed(2)}T`;
  }
  if (absValue >= 1.0e9) {
    return `${value < 0 ? '-' : ''}$${(absValue / 1.0e9).toFixed(2)}B`;
  }
  if (absValue >= 1.0e6) {
    return `${value < 0 ? '-' : ''}$${(absValue / 1.0e6).toFixed(2)}M`;
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2
  }).format(value);
};

/**
 * Formats a percentage.
 */
export const formatPercentage = (value) => {
  if (value === null || value === undefined || isNaN(value)) return '0.00%';
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
};

/**
 * Formats a standard ratio multiple (e.g. 15.4x).
 */
export const formatMultiple = (value) => {
  if (value === null || value === undefined || isNaN(value)) return '-';
  return `${value.toFixed(2)}x`;
};
