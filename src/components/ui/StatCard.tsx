import type { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  icon: ReactNode;
  trend?: { value: number; label: string };
  color?: 'amber' | 'blue' | 'emerald' | 'rose' | 'cyan';
  subtitle?: string;
  glowing?: boolean;
}

const colorMap = {
  amber: {
    icon: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
    trend: 'text-amber-400',
    glow: 'shadow-amber-500/10',
    bar: 'bg-amber-500',
  },
  blue: {
    icon: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
    trend: 'text-blue-400',
    glow: 'shadow-blue-500/10',
    bar: 'bg-blue-500',
  },
  emerald: {
    icon: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
    trend: 'text-emerald-400',
    glow: 'shadow-emerald-500/10',
    bar: 'bg-emerald-500',
  },
  rose: {
    icon: 'bg-rose-500/15 text-rose-400 border-rose-500/20',
    trend: 'text-rose-400',
    glow: 'shadow-rose-500/10',
    bar: 'bg-rose-500',
  },
  cyan: {
    icon: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/20',
    trend: 'text-cyan-400',
    glow: 'shadow-cyan-500/10',
    bar: 'bg-cyan-500',
  },
};

export default function StatCard({ label, value, unit, icon, trend, color = 'amber', subtitle, glowing }: StatCardProps) {
  const c = colorMap[color];

  return (
    <div className={`relative bg-gray-900 border border-gray-800 rounded-2xl p-5 overflow-hidden transition-all duration-300 hover:border-gray-700 hover:-translate-y-0.5 ${glowing ? `shadow-lg ${c.glow}` : ''}`}>
      {/* Background accent */}
      <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-gradient-to-br from-transparent opacity-30" style={{ background: 'radial-gradient(circle, var(--accent) 0%, transparent 70%)' }} />

      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${c.icon}`}>
          {icon}
        </div>
        {trend && (
          <span className={`text-xs font-semibold ${trend.value >= 0 ? 'text-emerald-400' : 'text-red-400'} bg-gray-800 px-2 py-1 rounded-lg`}>
            {trend.value >= 0 ? '+' : ''}{trend.value}%
          </span>
        )}
      </div>

      <div>
        <p className="text-2xl font-bold text-white tracking-tight">
          {value}
          {unit && <span className="text-sm font-medium text-gray-500 ml-1">{unit}</span>}
        </p>
        <p className="text-sm text-gray-400 mt-1">{label}</p>
        {subtitle && <p className="text-xs text-gray-600 mt-0.5">{subtitle}</p>}
        {trend && (
          <p className={`text-xs mt-1.5 ${trend.value >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
            {trend.label}
          </p>
        )}
      </div>
    </div>
  );
}
