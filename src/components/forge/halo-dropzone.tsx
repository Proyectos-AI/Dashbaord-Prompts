"use client";

import { FileText, Paperclip, X } from "lucide-react";
import { useRef, useState } from "react";
import type { DragEvent } from "react";

import { ACCEPT_FILES, attachmentLabel, type Attachment } from "@/lib/catalog";
import { cn } from "@/lib/utils";

const formatSize = (bytes: number) =>
  bytes < 1024
    ? `${bytes} B`
    : bytes < 1024 * 1024
      ? `${(bytes / 1024).toFixed(0)} KB`
      : `${(bytes / 1024 / 1024).toFixed(1)} MB`;


/**
 * Upload zone styled after 21st.dev's Halo Dropzone (cult-ui): frosted fill,
 * drifting rim blobs and a light trail running along the border.
 */
export const HaloDropzone = ({
  disabled,
  error,
  files,
  onFiles,
  onRemove,
  reading,
}: {
  reading?: boolean;
  disabled?: boolean;
  error?: string | null;
  files: Attachment[];
  onFiles: (files: File[]) => void;
  onRemove: (id: string) => void;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    if (!disabled) onFiles(Array.from(event.dataTransfer.files));
  };

  return (
    <div className="flex flex-col gap-2">
      <div
        className={cn(
          "group relative isolate overflow-hidden rounded-2xl ring-1 ring-white/10 transition",
          dragging && "ring-white/40",
          error && "ring-rose-400/50"
        )}
        onDragLeave={() => setDragging(false)}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDrop={onDrop}
      >
        {/* Rim blobs */}
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-3/5 opacity-50 transition-opacity duration-300 group-hover:opacity-80",
            dragging && "opacity-100"
          )}
        >
          <div className="pf-blob absolute -bottom-10 h-24 w-48 bg-[linear-gradient(90deg,#ff0080,#7928ca,#00d4ff)] blur-2xl [animation:pf-blob-a_6s_ease-in-out_infinite]" />
          <div className="pf-blob absolute -bottom-8 h-20 w-36 bg-[linear-gradient(90deg,#e06443,#f9cb28,#ff0080)] blur-2xl [animation:pf-blob-b_5s_ease-in-out_infinite]" />
        </div>
        {/* Frosted fill */}
        <div
          aria-hidden="true"
          className="absolute inset-[1px] -z-10 rounded-[15px] bg-[linear-gradient(to_bottom,rgb(18_18_20/0.92),rgb(18_18_20/0.75))] backdrop-blur-xl"
        />
        {/* Border trail */}
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-0 rounded-[inherit] border border-transparent opacity-0 transition-opacity [mask-clip:padding-box,border-box] [mask-composite:intersect] [mask-image:linear-gradient(transparent,transparent),linear-gradient(#000,#000)] group-hover:opacity-100",
            dragging && "opacity-100"
          )}
        >
          <div className="pf-trail absolute h-6 w-32 [animation:pf-trail_5s_linear_infinite] [offset-path:rect(0_auto_auto_0_round_16px)]">
            <div className="size-full rounded-full bg-[linear-gradient(90deg,transparent,rgba(255,0,128,0.7),rgba(200,140,255,0.9),rgba(0,212,255,0.8),transparent)] blur-[3px]" />
          </div>
        </div>

        <button
          className="flex w-full flex-col items-center gap-1.5 px-4 py-4 text-center disabled:cursor-not-allowed disabled:opacity-50"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          type="button"
        >
          <span className="grid size-8 place-items-center rounded-full bg-white/10 ring-1 ring-white/15 transition group-hover:scale-110">
            <Paperclip className="size-3.5 text-white" />
          </span>
          <span className="text-xs font-medium text-white">
            {reading ? "Leyendo archivos…" : dragging ? "Suéltalos aquí" : "Arrastra o elige archivos"}
          </span>
          <span className="text-[0.6875rem] text-white/45">
            PDF, Excel, Word, PowerPoint, CSV, código o imágenes · máx. 5
          </span>
        </button>
        <input
          accept={ACCEPT_FILES}
          className="sr-only"
          multiple
          onChange={(event) => {
            onFiles(Array.from(event.target.files ?? []));
            event.target.value = "";
          }}
          ref={inputRef}
          tabIndex={-1}
          type="file"
        />
      </div>

      {error && <p className="text-[0.6875rem] text-rose-300">{error}</p>}

      {files.length > 0 && (
        <ul className="flex flex-col gap-1">
          {files.map((file) => (
            <li
              className="flex items-center gap-2 rounded-lg bg-white/[0.04] px-2 py-1.5 text-xs ring-1 ring-white/10"
              key={file.id}
            >
              {file.kind === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt=""
                  className="size-6 rounded object-cover"
                  src={`data:${file.mediaType};base64,${file.data}`}
                />
              ) : (
                <span
                  className={cn(
                    "grid size-6 place-items-center rounded",
                    file.kind === "pdf" ? "bg-rose-500/20 text-rose-300" : "bg-sky-500/15 text-sky-300"
                  )}
                >
                  {file.kind === "pdf" ? (
                    <span className="text-[0.5rem] font-bold">PDF</span>
                  ) : (
                    <FileText className="size-3.5" />
                  )}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-white/85">{file.name}</span>
                <span className="text-[0.625rem] text-white/40">
                  {formatSize(file.size)} · {attachmentLabel(file)}
                </span>
              </span>
              <button
                aria-label={`Quitar ${file.name}`}
                className="rounded p-0.5 text-white/40 transition hover:bg-white/10 hover:text-white"
                onClick={() => onRemove(file.id)}
                type="button"
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
