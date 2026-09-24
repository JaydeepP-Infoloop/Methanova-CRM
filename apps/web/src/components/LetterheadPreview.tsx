import { useEffect, useState } from "react";
import { apiBinary } from "../lib/apiClient";

export function LetterheadPreview({
  fileId,
  legalName,
  projectName,
  projectCode,
}: {
  fileId: string | null | undefined;
  legalName: string;
  projectName: string;
  projectCode?: string;
}) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!fileId) {
      setSrc(null);
      return;
    }
    let objectUrl: string | undefined;
    let cancelled = false;
    apiBinary(`/api/files/${fileId}/content`)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        if (!cancelled) setSrc(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setSrc(null);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fileId]);

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <PreviewBand
        className="bg-methanova-greenDark text-white"
        src={src}
        markFallback
        legalName={legalName}
        projectName={projectName}
        projectCode={projectCode}
        caption="On the project header (green)"
      />
      <PreviewBand
        className="bg-white text-slate-900 ring-1 ring-slate-200"
        src={src}
        legalName={legalName}
        projectName={projectName}
        projectCode={projectCode}
        caption="On a document cover (white)"
      />
    </div>
  );
}

function PreviewBand({
  className,
  src,
  markFallback,
  legalName,
  projectName,
  projectCode,
  caption,
}: {
  className: string;
  src: string | null;
  markFallback?: boolean;
  legalName: string;
  projectName: string;
  projectCode?: string;
  caption: string;
}) {
  return (
    <div>
      <div className={`flex items-center gap-3 rounded-lg px-4 py-3 ${className}`}>
        {src ? (
          <img src={src} alt="" className="h-10 w-10 rounded object-contain bg-white/10" />
        ) : markFallback ? (
          <span className="flex h-10 w-10 items-center justify-center rounded bg-methanova-gold text-sm font-semibold text-methanova-greenDark">
            M
          </span>
        ) : (
          <span className="flex h-10 w-10 items-center justify-center rounded bg-slate-100 text-sm font-semibold text-slate-500">
            M
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{projectName}</p>
          <p className={`truncate text-xs ${markFallback ? "text-white/70" : "text-slate-500"}`}>
            {legalName}
            {projectCode ? ` · ${projectCode}` : ""}
          </p>
        </div>
      </div>
      <p className="mt-1 text-xs text-slate-500">{caption}</p>
    </div>
  );
}
