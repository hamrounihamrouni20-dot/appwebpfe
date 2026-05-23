import type { PvData } from './database.types';

export interface DailyEnergyPoint {
  date: string;
  energy_kwh: number;
  avg_temp?: number;
  avg_irr?: number;
}

export interface ForecastPoint {
  date: string;
  predicted_kwh: number;
  lower: number;
  upper: number;
  confidence_pct: number;
}

// Simple Decision Tree Regressor for client-side JS
interface DecisionTreeNode {
  feature?: string;
  threshold?: number;
  value?: number;
  left?: DecisionTreeNode;
  right?: DecisionTreeNode;
}

class DecisionTreeRegressor {
  maxDepth: number;
  minSamplesSplit: number;
  root: DecisionTreeNode | null = null;

  constructor(maxDepth = 4, minSamplesSplit = 2) {
    this.maxDepth = maxDepth;
    this.minSamplesSplit = minSamplesSplit;
  }

  fit(X: Record<string, number>[], y: number[]) {
    this.root = this.buildTree(X, y, 0);
  }

  private buildTree(X: Record<string, number>[], y: number[], depth: number): DecisionTreeNode {
    const numSamples = X.length;

    // Base cases
    if (depth >= this.maxDepth || numSamples < this.minSamplesSplit || y.every(val => val === y[0])) {
      const mean = y.reduce((sum, val) => sum + val, 0) / (numSamples || 1);
      return { value: mean };
    }

    let bestFeature = '';
    let bestThreshold = 0;
    let bestVarianceReduction = -1;
    let bestLeftIdx: number[] = [];
    let bestRightIdx: number[] = [];

    const currentVariance = this.calculateVariance(y);
    const features = X.length > 0 ? Object.keys(X[0]) : [];

    for (const feature of features) {
      const values = X.map(x => x[feature]);
      const uniqueValues = Array.from(new Set(values)).sort((a, b) => a - b);

      for (let i = 0; i < uniqueValues.length - 1; i++) {
        const threshold = (uniqueValues[i] + uniqueValues[i + 1]) / 2;
        const leftIdx: number[] = [];
        const rightIdx: number[] = [];

        for (let j = 0; j < numSamples; j++) {
          if (X[j][feature] <= threshold) {
            leftIdx.push(j);
          } else {
            rightIdx.push(j);
          }
        }

        if (leftIdx.length === 0 || rightIdx.length === 0) continue;

        const leftY = leftIdx.map(idx => y[idx]);
        const rightY = rightIdx.map(idx => y[idx]);
        const leftVar = this.calculateVariance(leftY);
        const rightVar = this.calculateVariance(rightY);

        const varianceReduction = currentVariance - (leftY.length / numSamples * leftVar + rightY.length / numSamples * rightVar);

        if (varianceReduction > bestVarianceReduction) {
          bestVarianceReduction = varianceReduction;
          bestFeature = feature;
          bestThreshold = threshold;
          bestLeftIdx = leftIdx;
          bestRightIdx = rightIdx;
        }
      }
    }

    if (bestVarianceReduction <= 0 || bestLeftIdx.length === 0) {
      const mean = y.reduce((sum, val) => sum + val, 0) / (numSamples || 1);
      return { value: mean };
    }

    const leftNode = this.buildTree(bestLeftIdx.map(idx => X[idx]), bestLeftIdx.map(idx => y[idx]), depth + 1);
    const rightNode = this.buildTree(bestRightIdx.map(idx => X[idx]), bestRightIdx.map(idx => y[idx]), depth + 1);

    return {
      feature: bestFeature,
      threshold: bestThreshold,
      left: leftNode,
      right: rightNode,
    };
  }

  private calculateVariance(y: number[]) {
    if (y.length === 0) return 0;
    const mean = y.reduce((sum, val) => sum + val, 0) / y.length;
    return y.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / y.length;
  }

  predict(x: Record<string, number>): number {
    return this.predictNode(this.root, x);
  }

  private predictNode(node: DecisionTreeNode | null | undefined, x: Record<string, number>): number {
    if (!node) return 0;
    if (node.value !== undefined) return node.value;
    if (node.feature && node.threshold !== undefined) {
      const val = x[node.feature] ?? 0;
      if (val <= node.threshold) {
        return this.predictNode(node.left, x);
      } else {
        return this.predictNode(node.right, x);
      }
    }
    return 0;
  }
}

// Random Forest Regressor Ensemble
export class RandomForestRegressor {
  trees: DecisionTreeRegressor[] = [];
  numTrees: number;
  maxDepth: number;

  constructor(numTrees = 10, maxDepth = 4) {
    this.numTrees = numTrees;
    this.maxDepth = maxDepth;
  }

  fit(X: Record<string, number>[], y: number[]) {
    this.trees = [];
    const numSamples = X.length;
    if (numSamples === 0) return;

    for (let i = 0; i < this.numTrees; i++) {
      // Bootstrap sampling with replacement
      const bootstrapX: Record<string, number>[] = [];
      const bootstrapY: number[] = [];
      for (let j = 0; j < numSamples; j++) {
        const randIdx = Math.floor(Math.random() * numSamples);
        bootstrapX.push(X[randIdx]);
        bootstrapY.push(y[randIdx]);
      }

      const tree = new DecisionTreeRegressor(this.maxDepth);
      tree.fit(bootstrapX, bootstrapY);
      this.trees.push(tree);
    }
  }

  predict(x: Record<string, number>): number {
    if (this.trees.length === 0) return 0;
    const predictions = this.trees.map(tree => tree.predict(x));
    return predictions.reduce((sum, p) => sum + p, 0) / this.trees.length;
  }
}

const MONTH_SEASONALITY: Record<number, number> = {
  0: 0.76,
  1: 0.84,
  2: 0.94,
  3: 1.03,
  4: 1.12,
  5: 1.18,
  6: 1.20,
  7: 1.16,
  8: 1.07,
  9: 0.95,
  10: 0.83,
  11: 0.74,
};

export function aggregateDailyEnergy(pvRecords: PvData[]): DailyEnergyPoint[] {
  const dailyMap: Record<string, { energy: number; temps: number[]; irrs: number[] }> = {};

  pvRecords.forEach(row => {
    const timestamp = row.timestamp ? new Date(row.timestamp) : null;
    if (!timestamp) return;
    const dateKey = timestamp.toISOString().slice(0, 10);

    if (!dailyMap[dateKey]) {
      dailyMap[dateKey] = { energy: 0, temps: [], irrs: [] };
    }

    dailyMap[dateKey].energy += (row.energy_kwh ?? 0);
    if (row.temperature_c != null) dailyMap[dateKey].temps.push(row.temperature_c);
    if (row.irradiance_wm2 != null) dailyMap[dateKey].irrs.push(row.irradiance_wm2);
  });

  return Object.entries(dailyMap)
    .map(([date, data]) => {
      const avg_temp = data.temps.length > 0 ? data.temps.reduce((s, v) => s + v, 0) / data.temps.length : 25;
      const avg_irr = data.irrs.length > 0 ? data.irrs.reduce((s, v) => s + v, 0) / data.irrs.length : 500;
      return {
        date,
        energy_kwh: parseFloat(data.energy.toFixed(2)),
        avg_temp,
        avg_irr,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function computeLinearRegression(points: DailyEnergyPoint[]) {
  const n = points.length;
  if (n === 0) {
    return { slope: 0, intercept: 0, score: 0 };
  }

  const xValues = points.map((_, index) => index);
  const yValues = points.map(point => point.energy_kwh);
  const xMean = xValues.reduce((sum, x) => sum + x, 0) / n;
  const yMean = yValues.reduce((sum, y) => sum + y, 0) / n;

  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i += 1) {
    numerator += (xValues[i] - xMean) * (yValues[i] - yMean);
    denominator += Math.pow(xValues[i] - xMean, 2);
  }

  const slope = denominator === 0 ? 0 : numerator / denominator;
  const intercept = yMean - slope * xMean;

  let ssTotal = 0;
  let ssResidual = 0;
  for (let i = 0; i < n; i += 1) {
    const predicted = intercept + slope * xValues[i];
    ssTotal += Math.pow(yValues[i] - yMean, 2);
    ssResidual += Math.pow(yValues[i] - predicted, 2);
  }
  const score = ssTotal === 0 ? 0 : Math.max(0, 1 - ssResidual / ssTotal);

  return { slope, intercept, score };
}

export function getSeasonalityFactor(date: Date) {
  return MONTH_SEASONALITY[date.getMonth()] ?? 1;
}

export function getRollingAverage(points: DailyEnergyPoint[], days: number) {
  if (points.length === 0) return 0;
  const recent = points.slice(-Math.min(days, points.length));
  const sum = recent.reduce((acc, item) => acc + item.energy_kwh, 0);
  return sum / Math.max(1, recent.length);
}

export function getStandardDeviation(values: number[]) {
  if (values.length === 0) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

export function generateForecastPoints(historical: DailyEnergyPoint[], horizon: number): ForecastPoint[] {
  const sorted = [...historical].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length === 0) {
    return Array.from({ length: horizon }, (_, index) => ({
      date: new Date(Date.now() + (index + 1) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      predicted_kwh: 0,
      lower: 0,
      upper: 0,
      confidence_pct: 0,
    }));
  }

  // Train Random Forest on historical data
  const rf = new RandomForestRegressor(12, 4);
  const X = sorted.map(p => ({
    temperature: p.avg_temp ?? 25,
    irradiance: p.avg_irr ?? 500,
  }));
  const y = sorted.map(p => p.energy_kwh);
  rf.fit(X, y);

  const avgLast14 = getRollingAverage(sorted, 14);
  const stdDev30 = getStandardDeviation(sorted.slice(-Math.min(30, sorted.length)).map(point => point.energy_kwh));
  const baseConfidence = 85 + Math.min(sorted.length, 100) * 0.15;

  const weatherForecast = [
    { day: 'Mon', irr: 920, high: 28 },
    { day: 'Tue', irr: 950, high: 30 },
    { day: 'Wed', irr: 450, high: 22 },
    { day: 'Thu', irr: 200, high: 18 },
    { day: 'Fri', irr: 350, high: 20 },
    { day: 'Sat', irr: 880, high: 26 },
    { day: 'Sun', irr: 930, high: 29 },
  ];

  const forecast: ForecastPoint[] = [];
  const today = new Date();

  for (let day = 1; day <= horizon; day += 1) {
    const futureDate = new Date(today);
    futureDate.setDate(today.getDate() + day);

    // Day of the week index (0 = Monday, 6 = Sunday)
    const dayOfWeek = (futureDate.getDay() + 6) % 7;
    const weather = weatherForecast[dayOfWeek] ?? weatherForecast[0];

    // Predict using Random Forest
    let rfPrediction = rf.predict({
      temperature: weather.high,
      irradiance: weather.irr,
    });

    // Fallback/Blend prediction with rolling average for stability (blend 30% historical base)
    const blendFactor = 0.3;
    const finalPrediction = rfPrediction * (1 - blendFactor) + avgLast14 * blendFactor;
    
    const seasonality = getSeasonalityFactor(futureDate);
    const predictedValue = Math.max(0, finalPrediction * seasonality);
    const predicted = Number(predictedValue.toFixed(2));

    const varianceMargin = Math.max(1, stdDev30 * 0.85, predicted * 0.12);
    const lower = Number(Math.max(0, predicted - varianceMargin).toFixed(2));
    const upper = Number((predicted + varianceMargin).toFixed(2));
    const confidence_pct = Number(Math.max(55, Math.min(98, baseConfidence - (varianceMargin / Math.max(1, predicted)) * 7)).toFixed(0));

    forecast.push({
      date: futureDate.toISOString().slice(0, 10),
      predicted_kwh: predicted,
      lower,
      upper,
      confidence_pct,
    });
  }

  return forecast;
}

export function generateForecastCollections(historical: DailyEnergyPoint[]) {
  return {
    forecast3: generateForecastPoints(historical, 3),
    forecast7: generateForecastPoints(historical, 7),
    forecast30: generateForecastPoints(historical, 30),
  };
}
