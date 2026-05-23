import { useEffect, useMemo, useState } from 'react';
import { BrainCircuit, TrendingUp, Sun, Cloud } from 'lucide-react';
import AppLayout from '../../components/layout/AppLayout';
import PredictionChart from '../../components/charts/PredictionChart';
import Badge from '../../components/ui/Badge';
import { useAuth } from '../../contexts/AuthContext';
import { createPrediction, getInstallationsByUser, getPvDataByInstallationRange } from '../../lib/api';
import { aggregateDailyEnergy, generateForecastCollections, type ForecastPoint } from '../../lib/predictionEngine';
import type { PvData } from '../../lib/database.types';

type ForecastRange = 3 | 7 | 30;

export default function PredictionsPage() {
  const { profile } = useAuth();
  const [range, setRange] = useState<ForecastRange>(7);
  const [forecastCollections, setForecastCollections] = useState<{ forecast3: ForecastPoint[]; forecast7: ForecastPoint[]; forecast30: ForecastPoint[] }>({ forecast3: [], forecast7: [], forecast30: [] });
  const [historical, setHistorical] = useState<{ date: string; actual: number }[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadedRowCount, setUploadedRowCount] = useState(0);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [parsedCsvDailyTotals, setParsedCsvDailyTotals] = useState<any[] | null>(null);

  const parseCsvToPvData = (csvText: string): PvData[] => {
    const lines = csvText.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
    if (lines.length < 2) {
      throw new Error('CSV file must contain a header row and at least one data row.');
    }

    const firstLine = lines[0];
    const delimiter = firstLine.includes(';') ? ';' : ',';

    const splitLine = (line: string) => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i += 1) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === delimiter && !inQuotes) {
          result.push(current.trim().replace(/^"|"$/g, ''));
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim().replace(/^"|"$/g, ''));
      return result;
    };

    const headerCols = splitLine(lines[0]).map(col => col.toLowerCase());
    const rows = lines.slice(1).map(line => splitLine(line));
    const records = rows.map((row) => {
      const record: Record<string, string> = {};
      headerCols.forEach((key, index) => { record[key] = row[index] ?? ''; });
      return record;
    });

    const parsed: PvData[] = [];
    const energyByDate = new Map<string, number>();

    const normalizeTimestamp = (value: string) => {
      const candidate = value.trim();
      if (!candidate) return null;
      
      let parsedDate = new Date(candidate);
      if (!Number.isNaN(parsedDate.getTime())) return parsedDate;

      // Match DD/MM/YYYY, HH:mm or DD/MM/YYYY HH:mm:ss
      const match = candidate.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:,\s*|\s+)(\d{1,2}):(\d{2})(?::(\d{2}))?/);
      if (match) {
        const [, day, month, year, hour, minute, second = '0'] = match;
        parsedDate = new Date(
          parseInt(year, 10),
          parseInt(month, 10) - 1,
          parseInt(day, 10),
          parseInt(hour, 10),
          parseInt(minute, 10),
          parseInt(second, 10)
        );
        if (!Number.isNaN(parsedDate.getTime())) return parsedDate;
      }
      return null;
    };

    const getNumeric = (value: string) => {
      const number = parseFloat(value.replace(',', '.'));
      return Number.isNaN(number) ? null : number;
    };

    const timeRows = records
      .map((record) => {
        const timestamp = normalizeTimestamp(record.timestamp || record.time || record.date || '');
        if (!timestamp) return null;
        const energy = getNumeric(record.energy_kwh || record.energy || record.daily_energy || '');
        const power = getNumeric(record.power_w || record.power || '');
        const voltage = getNumeric(record.voltage || '');
        const current_a = getNumeric(record.current || record.current_a || '');
        const temperature_c = getNumeric(record.temperature || record.temperature_c || '');
        const irradiance_wm2 = getNumeric(record.irradiance || record.irradiance_wm2 || '');
        return { timestamp, energy, power, voltage, current_a, temperature_c, irradiance_wm2 };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    if (!timeRows.length) {
      throw new Error('Unable to parse any valid timestamp values from the CSV.');
    }

    if (timeRows.some(row => row.energy == null) && timeRows.some(row => row.power != null)) {
      for (let i = 0; i < timeRows.length - 1; i += 1) {
        const current = timeRows[i];
        const next = timeRows[i + 1];
        const hours = (next.timestamp.getTime() - current.timestamp.getTime()) / 1000 / 3600;
        if (hours > 0 && hours <= 24) {
          const averagePower = ((current.power ?? 0) + (next.power ?? 0)) / 2;
          const energy = averagePower * hours / 1000;
          if (current.energy == null) {
            current.energy = energy;
          }
        }
      }
    }

    for (const row of timeRows) {
      const dateKey = row.timestamp.toISOString().slice(0, 10);
      const entryEnergy = row.energy ?? 0;
      energyByDate.set(dateKey, (energyByDate.get(dateKey) ?? 0) + entryEnergy);
      parsed.push({
        id: `${row.timestamp.getTime()}`,
        installation_id: '',
        sensor_id: null,
        timestamp: row.timestamp.toISOString(),
        voltage: row.voltage,
        current_a: row.current_a,
        power_w: row.power,
        temperature_c: row.temperature_c,
        irradiance_wm2: row.irradiance_wm2,
        energy_kwh: row.energy != null ? row.energy : null,
        created_at: row.timestamp.toISOString(),
      });
    }

    if ([...energyByDate.values()].every(value => value === 0)) {
      throw new Error('CSV contains no usable energy values. Ensure the file includes energy_kwh or power data.');
    }

    setUploadedRowCount(parsed.length);
    return parsed;
  };

  const saveForecastResults = async (installationId: string, forecastPoints: ForecastPoint[]) => {
    try {
      await Promise.all(forecastPoints.map(point => createPrediction({
        installation_id: installationId,
        prediction_date: new Date(point.date).toISOString(),
        predicted_kwh: point.predicted_kwh,
        confidence_pct: point.confidence_pct,
        model_version: 'csv-forecast-v1',
      })));
    } catch (saveError) {
      console.error('Unable to save forecast results', saveError);
    }
  };

  const handleCsvUpload = async (file: File) => {
    setCsvError(null);
    setError(null);
    setIsGenerating(true);
    setUploadedFileName(file.name);
    try {
      const text = await file.text();
      const parsedPv = parseCsvToPvData(text);
      if (!parsedPv.length) {
        throw new Error('No valid rows could be parsed from the uploaded CSV.');
      }
      const dailyTotals = aggregateDailyEnergy(parsedPv);
      if (!dailyTotals.length) {
        throw new Error('No daily energy data could be created from the uploaded CSV.');
      }

      setParsedCsvDailyTotals(dailyTotals);
      
      // Clear existing database predictions to let the user generate fresh ones from the CSV
      setForecastCollections({ forecast3: [], forecast7: [], forecast30: [] });
      setHistorical([]);
    } catch (csvErrorValue) {
      console.error('CSV upload failed', csvErrorValue);
      setCsvError(csvErrorValue instanceof Error ? csvErrorValue.message : 'Unable to parse the CSV file.');
      setParsedCsvDailyTotals(null);
    } finally {
      setIsGenerating(false);
    }
  };

  const triggerCsvUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,text/csv';
    input.onchange = event => {
      const target = event.target as HTMLInputElement;
      const file = target.files?.[0];
      if (file) {
        handleCsvUpload(file);
      }
    };
    input.click();
  };

  const generatePredictions = async () => {
    if (!profile?.id) return;
    setError(null);
    setIsGenerating(true);

    try {
      if (parsedCsvDailyTotals && parsedCsvDailyTotals.length > 0) {
        // Generate prediction using the uploaded CSV file's data
        const collections = generateForecastCollections(parsedCsvDailyTotals);
        setHistorical(parsedCsvDailyTotals.slice(-30).map(entry => ({
          date: new Date(entry.date).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
          actual: parseFloat(entry.energy_kwh.toFixed(2)),
        })));
        setForecastCollections(collections);

        const installs = await getInstallationsByUser(profile.id);
        const installationId = installs?.[0]?.id;
        if (installationId) {
          await saveForecastResults(installationId, collections.forecast30);
        }
      } else {
        // Generate prediction using real-time/historical database data
        const installs = await getInstallationsByUser(profile.id);
        const installationId = installs?.[0]?.id;
        if (!installationId) {
          setError('No active installation found.');
          setHistorical([]);
          setForecastCollections({ forecast3: [], forecast7: [], forecast30: [] });
          return;
        }

        const end = new Date();
        const start = new Date(end);
        start.setFullYear(end.getFullYear() - 1);
        const startOfDay = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0);
        const endOfDay = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999);
        const pvHistory = await getPvDataByInstallationRange(
          installationId,
          startOfDay.toISOString(),
          endOfDay.toISOString(),
        );

        const dailyTotals = aggregateDailyEnergy(pvHistory);
        if (!dailyTotals.length) {
          setHistorical([]);
          setForecastCollections({ forecast3: [], forecast7: [], forecast30: [] });
          return;
        }

        setHistorical(dailyTotals.slice(-30).map(entry => ({
          date: new Date(entry.date).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
          actual: parseFloat(entry.energy_kwh.toFixed(2)),
        })));
        const collections = generateForecastCollections(dailyTotals);
        setForecastCollections(collections);
      }
    } catch (loadError) {
      console.error('Failed to generate predictions', loadError);
      setError('Unable to generate prediction. Please try again later.');
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    generatePredictions();
  }, [profile?.id]);

  const predictionData = useMemo(() => {
    const selected = range === 3 ? forecastCollections.forecast3 : range === 7 ? forecastCollections.forecast7 : forecastCollections.forecast30;
    return selected.map(point => ({
      date: point.date,
      predicted: point.predicted_kwh,
      lower: point.lower,
      upper: point.upper,
      confidence_pct: point.confidence_pct,
    }));
  }, [forecastCollections, range]);

  const totalPredicted = useMemo(() => {
    const selected = range === 3 ? forecastCollections.forecast3 : range === 7 ? forecastCollections.forecast7 : forecastCollections.forecast30;
    return selected.reduce((s, point) => s + point.predicted_kwh, 0);
  }, [forecastCollections, range]);

  const avgConfidence = useMemo(() => {
    const selected = range === 3 ? forecastCollections.forecast3 : range === 7 ? forecastCollections.forecast7 : forecastCollections.forecast30;
    if (selected.length === 0) return 0;
    return selected.reduce((s, point) => s + point.confidence_pct, 0) / selected.length;
  }, [forecastCollections, range]);

  return (
    <AppLayout title="AI Predictions">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center">
              <BrainCircuit className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">AI Energy Forecast</h2>
              <p className="text-sm text-gray-400 mt-0.5">ML-powered production predictions</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="info">Model v2.1</Badge>
            <button
              type="button"
              onClick={generatePredictions}
              disabled={isGenerating}
              className="rounded-2xl bg-amber-500 px-4 py-2 text-sm font-medium text-black transition hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? 'Generating...' : 'Generate Prediction'}
            </button>
            <button
              type="button"
              onClick={triggerCsvUpload}
              disabled={isGenerating}
              className="rounded-2xl bg-gray-800 px-4 py-2 text-sm font-medium text-gray-200 transition hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Upload CSV
            </button>
          </div>
        </div>
        {(uploadedFileName || csvError) && (
          <div className="rounded-2xl border border-gray-800 bg-gray-900 px-4 py-3 text-sm text-gray-300">
            {uploadedFileName && <p>Uploaded file: <span className="text-amber-400">{uploadedFileName}</span> ({uploadedRowCount} rows)</p>}
            {csvError && <p className="text-red-400 mt-1">{csvError}</p>}
          </div>
        )}
        {error && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          {([3, 7, 30] as ForecastRange[]).map(r => {
            const selected = r === 3 ? forecastCollections.forecast3 : r === 7 ? forecastCollections.forecast7 : forecastCollections.forecast30;
            const total = selected.reduce((s, p) => s + p.predicted_kwh, 0);
            const conf = selected.length === 0 ? 0 : selected.reduce((s, p) => s + p.confidence_pct, 0) / selected.length;
            return (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`relative p-4 rounded-2xl border transition-all text-left ${range === r
                  ? 'bg-emerald-500/10 border-emerald-500/40 shadow-lg shadow-emerald-500/10'
                  : 'bg-gray-900 border-gray-800 hover:border-gray-700'
                }`}
              >
                {range === r && (
                  <div className="absolute top-3 right-3 w-2 h-2 bg-emerald-400 rounded-full" />
                )}
                <p className="text-xs text-gray-500 mb-1">Next {r} days</p>
                <p className="text-xl font-bold text-white">{total.toFixed(1)} <span className="text-xs font-normal text-gray-500">kWh</span></p>
                <p className="text-xs text-emerald-400 mt-1">{conf.toFixed(0)}% confidence</p>
              </button>
            );
          })}
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-white">Production Forecast</h3>
              <p className="text-xs text-gray-500 mt-0.5">Historical + {range}-day AI prediction with confidence bands</p>
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-amber-500 inline-block" /> Actual</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-emerald-500 inline-block border-dashed border-t border-emerald-500 bg-transparent border" /> Forecast</span>
            </div>
          </div>
          <PredictionChart historicalData={historical} predictionData={predictionData} height={300} />
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: `${range}-Day Total`, value: `${totalPredicted.toFixed(1)} kWh`, icon: TrendingUp, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
            { label: 'Daily Average', value: `${(totalPredicted / range).toFixed(1)} kWh`, icon: Sun, color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
            { label: 'Model Confidence', value: `${avgConfidence.toFixed(0)}%`, icon: BrainCircuit, color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
            { label: 'CO₂ Saved Est.', value: `${(totalPredicted * 0.489).toFixed(0)} kg`, icon: Cloud, color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20' },
          ].map(card => (
            <div key={card.label} className="bg-gray-900 border border-gray-800 rounded-2xl p-4 hover:border-gray-700 transition-all">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center border mb-3 ${card.color}`}>
                <card.icon className="w-5 h-5" />
              </div>
              <p className="text-lg font-bold text-white">{card.value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{card.label}</p>
            </div>
          ))}
        </div>



        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800">
            <h3 className="text-sm font-semibold text-white">Forecast Details — Next {range} Days</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left text-xs text-gray-500 px-5 py-3">Date</th>
                  <th className="text-right text-xs text-gray-500 px-5 py-3">Predicted</th>
                  <th className="text-right text-xs text-gray-500 px-5 py-3">Range</th>
                  <th className="text-right text-xs text-gray-500 px-5 py-3">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {predictionData.map((point, index) => (
                  <tr key={`${point.date}-${index}`} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                    <td className="px-5 py-3 text-sm text-white">
                      {new Date(point.date).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span className="text-sm font-semibold text-emerald-400">{point.predicted.toFixed(1)} kWh</span>
                    </td>
                    <td className="px-5 py-3 text-right text-xs text-gray-400">
                      {point.lower.toFixed(1)} – {point.upper.toFixed(1)} kWh
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${point.confidence_pct}%` }} />
                        </div>
                        <span className="text-xs text-gray-400 w-8 text-right">{point.confidence_pct.toFixed(0)}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
