import React, { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  value: string;
  onChange: (next: string) => void;
  streaming: boolean;
  onCopy?: () => void;
};

export function StreamViewer({ value, onChange, streaming, onCopy }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (ref.current && streaming) {
      // keep textarea scrolled to bottom while streaming
      ref.current.scrollTop = ref.current.scrollHeight;
    }
  }, [value, streaming]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="text-sm text-muted-foreground">OCR 结果（Markdown）</div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={onCopy}>复制</Button>
        </div>
      </div>
      <div className="flex-1 overflow-hidden p-2">
        <Textarea
          ref={ref}
          className="h-full min-h-0 resize-none font-mono"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
        />
      </div>
    </div>
  );
}
