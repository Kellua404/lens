"use client";

// components/Dropzone.tsx — drop / paste / pick interaction (PLAN §6).
// Provides the upload surface and forwards a File to onFile. Drag anywhere over it to
// replace the current specimen; paste works window-wide; click or Enter/Space opens the
// native picker. The actual downscale-before-upload happens in the store (PLAN §6/§13).
import { useCallback, useEffect, useRef, useState } from "react";

export function Dropzone({
  onFile,
  children,
  className = "",
  interactive = true,
}: {
  onFile: (file: File) => void;
  children: React.ReactNode;
  className?: string;
  interactive?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);

  const take = useCallback(
    (files: FileList | null | undefined) => {
      const file = files && files[0];
      if (file && file.type.startsWith("image/")) onFile(file);
    },
    [onFile],
  );

  // Window-wide paste (an image in the clipboard) — common for screenshots.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) =>
        i.type.startsWith("image/"),
      );
      const file = item?.getAsFile();
      if (file) {
        e.preventDefault();
        onFile(file);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [onFile]);

  return (
    <div
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? "Upload an image — drop, paste, or click to pick" : undefined}
      className={`relative outline-none ${className} ${
        dragging ? "ring-2 ring-scan" : ""
      }`}
      onClick={interactive ? () => inputRef.current?.click() : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                inputRef.current?.click();
              }
            }
          : undefined
      }
      onDragEnter={(e) => {
        e.preventDefault();
        dragDepth.current += 1;
        setDragging(true);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={(e) => {
        e.preventDefault();
        dragDepth.current -= 1;
        if (dragDepth.current <= 0) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        dragDepth.current = 0;
        setDragging(false);
        take(e.dataTransfer?.files);
      }}
    >
      {children}

      {/* drag affordance */}
      {dragging && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center rounded-[inherit] bg-bg/70 backdrop-blur-[2px]">
          <span className="font-mono text-sm tracking-wide text-scan">
            release to place on the table
          </span>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        aria-label="Upload an image file"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          take(e.target.files);
          e.target.value = ""; // allow re-picking the same file
        }}
      />
    </div>
  );
}
