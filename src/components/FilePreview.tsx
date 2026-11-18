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

export function FilePreview({
  fileId,
  className = "",
}: {
  fileId: string;
  className?: string;
}) {
  const { t } = useI18n();
  const [meta, setMeta] = useState<FileMeta | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api
      .get(`/files/${fileId}`)
      .then((r) => {
        if (!cancelled) setMeta(r.data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fileId]);

  if (loading) {
    return (
      <div
        className={`flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 bg-slate-50/70 animate-pulse text-xs text-muted-foreground ${className}`}
      >
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <span>...</span>
      </div>
    );
  }

  if (!meta) return null;

  const isImage = meta.content_type?.startsWith("image/");
  const isPdf = meta.content_type === "application/pdf";
  const url = fileDownloadUrl(fileId);

  if (isImage) {
    return (
      <FileViewButton
        fileId={fileId}
        className={`block text-left transition hover:opacity-95 ${className}`}
        testid={`file-preview-${fileId}`}
      >
        <div className="group relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50 shadow-xs hover:border-primary/40 transition">
          <img
            src={url}
            alt={meta.original_filename}
            className="max-h-64 sm:max-h-72 w-auto max-w-full rounded-lg object-contain bg-slate-900/5 group-hover:scale-[1.01] transition-transform duration-200"
            loading="lazy"
          />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-2.5 text-white flex items-center justify-between gap-2 opacity-90 group-hover:opacity-100 transition-opacity">
            <span className="text-xs font-medium truncate max-w-[80%]">
              {meta.original_filename}
            </span>
            <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded backdrop-blur-xs shrink-0">
              {Math.max(1, Math.round(meta.size / 1024))} KB
            </span>
          </div>
        </div>
      </FileViewButton>
    );
  }

  return (
    <div
      className={`flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 p-3 rounded-lg border border-slate-200 bg-slate-50/90 hover:bg-slate-100/90 hover:border-primary/40 transition shadow-xs ${className}`}
      data-testid={`file-preview-${fileId}`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-red-100 text-red-600">
          <FileText className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-800 truncate">
            {meta.original_filename}
          </p>
          <p className="text-[11px] text-muted-foreground tabular-nums">
            {isPdf ? "PDF Document" : meta.content_type} · {Math.max(1, Math.round(meta.size / 1024))} KB
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 ms-auto">
        <FileViewButton fileId={fileId}>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
            <FileText className="h-3.5 w-3.5" />
            <span>{t("view")}</span>
          </Button>
        </FileViewButton>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          download={meta.original_filename}
        >
          <Button variant="secondary" size="sm" className="h-8 gap-1.5 text-xs">
            <Download className="h-3.5 w-3.5" />
            <span>PDF</span>
          </Button>
        </a>
      </div>
    </div>
  );
}

export default FilePreview;
