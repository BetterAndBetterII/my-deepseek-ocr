import { type UsageEvent } from "@/lib/api";
import { formatBytes, formatNumber, formatRelativeZH } from "@/lib/utils";

export function CompactHistory({ list }: { list: UsageEvent[] }) {
  const items = list.slice(0, 8);
  if (items.length === 0) return <div className="text-xs text-muted-foreground">暂无记录</div>;
  return (
    <div className="space-y-2">
      {items.map((h) => (
        <div key={h.id} className="group flex items-center justify-between rounded-md px-2 py-1 hover:bg-accent/50 transition">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />
            <span className="text-xs capitalize">{h.kind}</span>
          </div>
          <div className="text-[11px] text-muted-foreground">{formatRelativeZH(h.created_at)}</div>
        </div>
      ))}
    </div>
  );
}

