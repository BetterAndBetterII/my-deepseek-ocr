import { useCallback, useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
  onFiles: (files: File[]) => void;
  accept?: string; // e.g. "image/*,application/pdf"
  children?: React.ReactNode;
  className?: string;
};

export function DropArea({ onFiles, accept = "image/*,application/pdf", children, className }: Props) {
  const [dragging, setDragging] = useState(false);

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    const arr = Array.from(files);
    const allowed = arr.filter(f => f.type.startsWith("image/") || f.type === "application/pdf");
    if (allowed.length > 0) onFiles(allowed);
  }, [onFiles]);

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
  };
  const onDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
  };
  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // only clear when leaving root
    if (e.currentTarget === e.target) setDragging(false);
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    handleFiles(e.dataTransfer?.files || null);
  };

  return (
    <div
      className={cn("relative w-full h-full", className)}
      onDragOver={onDragOver}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {children}
      {/* overlay only visible while dragging */}
      {dragging && (
        <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center bg-background/60 backdrop-blur-sm">
          <div className="rounded-lg border-2 border-dashed border-foreground/40 px-4 py-2 text-sm text-muted-foreground bg-background/80">
            释放文件以重新上传
          </div>
        </div>
      )}
    </div>
  );
}

