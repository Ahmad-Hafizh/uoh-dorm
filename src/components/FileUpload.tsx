"use client";
import axios from "axios";
import { useState, useEffect } from "react";
import imageCompression from "browser-image-compression";
import { api, API, formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Upload, FileText, X, Eye } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/context/I18nContext";
import { FileViewButton } from "@/components/FilePreview";

export function fileDownloadUrl(fileId: string) {
  return `${API}/files/${encodeURIComponent(fileId)}/download`;
}

export interface FileMeta { id: string; original_filename: string; content_type: string; size: number }
export default function FileUpload({ kind = "general", value, onChange, label, accept = "image/*,.pdf" }: { kind?: string; value: string | null; onChange?(id: string | null): void; label?: string; accept?: string }) {
  const { t } = useI18n();
  const [meta, setMeta] = useState<FileMeta | null>(null);
  const [uploading, setUploading] = useState(false);
  const [phase, setPhase] = useState(""); // "compressing" | "uploading" | ""

  useEffect(() => {
    let cancelled = false;
    if (value) {
      if (meta?.id === value) return;
      api.get(`/files/${value}`)
        .then((r) => { if (!cancelled) setMeta(r.data); })
        .catch(() => { if (!cancelled) setMeta(null); });
    } else {
      setMeta(null);
    }
    return () => { cancelled = true; };
    // eslint-disable-next-line
  }, [value]);

  const onSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    let file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error(t("file_too_large"));
      e.target.value = "";
      return;
    }
    setUploading(true);
    try {
      // Client-side compression + EXIF rotation for images (never PDFs)
      if (file.type.startsWith("image/")) {
        setPhase("compressing");
        try {
          file = await imageCompression(file, {
            maxSizeMB: 0.5,
            maxWidthOrHeight: 2000,
            useWebWorker: true,
            fileType: "image/jpeg",
            initialQuality: 0.85,
          });
        } catch (compErr) {
          // If compression fails, upload original
          console.warn("compression failed, uploading original", compErr);
        }
      }
      setPhase("uploading");
      const fd = new FormData();
      const outName = file.name || `upload-${Date.now()}.jpg`;
      fd.append("file", file, outName);
      fd.append("kind", kind);
      const { data } = await api.post("/files/upload", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setMeta(data);
      onChange && onChange(data.id);
      toast.success(t("upload") + " ✓");
    } catch (err) {
      toast.error(formatApiError(axios.isAxiosError(err) ? err.response?.data?.detail : undefined));
    } finally {
      setUploading(false);
      setPhase("");
      e.target.value = "";
    }
  };

  const clear = () => {
    setMeta(null);
    onChange && onChange(null);
  };

  if (meta) {
    return (
      <div
        className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 p-2.5"
        data-testid={`file-preview-${kind}`}
      >
        <FileText className="h-4 w-4 text-primary shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium truncate">{meta.original_filename}</div>
          <div className="text-[10px] text-muted-foreground tabular-nums">
            {Math.max(1, Math.round(meta.size / 1024))} KB
          </div>
        </div>
        <FileViewButton
          fileId={meta.id}
          className="h-8 w-8 grid place-items-center rounded-md hover:bg-slate-200/70 text-slate-600"
          testid={`file-view-${kind}`}
        >
          <Eye className="h-3.5 w-3.5" />
        </FileViewButton>
        <Button
          type="button" size="sm" variant="ghost"
          className="h-8 w-8 p-0 text-destructive"
          onClick={clear}
          data-testid={`file-remove-${kind}`}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }
  return (
    <label
      className={`flex items-center justify-center gap-2 rounded-md border border-dashed border-slate-300 bg-slate-50/60 p-3 text-sm cursor-pointer transition-colors ${
        uploading ? "opacity-60 cursor-wait" : "hover:bg-slate-100 hover:border-primary/40"
      }`}
      data-testid={`file-drop-${kind}`}
    >
      <Upload className="h-4 w-4 text-muted-foreground" />
      <span className="text-muted-foreground">
        {uploading
          ? (phase === "compressing" ? t("compressing") : phase === "uploading" ? t("uploading") : "…")
          : (label || t("upload"))}
      </span>
      <input
        type="file" className="hidden" onChange={onSelect} disabled={uploading}
        accept={accept} data-testid={`file-input-${kind}`}
      />
    </label>
  );
}
