import { Upload } from "lucide-react";
import { useRef } from "react";

export function FileDrop({
  accept = "image/png,image/jpeg,image/webp",
  hint = "PNG, JPEG or WebP. Max 1 MB. SVG and PDF are refused.",
  disabled,
  onFile,
}: {
  accept?: string;
  hint?: string;
  disabled?: boolean;
  onFile: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-60"
      >
        <Upload className="h-4 w-4" aria-hidden="true" />
        Choose image
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file);
          event.target.value = "";
        }}
      />
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </div>
  );
}
