import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine
} from 'recharts';

interface PowerChartProps {
  data: { time: string; power: number; irradiance?: number }[];
  height?: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-3 shadow-xl text-xs">
      <p className="text-gray-400 mb-2 font-medium">{label}</p>
      {payload.map((p: { color: string; name: string; value: number; dataKey: string }) => (
        <div key={p.dataKey} className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-gray-300">{p.name}:</span>
          <span className="text-white font-semibold">
            {p.value.toFixed(1)} {p.dataKey === 'irradiance' ? 'W/m²' : 'W'}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function PowerChart({ data, height = 220 }: PowerChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="powerGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="irradGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
        <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
        <Tooltip content={<CustomTooltip />} />
        {data.some(d => d.irradiance !== undefined) && (
          <Area
            type="monotone"
            dataKey="irradiance"
            name="Irradiance"
            stroke="#06b6d4"
            strokeWidth={1.5}
            fill="url(#irradGrad)"
            dot={false}
            strokeDasharray="4 2"
          />
        )}
        <Area
          type="monotone"
          dataKey="power"
          name="Power"
          stroke="#f59e0b"
          strokeWidth={2}
          fill="url(#powerGrad)"
          dot={false}
        />
        <ReferenceLine y={0} stroke="#374151" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
