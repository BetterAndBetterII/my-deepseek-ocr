import React, { useEffect, useMemo, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";

type Props = {
  content: string;
  streaming: boolean;
  onCopy?: () => void;
};

export function StreamViewer({ content, streaming, onCopy }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (streaming && ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight;
    }
  }, [content, streaming]);

  const text = useMemo(() => content, [content]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="text-sm text-muted-foreground">OCR 结果（Markdown）</div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={onCopy}>复制</Button>
        </div>
      </div>
      <div ref={ref} className="flex-1 overflow-auto p-4">
        <ReactMarkdown>{text || ""}</ReactMarkdown>
      </div>
    </div>
  );
}
