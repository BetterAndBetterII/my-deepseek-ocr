import { useAuth } from "@/lib/auth";
import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UploadDropzone } from "@/components/UploadDropzone";
import { Button } from "@/components/ui/button";
import { uploadAndStream, usageList, usageSummary } from "@/lib/api";
import { StreamViewer } from "@/components/StreamViewer";

export default function Dashboard() {
  const { token } = useAuth();
  const [streaming, setStreaming] = useState(false);
  const [result, setResult] = useState("");
  const ctrlRef = useRef<AbortController | null>(null);
  const [summary, setSummary] = useState<any | null>(null);
  const [history, setHistory] = useState<any[]>([]);

  const refreshUsage = async () => {
    if (!token) return;
    try {
      const [s, l] = await Promise.all([usageSummary(token), usageList(token)]);
      setSummary(s); setHistory(l);
    } catch {}
  };

  useEffect(() => { refreshUsage(); }, [token]);

  const onFiles = async (files: File[]) => {
    if (!token) return;
    const file = files[0];
    setResult("");
    setStreaming(true);
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    const kind = file.type === "application/pdf" ? "pdf" : "image";
    try {
      await uploadAndStream(token, file, kind, (buf) => setResult(buf), ctrl.signal);
    } catch (e) {
      setResult(prev => prev + "\n\n[流读取结束或中断]");
    } finally {
      setStreaming(false);
      ctrlRef.current = null;
      // update usage
      refreshUsage();
    }
  };

  const stop = () => {
    ctrlRef.current?.abort();
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(result); } catch {}
  };

  return (
    <div className="mx-auto max-w-6xl p-4 grid gap-4 md:grid-cols-3">
      <div className="md:col-span-2 grid gap-4">
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

        <Card className="min-h-[360px] h-[50vh]">
          <StreamViewer content={result} streaming={streaming} onCopy={copy} />
        </Card>
      </div>
      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>用量统计</CardTitle>
          </CardHeader>
          <CardContent>
            {summary ? (
              <div className="text-sm grid grid-cols-2 gap-x-3 gap-y-2">
                <div className="text-muted-foreground">总次数</div><div>{summary.total_events}</div>
                <div className="text-muted-foreground">输入字节</div><div>{summary.total_input_bytes}</div>
                <div className="text-muted-foreground">提示字符</div><div>{summary.total_prompt_chars}</div>
                <div className="text-muted-foreground">结果字符</div><div>{summary.total_completion_chars}</div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">暂无数据</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>近期记录</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <div className="space-y-2 max-h-[40vh] overflow-auto">
              {history.length === 0 && <div className="text-muted-foreground">暂无</div>}
              {history.map((h) => (
                <div key={h.id} className="flex items-center justify-between border-b pb-2 last:border-b-0 last:pb-0">
                  <div className="capitalize">{h.kind}</div>
                  <div className="text-muted-foreground">{new Date(h.created_at).toLocaleString()}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

