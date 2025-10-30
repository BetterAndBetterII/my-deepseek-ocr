import { cn } from "@/lib/utils";
import * as React from "react";

export function Fab({
  icon,
  onClick,
  className,
  label,
}: {
  icon?: React.ReactNode;
  onClick?: () => void;
  className?: string;
  label?: string;
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center gap-2 rounded-full border bg-background/70 backdrop-blur px-3 py-2 shadow-sm hover:bg-accent/60 transition",
        className,
      )}
      onClick={onClick}
    >
      {icon}
      {label ? <span className="text-xs">{label}</span> : null}
    </button>
  );
}
