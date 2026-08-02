'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatAmount } from '@/lib/format';
import type { DailyTrendDatum } from '@/lib/insights';

export function WeeklyTrendChart({ data }: { data: DailyTrendDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
        <YAxis
          tickFormatter={(v: number) => (v === 0 ? '0' : `${Math.round(v / 10000)}만`)}
          tickLine={false}
          axisLine={false}
          width={40}
          fontSize={12}
        />
        <Tooltip formatter={(v) => `${formatAmount(Number(v))}원`} />
        <Bar dataKey="지출" fill="#dc2626" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
