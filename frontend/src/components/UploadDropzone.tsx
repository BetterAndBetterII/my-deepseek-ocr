import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ImageDown, FileUp } from "lucide-react";

type Props = {
  onFiles: (files: File[]) => void;
  accept?: string;
};

export function UploadDropzone({ onFiles, accept = "image/*,application/pdf" }: Props) {
  const [isDragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const openPicker = () => inputRef.current?.click();

  const handleFiles = useCallback((files: FileList | File[] | null) => {
    if (!files) return;
    const arr = Array.from(files);
    const allowed = arr.filter(f => f.type.startsWith("image/") || f.type === "application/pdf");
    if (allowed.length) onFiles(allowed);
  }, [onFiles]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    handleFiles(e.dataTransfer?.files || null);
  };
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
  };
  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
  };

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.files || null;
      if (items && items.length > 0) {
        e.preventDefault();
        handleFiles(items);
      }
    };
    el.addEventListener('paste', onPaste);
    return () => el.removeEventListener('paste', onPaste);
  }, [handleFiles]);

  return (
    <div ref={rootRef}
      className={cn(
        "relative rounded-md border border-dashed p-6 text-center transition-colors focus-within:outline-none focus-within:ring-2 focus-within:ring-ring",
        isDragging ? "bg-accent" : "bg-background"
      )}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      tabIndex={0}
    >
      <input
        type="file"
        ref={inputRef}
        className="hidden"
        accept={accept}
        multiple
        onChange={(e) => handleFiles(e.target.files)}
      />
      <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
        <ImageDown className="h-6 w-6"/>
        <div>粘贴、拖拽或点击上传图片/PDF</div>
        <div className="text-xs">支持 PNG / JPG / WEBP / PDF</div>
        <div className="mt-2">
          <Button size="sm" onClick={openPicker}><FileUp className="h-4 w-4 mr-2"/>选择文件</Button>
        </div>
      </div>
    </div>
  );
}

