'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatAmount } from '@/lib/format';

export interface MonthlyBarDatum {
  label: string;
  수입: number;
  지출: number;
}

export function MonthlyBarChart({ data }: { data: MonthlyBarDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
        <YAxis
          tickFormatter={(v: number) => `${Math.round(v / 10000)}만`}
          tickLine={false}
          axisLine={false}
          width={44}
          fontSize={12}
        />
        <Tooltip formatter={(v) => `${formatAmount(Number(v))}원`} />
        <Legend />
        <Bar dataKey="수입" fill="#2563eb" radius={[4, 4, 0, 0]} />
        <Bar dataKey="지출" fill="#dc2626" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
