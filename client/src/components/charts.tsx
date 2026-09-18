import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTheme } from "../context/ThemeContext";

export const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Active",
  PARTIALLY_CLAIMED: "Partially claimed",
  FULLY_CLAIMED: "Fully claimed",
  EXPIRED: "Expired",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "var(--accent)",
  PARTIALLY_CLAIMED: "var(--mint)",
  FULLY_CLAIMED: "var(--foreground)",
  EXPIRED: "var(--muted)",
  COMPLETED: "var(--rescued)",
  CANCELLED: "var(--alert)",
};

type ChartTheme = {
  ink: string;
  muted: string;
  line: string;
  card: string;
  donated: string;
  rescued: string;
};

const FALLBACK: ChartTheme = {
  ink: "#1c3029",
  muted: "#65716a",
  line: "#d9d8ce",
  card: "#fffaf2",
  donated: "#1c3029",
  rescued: "#df7d73",
};

export function useChartTheme(): ChartTheme {
  const { theme } = useTheme();
  const [colors, setColors] = useState<ChartTheme>(FALLBACK);

  useEffect(() => {
    const s = getComputedStyle(document.documentElement);
    const read = (name: string, fallback: string) => s.getPropertyValue(name).trim() || fallback;
    setColors({
      ink: read("--foreground", FALLBACK.ink),
      muted: read("--muted", FALLBACK.muted),
      line: read("--border", FALLBACK.line),
      card: read("--card", FALLBACK.card),
      donated: read("--secondary", FALLBACK.donated),
      rescued: read("--accent", FALLBACK.rescued),
    });
  }, [theme]);

  return colors;
}

export function formatChartDay(isoDate: string) {
  const d = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric" });
}

export function ChartPanel({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex h-full min-h-80 flex-col rounded-[1.5rem] border border-border bg-card p-4">
      <h2 className="font-semibold text-foreground">{title}</h2>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
      <div className="mt-3 h-64 min-h-0 flex-1">{children}</div>
    </div>
  );
}

function tooltipStyle(theme: ChartTheme): CSSProperties {
  return {
    background: theme.card,
    border: `1px solid ${theme.line}`,
    borderRadius: 12,
    color: theme.ink,
    fontSize: 12,
  };
}

export function MealsOverTimeChart({
  data,
}: {
  data: { date: string; donated: number; rescued: number }[];
}) {
  const theme = useChartTheme();
  const rows = useMemo(
    () => data.map((row) => ({ ...row, label: formatChartDay(row.date) })),
    [data],
  );

  return (
    <ResponsiveContainer>
      <BarChart data={rows} barGap={4}>
        <CartesianGrid strokeDasharray="3 3" stroke={theme.line} vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: theme.muted }} axisLine={{ stroke: theme.line }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: theme.muted }} axisLine={{ stroke: theme.line }} />
        <Tooltip
          contentStyle={tooltipStyle(theme)}
          formatter={(value, name) => [value ?? 0, name === "donated" ? "Donated" : "Rescued (picked up)"]}
          labelFormatter={(_, payload) => payload?.[0]?.payload?.date ?? ""}
        />
        <Legend
          formatter={(value) => (value === "donated" ? "Donated" : "Rescued (picked up)")}
          wrapperStyle={{ fontSize: 12, color: theme.ink }}
        />
        <Bar dataKey="donated" name="donated" fill={theme.donated} radius={[4, 4, 0, 0]} />
        <Bar dataKey="rescued" name="rescued" fill={theme.rescued} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function StatusDonut({ distribution }: { distribution: Record<string, number> }) {
  const theme = useChartTheme();
  const pie = Object.entries(STATUS_LABELS)
    .map(([key, name]) => ({ key, name, value: distribution[key] ?? 0 }))
    .filter((row) => row.value > 0);

  if (!pie.length) {
    return <p className="flex h-full items-center text-sm text-muted">No donations yet.</p>;
  }

  return (
    <ResponsiveContainer>
      <PieChart>
        <Pie data={pie} dataKey="value" nameKey="name" innerRadius={54} outerRadius={84} paddingAngle={2}>
          {pie.map((row) => (
            <Cell key={row.key} fill={STATUS_COLORS[row.key] ?? theme.muted} />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle(theme)} formatter={(value, name) => [value ?? 0, String(name)]} />
        <Legend wrapperStyle={{ fontSize: 12, color: theme.ink }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function RescueRateChart({
  data,
}: {
  data: { week: string; donated: number; rescued: number; rescueRate: number }[];
}) {
  const theme = useChartTheme();
  return (
    <ResponsiveContainer>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke={theme.line} vertical={false} />
        <XAxis dataKey="week" tick={{ fontSize: 11, fill: theme.muted }} axisLine={{ stroke: theme.line }} />
        <YAxis
          allowDecimals={false}
          unit="%"
          tick={{ fontSize: 11, fill: theme.muted }}
          axisLine={{ stroke: theme.line }}
        />
        <Tooltip
          contentStyle={tooltipStyle(theme)}
          formatter={(value, _name, item) => {
            const row = item?.payload as { donated?: number; rescued?: number; rescueRate?: number } | undefined;
            return [`${value}% · donated ${row?.donated ?? 0} · rescued ${row?.rescued ?? 0}`, "Rescue rate"];
          }}
        />
        <Legend formatter={() => "Rescue rate % (rescued / donated)"} wrapperStyle={{ fontSize: 12, color: theme.ink }} />
        <Bar dataKey="rescueRate" fill={theme.rescued} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function NamedMealsChart({ data }: { data: { name: string; meals: number }[] }) {
  const theme = useChartTheme();
  return (
    <ResponsiveContainer>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 12 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={theme.line} horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11, fill: theme.muted }} axisLine={{ stroke: theme.line }} />
        <YAxis
          type="category"
          dataKey="name"
          width={120}
          tick={{ fontSize: 11, fill: theme.muted }}
          axisLine={{ stroke: theme.line }}
        />
        <Tooltip contentStyle={tooltipStyle(theme)} formatter={(value) => [value ?? 0, "Meals donated"]} />
        <Bar dataKey="meals" fill={theme.donated} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
