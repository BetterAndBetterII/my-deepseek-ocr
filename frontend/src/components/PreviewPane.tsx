type Props = {
  url: string;
  kind: "image" | "pdf";
};

export function PreviewPane({ url, kind }: Props) {
  if (kind === "image") {
    return (
      <div className="w-full h-full flex items-center justify-center bg-muted/30">
        <img src={url} alt="preview" className="max-w-full max-h-full object-contain" />
      </div>
    );
  }
  // pdf
  return (
    <div className="w-full h-full bg-muted/30">
      <object data={url} type="application/pdf" className="w-full h-full">
        <div className="p-3 text-sm text-muted-foreground">
          预览无法内嵌显示。请
          <a href={url} target="_blank" rel="noreferrer" className="underline ml-1">
            在新标签打开
          </a>
        </div>
      </object>
    </div>
  );
}
