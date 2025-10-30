import { useAuth } from "@/lib/auth";
import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UploadDropzone } from "@/components/UploadDropzone";
import { Button } from "@/components/ui/button";
import { uploadAndStream, usageList, usageSummary, type OCRKind, type UsageEvent, type UsageSummary as UsageSum } from "@/lib/api";
import { formatBytes, formatNumber, formatRelativeZH } from "@/lib/utils";
import { StreamViewer } from "@/components/StreamViewer";
import { PdfStreamViewer } from "@/components/PdfStreamViewer";
import { PreviewPane } from "@/components/PreviewPane";
import { MetricsPills } from "@/components/MetricsPills";
import { CompactHistory } from "@/components/CompactHistory";
import { Fab } from "@/components/Fab";
import { History, BarChart3 } from "lucide-react";

export default function Dashboard() {
  const { token, authDisabled } = useAuth();
  const [streaming, setStreaming] = useState(false);
  const [result, setResult] = useState("");
  const [isPdf, setIsPdf] = useState(false);
  const [pages, setPages] = useState<{ page: number; content: string }[]>([]);
  const [preview, setPreview] = useState<{ url: string; kind: 'image' | 'pdf' } | null>(null);
  const ctrlRef = useRef<AbortController | null>(null);
  const [summary, setSummary] = useState<UsageSum | null>(null);
  const [history, setHistory] = useState<UsageEvent[]>([]);
  const [insightsOpen, setInsightsOpen] = useState(false);

  const refreshUsage = useCallback(async () => {
    if (!token && !authDisabled) return;
    try {
      const [s, l] = await Promise.all([usageSummary(token), usageList(token)]);
      setSummary(s); setHistory(l);
    } catch {}
  }, [token, authDisabled]);

  useEffect(() => { refreshUsage(); }, [token, refreshUsage]);

  const onFiles = useCallback(async (files: File[]) => {
    if (!token && !authDisabled) return;
    const file = files[0];
    setResult("");
    setPages([]);
    setIsPdf(file.type === "application/pdf");
    // set preview URL
    const kind = file.type === "application/pdf" ? "pdf" : "image";
    const url = URL.createObjectURL(file);
    setPreview({ url, kind });
    setStreaming(true);
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    
    try {
      if (kind === "pdf") {
        let lastLen = 0;
        let jsonBuf = "";
        const pageMap = new Map<number, string>();
        let declaredPages: number | undefined;
        const updatePages = () => {
          const arr = Array.from(pageMap.entries())
            .sort((a, b) => a[0] - b[0])
            .map(([page, content]) => ({ page, content }));
          setPages(arr);
        };
        await uploadAndStream(
          token || undefined,
          file,
          kind as OCRKind,
          (buf) => {
            const delta = buf.slice(lastLen);
            lastLen = buf.length;
            if (!delta) return;
            jsonBuf += delta;
            let idx: number;
            let progressed = false;
            while ((idx = jsonBuf.indexOf('\n')) !== -1) {
              const line = jsonBuf.slice(0, idx).trim();
              jsonBuf = jsonBuf.slice(idx + 1);
              if (!line) continue;
              try {
                const obj = JSON.parse(line);
                // Recognize control frames
                if (obj?.type === 'start' && obj?.kind === 'pdf') {
                  if (typeof obj.pages === 'number' && obj.pages > 0) {
                    declaredPages = obj.pages;
                    for (let p = 1; p <= obj.pages; p++) {
                      if (!pageMap.has(p)) pageMap.set(p, "");
                    }
                    progressed = true;
                  }
                  continue;
                }
                if (obj?.type === 'page_start' && typeof obj.page === 'number') {
                  const p = obj.page as number;
                  if (!pageMap.has(p)) pageMap.set(p, "");
                  progressed = true;
                  continue;
                }
                // Data frames
                if (typeof obj?.page === 'number' && typeof obj?.delta === 'string') {
                  const p = obj.page as number;
                  pageMap.set(p, (pageMap.get(p) || "") + obj.delta);
                  progressed = true;
                } else if (obj?.type === 'delta' && typeof obj?.page === 'number' && typeof obj?.delta === 'string') {
                  const p = obj.page as number;
                  pageMap.set(p, (pageMap.get(p) || "") + obj.delta);
                  progressed = true;
                }
              } catch {
                // ignore non-JSON lines
              }
            }
            if (progressed) updatePages();
          },
          ctrl.signal
        );
        // parse any remaining buffered line at end
        const tail = jsonBuf.trim();
        if (tail) {
          try {
            const obj = JSON.parse(tail);
            if (obj?.type === 'start' && obj?.kind === 'pdf') {
              if (typeof obj.pages === 'number' && obj.pages > 0) {
                declaredPages = obj.pages;
                for (let p = 1; p <= obj.pages; p++) {
                  if (!pageMap.has(p)) pageMap.set(p, "");
                }
              }
            } else if (obj?.type === 'page_start' && typeof obj.page === 'number') {
              const p = obj.page as number;
              if (!pageMap.has(p)) pageMap.set(p, "");
            } else if (typeof obj?.page === 'number' && typeof obj?.delta === 'string') {
              const p = obj.page as number;
              pageMap.set(p, (pageMap.get(p) || "") + obj.delta);
            } else if (obj?.type === 'delta' && typeof obj?.page === 'number' && typeof obj?.delta === 'string') {
              const p = obj.page as number;
              pageMap.set(p, (pageMap.get(p) || "") + obj.delta);
            }
            updatePages();
          } catch { /* ignore */ }
        }
      } else {
        let lastLen = 0;
        let jsonBuf = "";
        await uploadAndStream(
          token || undefined,
          file,
          kind as OCRKind,
          (buf) => {
            const delta = buf.slice(lastLen);
            lastLen = buf.length;
            if (!delta) return;
            jsonBuf += delta;
            let idx: number;
            while ((idx = jsonBuf.indexOf('\n')) !== -1) {
              const line = jsonBuf.slice(0, idx).trim();
              jsonBuf = jsonBuf.slice(idx + 1);
              if (!line) continue;
              try {
                const obj = JSON.parse(line);
                if (typeof obj?.delta === 'string') {
                  setResult((prev) => prev + obj.delta);
                } else if (typeof obj?.content === 'string') {
                  // alias support if backend uses `content`
                  setResult((prev) => prev + obj.content);
                } else if (typeof obj?.text === 'string') {
                  setResult((prev) => prev + obj.text);
                }
              } catch {
                // ignore non-JSON lines
              }
            }
          },
          ctrl.signal
        );
        const tail = jsonBuf.trim();
        if (tail) {
          try {
            const obj = JSON.parse(tail);
            if (typeof obj?.delta === 'string') setResult((prev) => prev + obj.delta);
            else if (typeof obj?.content === 'string') setResult((prev) => prev + obj.content);
            else if (typeof obj?.text === 'string') setResult((prev) => prev + obj.text);
          } catch { /* ignore */ }
        }
      }
    } catch (e) {
      setResult(prev => prev + "\n\n[流读取结束或中断]");
    } finally {
      setStreaming(false);
      ctrlRef.current = null;
      // update usage
      refreshUsage();
    }
  }, [token, authDisabled, refreshUsage]);

  // Revoke old object URLs when preview changes or on unmount
  const prevUrlRef = useRef<string | null>(null);
  useEffect(() => {
    if (prevUrlRef.current && prevUrlRef.current !== preview?.url) {
      try { URL.revokeObjectURL(prevUrlRef.current); } catch {}
    }
    prevUrlRef.current = preview?.url ?? null;
    return () => {
      if (prevUrlRef.current) {
        try { URL.revokeObjectURL(prevUrlRef.current); } catch {}
      }
    };
  }, [preview?.url]);

  // Global paste handler: Ctrl+V anywhere on the page to start OCR
  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      if (!token && !authDisabled) return;
      // allow normal paste inside inputs/textareas/contenteditable
      const ae = document.activeElement as HTMLElement | null;
      if (ae) {
        const tag = ae.tagName?.toLowerCase();
        const ce = ae.getAttribute('contenteditable');
        if (tag === 'input' || tag === 'textarea' || ce === 'true') return;
      }
      const dt = e.clipboardData;
      if (!dt) return;
      const files: File[] = [];
      const items = dt.items ? Array.from(dt.items) : [];
      for (const it of items) {
        if (it.kind === 'file') {
          const f = it.getAsFile();
          if (f && (f.type.startsWith('image/') || f.type === 'application/pdf')) files.push(f);
        }
      }
      if (files.length === 0 && dt.files && dt.files.length > 0) {
        for (const f of Array.from(dt.files)) {
          if (f && (f.type.startsWith('image/') || f.type === 'application/pdf')) files.push(f);
        }
      }
      if (files.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        onFiles(files);
      }
    };
    window.addEventListener('paste', handler);
    return () => window.removeEventListener('paste', handler);
  }, [token, authDisabled, onFiles]);

  const stop = () => {
    ctrlRef.current?.abort();
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(result); } catch {}
  };

  return (
    <div className="mx-auto max-w-6xl p-4 grid gap-4">
      <div className="grid gap-4">
        {!preview && (
          <Card>
            <CardHeader className="flex items-center justify-between flex-row">
              <CardTitle>上传</CardTitle>
              <div className="flex gap-2">
                {streaming && <Button variant="destructive" size="sm" onClick={stop}>停止</Button>}
              </div>
            </CardHeader>
            <CardContent>
              <UploadDropzone onFiles={onFiles} />
            </CardContent>
          </Card>
        )}

        {(preview || result || pages.length > 0) && (
          <Card className="min-h-[360px] h-[80vh] flex flex-col">
            <CardHeader className="flex items-center justify-between flex-row">
              <CardTitle>识别结果</CardTitle>
              <div className="flex gap-2">
                {streaming && <Button variant="destructive" size="sm" onClick={stop}>停止</Button>}
                <Button variant="secondary" size="sm" onClick={() => {
                  setResult(""); setPages([]); setIsPdf(false); setPreview(null);
                }}>重新上传</Button>
              </div>
            </CardHeader>
            <CardContent className="relative flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* compact metrics overlay - moved to bottom-left to avoid covering actions */}
              <div className="absolute left-3 bottom-3 z-10"><MetricsPills summary={summary} /></div>
              <div className="border rounded-md overflow-hidden flex flex-col min-h-0">
                <div className="flex items-center justify-between border-b px-3 py-2 text-sm text-muted-foreground">预览</div>
                <div className="flex-1 min-h-0">
                  {preview ? (
                  <PreviewPane url={preview.url} kind={preview.kind} />
                ) : (
                  <div className="h-full flex items-center justify-center text-sm text-muted-foreground">等待上传以预览</div>
                )}
                </div>
              </div>
              <div className="border rounded-md overflow-hidden flex flex-col min-h-0">
                {isPdf ? (
                  <PdfStreamViewer
                    pages={pages}
                    onChangePage={(p, next) => setPages((arr) => arr.map((it) => it.page === p ? { ...it, content: next } : it))}
                    streaming={streaming}
                    onCopyAll={() => {
                      const all = pages.map(p => `# Page ${p.page}\n\n${p.content}`).join("\n\n");
                      navigator.clipboard.writeText(all).catch(() => {});
                    }}
                  />
                ) : (
                  <StreamViewer value={result} onChange={setResult} streaming={streaming} onCopy={copy} />
                )}
              </div>
              {/* floating insights toggle */}
              <div className="absolute right-3 bottom-3 z-10">
                <Fab icon={<History className="h-4 w-4"/>} label="近期" onClick={() => setInsightsOpen(true)} />
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      {/* insights side panel */}
      {insightsOpen && (
        <div className="fixed inset-0 z-20" onClick={() => setInsightsOpen(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <div className="absolute right-4 top-20 w-[320px] max-h-[70vh] overflow-auto rounded-xl border bg-background/70 backdrop-blur shadow-lg" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm"><BarChart3 className="h-4 w-4"/> 用量与记录</div>
              <button className="text-xs text-muted-foreground" onClick={() => setInsightsOpen(false)}>关闭</button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <div className="text-xs text-muted-foreground mb-2">汇总</div>
                {summary ? (
                  <div className="text-xs grid grid-cols-2 gap-x-3 gap-y-1">
                    <div className="text-muted-foreground">总次数</div><div>{formatNumber(summary.total_events)}</div>
                    <div className="text-muted-foreground">输入</div><div>{formatBytes(summary.total_input_bytes)} ({formatNumber(summary.total_input_bytes)})</div>
                    <div className="text-muted-foreground">提示字符</div><div>{formatNumber(summary.total_prompt_chars)}</div>
                    <div className="text-muted-foreground">结果字符</div><div>{formatNumber(summary.total_completion_chars)}</div>
                    <div className="text-muted-foreground">提示 Token</div><div>{formatNumber(summary.total_prompt_tokens)}</div>
                    <div className="text-muted-foreground">结果 Token</div><div>{formatNumber(summary.total_completion_tokens)}</div>
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">暂无数据</div>
                )}
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-2">近期</div>
                <CompactHistory list={history} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
