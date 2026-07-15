"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export interface TrafficChartPoint {
  /** ISO date (YYYY-MM-DD) of the bucket. */
  date: string;
  /** Pageviews for that day. */
  count: number;
}

export function TrafficChart({ data }: { data: TrafficChartPoint[] }) {
  const display = data.map((d) => ({ date: d.date.slice(5), count: d.count }));

  if (display.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-sm text-gray-400">
        No pageviews in this range yet.
      </div>
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <LineChart data={display} margin={{ top: 4, right: 12, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
          <XAxis dataKey="date" stroke="#9ca3af" fontSize={11} tickLine={false} />
          <YAxis stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip
            formatter={(value: number) => [value.toLocaleString(), "Pageviews"]}
            contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12 }}
          />
          <Line type="monotone" dataKey="count" stroke="#0284c7" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
