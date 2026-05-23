import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend
} from 'recharts';

interface PredictionChartProps {
  historicalData: { date: string; actual: number }[];
  predictionData: { date: string; predicted: number; lower: number; upper: number }[];
  height?: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-3 shadow-xl text-xs">
      <p className="text-gray-400 mb-2 font-medium">{label}</p>
      {payload.map((p: { color: string; name: string; value: number; dataKey: string }) => (
        p.dataKey !== 'range' && (
          <div key={p.dataKey} className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            <span className="text-gray-300">{p.name}:</span>
            <span className="text-white font-semibold">{p.value?.toFixed(1)} kWh</span>
          </div>
        )
      ))}
    </div>
  );
}

export default function PredictionChart({ historicalData, predictionData, height = 280 }: PredictionChartProps) {
  const combined = [
    ...historicalData.map(d => ({ date: d.date, actual: d.actual, predicted: undefined, lower: undefined, upper: undefined })),
    ...predictionData.map(d => ({ date: d.date, actual: undefined, predicted: d.predicted, lower: d.lower, upper: d.upper })),
  ];

  const splitDate = predictionData[0]?.date;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={combined} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="predGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '12px' }} />
        {splitDate && <ReferenceLine x={splitDate} stroke="#374151" strokeDasharray="4 2" label={{ value: 'Forecast', fill: '#6b7280', fontSize: 10 }} />}
        <Line
          type="monotone"
          dataKey="actual"
          name="Actual"
          stroke="#f59e0b"
          strokeWidth={2}
          dot={false}
          connectNulls={false}
        />
        <Area
          type="monotone"
          dataKey="upper"
          name="Upper bound"
          stroke="transparent"
          fill="url(#predGrad)"
          connectNulls={false}
        />
        <Area
          type="monotone"
          dataKey="lower"
          name="Lower bound"
          stroke="transparent"
          fill="#09090b"
          connectNulls={false}
        />
        <Line
          type="monotone"
          dataKey="predicted"
          name="Predicted"
          stroke="#10b981"
          strokeWidth={2}
          dot={false}
          strokeDasharray="5 3"
          connectNulls={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
