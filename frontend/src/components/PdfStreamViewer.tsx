import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export type PageData = { page: number; content: string };

type Props = {
  pages: PageData[];
  onChangePage: (page: number, next: string) => void;
  streaming?: boolean;
  onCopyAll?: () => void;
};

export function PdfStreamViewer({ pages, onChangePage, streaming, onCopyAll }: Props) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="text-sm text-muted-foreground">PDF OCR 结果</div>
        <div className="flex items-center gap-2">
          {onCopyAll ? <Button size="sm" variant="outline" onClick={onCopyAll}>复制全部</Button> : null}
        </div>
      </div>
      <div className="flex-1 overflow-auto p-2 space-y-3">
        {pages.length === 0 && (
          <div className="text-sm text-muted-foreground px-2">等待内容...</div>
        )}
        {pages.map(({ page, content }) => (
          <div key={page} className="border rounded-md">
            <div className="border-b px-3 py-1.5 text-xs text-muted-foreground">Page {page}</div>
            <div className="p-2">
              <Textarea
                className="min-h-[160px] w-full resize-y font-mono"
                value={content}
                spellCheck={false}
                onChange={(e) => onChangePage(page, e.target.value)}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

