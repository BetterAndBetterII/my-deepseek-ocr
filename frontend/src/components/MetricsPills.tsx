import { formatBytes, formatNumber } from "@/lib/utils";
import { type UsageSummary } from "@/lib/api";
import { BarChart3, FileText, Cpu } from "lucide-react";

export function MetricsPills({ summary }: { summary: UsageSummary | null }) {
  if (!summary) return null;
  const items = [
    { icon: FileText, label: "次数", value: formatNumber(summary.total_events) },
    { icon: BarChart3, label: "输入", value: `${formatBytes(summary.total_input_bytes)}` },
    {
      icon: Cpu,
      label: "Token",
      value: `${formatNumber(summary.total_prompt_tokens + summary.total_completion_tokens)}`,
    },
  ];
  return (
    <div className="flex gap-2">
      {items.map(({ icon: Icon, label, value }, idx) => (
        <div
          key={idx}
          className="flex items-center gap-2 rounded-full border bg-background/60 backdrop-blur px-3 py-1 text-xs"
        >
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">{label}</span>
          <span className="font-medium">{value}</span>
        </div>
      ))}
    </div>
  );
}
