"use client";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

export function ProjectStatusChart({ data }: { data: { name: string; value: number; color: string }[] }) {
  const total = data.reduce((a, d) => a + d.value, 0);
  const shown = data.filter((d) => d.value > 0);
  return (
    <div>
      <div className="relative h-44" role="img" aria-label={`Projects by status: ${data.map((d) => `${d.name} ${d.value}`).join(", ")}`}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={shown} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="88%" paddingAngle={shown.length > 1 ? 3 : 0} stroke="none" isAnimationActive={false}>
              {shown.map((d) => <Cell key={d.name} fill={d.color} />)}
            </Pie>
            <Tooltip
              contentStyle={{ background: "rgb(26 28 35)", border: "1px solid rgb(58 61 74)", borderRadius: 8, fontSize: 12 }}
              itemStyle={{ color: "rgb(236 235 230)" }}
              formatter={(v, n) => [`${v} project${v === 1 ? "" : "s"}`, n]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="num text-2xl font-semibold">{total}</span>
          <span className="text-2xs text-subtle">projects</span>
        </div>
      </div>
      <ul className="mt-2 grid grid-cols-2 gap-1.5">
        {data.map((d) => (
          <li key={d.name} className="flex items-center gap-2 text-xs text-muted">
            <span className="size-2.5 rounded-sm" style={{ background: d.color }} />
            {d.name}<span className="ml-auto num text-fg">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
