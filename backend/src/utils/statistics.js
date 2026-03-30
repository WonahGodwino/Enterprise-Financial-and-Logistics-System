/**
 * Generate KPI trends from time series data
 */
export function generateKPITrends(data, metricKey) {
  if (!data || data.length === 0) return [];

  const trends = [];
  
  for (let i = 1; i < data.length; i++) {
    const current = data[i];
    const previous = data[i - 1];
    
    const currentValue = current[metricKey] || 0;
    const previousValue = previous[metricKey] || 0;
    
    const change = currentValue - previousValue;
    const percentChange = previousValue !== 0 
      ? (change / previousValue) * 100 
      : 0;

    trends.push({
      period: current.weekStartDate || current.period,
      value: currentValue,
      previousValue,
      change,
      percentChange: percentChange.toFixed(2),
      direction: change > 0 ? 'up' : change < 0 ? 'down' : 'stable',
      color: change > 0 ? 'green' : change < 0 ? 'red' : 'yellow'
    });
  }

  return trends;
}

/**
 * Calculate correlation between two datasets
 */
export function calculateCorrelation(dataset1, dataset2) {
  if (dataset1.length !== dataset2.length || dataset1.length === 0) {
    return 0;
  }

  const n = dataset1.length;
  
  // Calculate means
  const mean1 = dataset1.reduce((a, b) => a + b, 0) / n;
  const mean2 = dataset2.reduce((a, b) => a + b, 0) / n;

  // Calculate covariance and standard deviations
  let covariance = 0;
  let variance1 = 0;
  let variance2 = 0;

  for (let i = 0; i < n; i++) {
    const diff1 = dataset1[i] - mean1;
    const diff2 = dataset2[i] - mean2;
    
    covariance += diff1 * diff2;
    variance1 += diff1 * diff1;
    variance2 += diff2 * diff2;
  }

  if (variance1 === 0 || variance2 === 0) return 0;

  return covariance / Math.sqrt(variance1 * variance2);
}

/**
 * Calculate moving average
 */
export function movingAverage(data, windowSize = 3) {
  const result = [];
  
  for (let i = 0; i < data.length; i++) {
    const start = Math.max(0, i - windowSize + 1);
    const window = data.slice(start, i + 1);
    const average = window.reduce((a, b) => a + b, 0) / window.length;
    result.push(average);
  }

  return result;
}

/**
 * Detect outliers using IQR method
 */
export function detectOutliers(data) {
  const sorted = [...data].sort((a, b) => a - b);
  
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;
  
  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;

  return data.map(value => ({
    value,
    isOutlier: value < lowerBound || value > upperBound
  }));
}

/**
 * Calculate percentile
 */
export function percentile(data, p) {
  const sorted = [...data].sort((a, b) => a - b);
  const index = (p / 100) * (sorted.length - 1);
  
  if (Math.floor(index) === index) {
    return sorted[index];
  }
  
  const lower = sorted[Math.floor(index)];
  const upper = sorted[Math.ceil(index)];
  const fraction = index - Math.floor(index);
  
  return lower + (upper - lower) * fraction;
}

/**
 * Calculate performance distribution
 */
export function performanceDistribution(scores, bins = [0, 40, 60, 75, 90, 100]) {
  const distribution = {};
  
  for (let i = 0; i < bins.length - 1; i++) {
    const binName = `${bins[i]}-${bins[i + 1]}`;
    distribution[binName] = scores.filter(
      s => s >= bins[i] && s < bins[i + 1]
    ).length;
  }
  
  // Add the top bin
  distribution[`${bins[bins.length - 1]}+`] = scores.filter(
    s => s >= bins[bins.length - 1]
  ).length;

  return distribution;
}