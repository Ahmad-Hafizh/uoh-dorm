"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { fileDownloadUrl, type FileMeta } from "@/components/FileUpload";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, FileText, FileWarning, Loader2 } from "lucide-react";
import { useI18n } from "@/context/I18nContext";
function PreviewBody({ meta, fileId }: { meta: FileMeta | null; fileId: string }) {
  const { t } = useI18n();
  if (!meta) {
    return (
      <div className="flex items-center justify-center h-96 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  const url = fileDownloadUrl(fileId);
  const ct = meta.content_type || "";
  if (ct.startsWith("image/")) {
    return (
      <div className="grid place-items-center bg-slate-50 rounded-md p-4 max-h-[70vh] overflow-auto">
        <img
          src={url}
          alt={meta.original_filename}
          className="max-w-full max-h-[65vh] object-contain rounded"
        />
      </div>
    );
  }
  if (ct === "application/pdf") {
    return (
      <iframe
        title={meta.original_filename}
        src={url}
        className="w-full h-[70vh] rounded-md border border-slate-200 bg-slate-50"
      />
    );
  }
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground rounded-md bg-slate-50 border border-slate-200 border-dashed p-8">
      <FileWarning className="h-8 w-8 opacity-60" />
      <div className="text-sm text-center">
        {t("no_data")} · {ct || "file"}
      </div>
    </div>
  );
}

export function FileThumb({ fileId, label, testid }: { fileId: string; label: string; testid?: string }) {
  const [meta, setMeta] = useState<FileMeta | null>(null);
  useEffect(() => {
    let cancelled = false;
    api.get(`/files/${fileId}`).then((r) => { if (!cancelled) setMeta(r.data); }).catch(() => {});
    return () => { cancelled = true; };
  }, [fileId]);
  const isImage = meta?.content_type?.startsWith("image/");
  const url = fileDownloadUrl(fileId);
  return (
    <FileViewButton
      fileId={fileId}
      className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white ps-0.5 pe-2 py-0.5 hover:border-primary/40 hover:bg-primary/5 transition-colors"
      testid={testid}
    >
      {isImage ? (
        <img
          src={url}
          alt={label}
          className="h-7 w-7 rounded-full object-cover ring-1 ring-slate-200"
          loading="lazy"
        />
      ) : (
        <span className="grid h-7 w-7 place-items-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/15">
          <FileText className="h-3.5 w-3.5" />
        </span>
      )}
      <span className="text-[10px] font-medium">{label}</span>
    </FileViewButton>
  );
}

export function FileViewButton({ fileId, children, className = "", testid }: { fileId: string; children: React.ReactNode; className?: string; testid?: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(false);
  const [meta, setMeta] = useState<FileMeta | null>(null);

  useEffect(() => {
    if (!open || meta || error) return;
    let cancelled = false;
    api.get(`/files/${fileId}`)
      .then((r) => { if (!cancelled) setMeta(r.data); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [open, meta, fileId, error]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={className}
        data-testid={testid}
      >
        {children}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 truncate">
              <FileText className="h-4 w-4 text-primary shrink-0" />
              <span className="truncate">{meta?.original_filename || t("view")}</span>
            </DialogTitle>
          </DialogHeader>
          {error ? <p role="alert">Unable to load this file.</p> : <PreviewBody meta={meta} fileId={fileId} />}
          <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-slate-100">
            <span className="tabular-nums">
              {meta ? `${Math.max(1, Math.round(meta.size / 1024))} KB · ${meta.content_type}` : ""}
            </span>
            <a href={fileDownloadUrl(fileId)} target="_blank" rel="noreferrer" download data-testid="preview-download">
              <Button variant="outline" size="sm" className="gap-2">
                <Download className="h-3.5 w-3.5" /> {t("view")}
              </Button>
            </a>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
