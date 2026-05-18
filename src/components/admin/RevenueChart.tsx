"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export interface RevenueChartPoint {
  /** ISO date (YYYY-MM-DD) of the bucket. */
  date: string;
  /** Revenue in cents for that day. */
  revenue: number;
}

interface RevenueChartProps {
  data: RevenueChartPoint[];
}

export function RevenueChart({ data }: RevenueChartProps) {
  // Convert cents to dollars for display
  const display = data.map((d) => ({
    date: d.date.slice(5), // MM-DD
    revenue: Math.round(d.revenue / 100),
  }));

  if (display.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-sm text-gray-400">
        No revenue yet in the last 30 days.
      </div>
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <LineChart data={display} margin={{ top: 4, right: 12, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
          <XAxis dataKey="date" stroke="#9ca3af" fontSize={11} tickLine={false} />
          <YAxis stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v: number) => `$${v}`} />
          <Tooltip
            formatter={(value: number) => [`$${value.toLocaleString()}`, "Revenue"]}
            contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12 }}
          />
          <Line type="monotone" dataKey="revenue" stroke="#0284c7" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
