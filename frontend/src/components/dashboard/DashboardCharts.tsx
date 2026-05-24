import { BarChart3, FileText, PieChart as PieIcon } from "lucide-react";
import { Card } from "../ui/Card";
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

type ChartPoint = {
  name: string;
  value: number;
  color: string;
};

type DashboardChartsProps = {
  theme: string;
  sureData: ChartPoint[];
  typeData: ChartPoint[];
  statusCounts: ChartPoint[];
};

export default function DashboardCharts({
  theme,
  sureData,
  typeData,
  statusCounts,
}: DashboardChartsProps) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      <Card className="p-6 border-slate-100 dark:border-slate-800 shadow-none dark:bg-slate-900">
        <div className="flex items-center gap-2 mb-6 border-b border-slate-50 dark:border-slate-800 pb-4">
          <BarChart3 size={16} className="text-slate-400" />
          <h3 className="font-black text-[11px] text-slate-500 uppercase tracking-widest">Görev Süre Durumu</h3>
        </div>
        <div className="h-[300px] w-full relative">
          {sureData.every((d) => d.value === 0) ? (
            <div className="flex items-center justify-center h-full text-slate-400 text-xs font-bold">Henüz veri yok</div>
          ) : (
            <ResponsiveContainer width="100%" height={300} minWidth={0}>
              <BarChart data={sureData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === "dark" ? "#1e293b" : "#f8fafc"} />
                <XAxis
                  dataKey="name"
                  fontSize={9}
                  axisLine={false}
                  tickLine={false}
                  fontWeight={900}
                  interval={0}
                  angle={-35}
                  textAnchor="end"
                  height={50}
                  stroke={theme === "dark" ? "#94a3b8" : "#64748b"}
                  className="font-outfit"
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  fontSize={10}
                  fontWeight="bold"
                  domain={[0, (dataMax: number) => Math.max(dataMax, 10)]}
                  allowDecimals={false}
                  stroke={theme === "dark" ? "#94a3b8" : "#64748b"}
                  className="font-outfit"
                />
                <Tooltip
                  cursor={{ fill: theme === "dark" ? "#0f172a" : "#f8fafc" }}
                  contentStyle={{
                    borderRadius: "12px",
                    border: "none",
                    background: theme === "dark" ? "#1e293b" : "#ffffff",
                    color: theme === "dark" ? "#f1f5f9" : "#0f172a",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
                  }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={24}>
                  {sureData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      <Card className="p-6 border-slate-100 dark:border-slate-800 shadow-none dark:bg-slate-900">
        <div className="flex items-center gap-2 mb-6 border-b border-slate-50 dark:border-slate-800 pb-4">
          <PieIcon size={16} className="text-slate-400" />
          <h3 className="font-black text-[11px] text-slate-500 uppercase tracking-widest">Görev Türü Analizi</h3>
        </div>
        <div className="h-[300px] w-full relative">
          {typeData.length === 0 ? (
            <div className="flex items-center justify-center h-full text-slate-400 text-xs font-bold">Henüz veri yok</div>
          ) : (
            <ResponsiveContainer width="100%" height={300} minWidth={0}>
              <PieChart>
                <Pie
                  data={typeData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={85}
                  paddingAngle={5}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {typeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: "9px", fontWeight: "bold", paddingTop: "10px" }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      <Card className="p-6 border-slate-100 dark:border-slate-800 shadow-none dark:bg-slate-900">
        <div className="flex items-center gap-2 mb-6 border-b border-slate-50 dark:border-slate-800 pb-4">
          <FileText size={16} className="text-slate-400" />
          <h3 className="font-black text-[11px] text-slate-500 uppercase tracking-widest">Rapor Yazım Süreci</h3>
        </div>
        <div className="h-[300px] w-full relative">
          {statusCounts.length === 0 ? (
            <div className="flex items-center justify-center h-full text-slate-400 text-xs font-bold">Henüz veri yok</div>
          ) : (
            <ResponsiveContainer width="100%" height={300} minWidth={0}>
              <PieChart>
                <Pie
                  data={statusCounts}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={85}
                  paddingAngle={5}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {statusCounts.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: "9px", fontWeight: "bold", paddingTop: "10px" }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>
    </div>
  );
}
