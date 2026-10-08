"use client";

import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, DragEvent, ReactNode } from "react";
import {
  AlertCircle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CheckCircle2,
  Download,
  FileText,
  FileUp,
  GripVertical,
  Info,
  Loader2,
  Merge,
  Plus,
  RotateCcw,
  ShieldCheck,
  X,
} from "lucide-react";

/* -------------------------------------------------------------------------- */
/*  Config                                                                    */
/* -------------------------------------------------------------------------- */

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB per PDF
const MAX_FILES = 20;
const PDF_MIME = "application/pdf";
const OUTPUT_NAME = "fixkit-merged.pdf";

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(mb < 10 ? 2 : 1)} MB`;
}

/** Lets React paint a status update before heavy synchronous work continues. */
function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
}

/** Quick signature check: a real PDF has "%PDF-" near the start of the file. */
async function hasPdfSignature(file: File): Promise<boolean> {
  const head = new Uint8Array(await file.slice(0, 1024).arrayBuffer());
  const text = new TextDecoder("latin1").decode(head);
  return text.includes("%PDF-");
}

/** Identifies the exact same file selected twice. */
function fileKey(file: File): string {
  return `${file.name}::${file.size}::${file.lastModified}`;
}

/**
 * Loads a PDF with pdf-lib and returns its page count.
 * Encrypted PDFs are rejected because pdf-lib can't copy their pages reliably.
 */
async function readPageCount(file: File): Promise<number> {
  const { PDFDocument } = await import("pdf-lib");
  const bytes = new Uint8Array(await file.arrayBuffer());
  try {
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    const count = doc.getPageCount();
    if (count < 1) throw new Error("empty");
    return count;
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (/encrypt/i.test(message)) {
      throw new Error("encrypted");
    }
    throw new Error("unreadable");
  }
}

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

type PdfItem = {
  id: string;
  key: string;
  file: File;
  pageCount: number;
};

type MergeResult = {
  url: string;
  size: number;
  fileCount: number;
  totalPages: number;
  originalSize: number;
};

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `pdf-${idCounter}`;
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                 */
/* -------------------------------------------------------------------------- */

export default function PdfMerger() {
  const inputRef = useRef<HTMLInputElement>(null);

  const [items, setItems] = useState<PdfItem[]>([]);
  const [result, setResult] = useState<MergeResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Drag-reorder state
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  // Revoke the download URL whenever it is replaced or the component unmounts.
  useEffect(() => {
    if (!result) return;
    const url = result.url;
    return () => URL.revokeObjectURL(url);
  }, [result]);

  const busy = isAdding || isProcessing;

  /* ------------------------------ Adding files ---------------------------- */

  const addFiles = async (incoming: File[]) => {
    if (incoming.length === 0) {
      setError("Please select a PDF file.");
      return;
    }

    setError(null);
    setNotice(null);
    setResult(null);
    setIsAdding(true);
    await nextFrame();

    const problems: string[] = [];
    const accepted: PdfItem[] = [];
    const seen = new Set(items.map((i) => i.key));
    let slots = MAX_FILES - items.length;

    try {
      for (const file of incoming) {
        if (slots <= 0) {
          problems.push(`You can merge up to ${MAX_FILES} PDFs. Extra files were skipped.`);
          break;
        }

        const isPdfType = file.type === PDF_MIME;
        if (!isPdfType) {
          problems.push(`"${file.name}" isn't a PDF. Please select a PDF file.`);
          continue;
        }
        if (file.size === 0) {
          problems.push(`"${file.name}" is empty.`);
          continue;
        }
        if (file.size > MAX_FILE_SIZE_BYTES) {
          problems.push(`"${file.name}" is larger than the ${formatBytes(MAX_FILE_SIZE_BYTES)} limit.`);
          continue;
        }

        const key = fileKey(file);
        if (seen.has(key)) {
          problems.push(`"${file.name}" is already in the list.`);
          continue;
        }

        if (!(await hasPdfSignature(file))) {
          problems.push(`"${file.name}" could not be read. It may be corrupted or not a real PDF.`);
          continue;
        }

        try {
          const pageCount = await readPageCount(file);
          accepted.push({ id: nextId(), key, file, pageCount });
          seen.add(key);
          slots -= 1;
        } catch (err) {
          const reason = err instanceof Error ? err.message : "";
          problems.push(
            reason === "encrypted"
              ? `"${file.name}" is password-protected. Remove the password first, then try again.`
              : `"${file.name}" could not be read. It may be corrupted or password-protected.`,
          );
        }
      }
    } finally {
      setIsAdding(false);
    }

    if (accepted.length > 0) setItems((prev) => [...prev, ...accepted]);

    if (problems.length > 0) {
      const shown = problems.slice(0, 3).join(" ");
      const extra = problems.length > 3 ? ` (+${problems.length - 3} more issues)` : "";
      setError(shown + extra);
    } else if (accepted.length > 0) {
      setNotice(`Added ${accepted.length} ${accepted.length === 1 ? "PDF" : "PDFs"}.`);
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = ""; // allow re-selecting the same files
    if (picked.length > 0) void addFiles(picked);
  };

  const handleZoneDragOver = (e: DragEvent<HTMLElement>) => {
    // Ignore in-list reorder drags; only react to files from the OS.
    if (dragId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setIsDragging(true);
  };

  const handleZoneDragLeave = (e: DragEvent<HTMLElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setIsDragging(false);
  };

  const handleZoneDrop = (e: DragEvent<HTMLElement>) => {
    if (dragId) return;
    e.preventDefault();
    setIsDragging(false);
    const dropped = Array.from(e.dataTransfer.files ?? []);
    void addFiles(dropped);
  };

  /* ------------------------------ Reordering ------------------------------ */

  const moveItem = (from: number, to: number) => {
    setItems((prev) => {
      if (to < 0 || to >= prev.length || from === to) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    setResult(null);
    setError(null);
    setNotice(null);
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    setResult(null);
    setError(null);
    setNotice(null);
  };

  const handleItemDragStart = (e: DragEvent<HTMLLIElement>, id: string) => {
    setDragId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id); // required by Firefox
  };

  const handleItemDragOver = (e: DragEvent<HTMLLIElement>, id: string) => {
    if (!dragId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (overId !== id) setOverId(id);
  };

  const handleItemDrop = (e: DragEvent<HTMLLIElement>, targetId: string) => {
    if (!dragId) return;
    e.preventDefault();
    const from = items.findIndex((i) => i.id === dragId);
    const to = items.findIndex((i) => i.id === targetId);
    if (from !== -1 && to !== -1) moveItem(from, to);
    setDragId(null);
    setOverId(null);
  };

  const handleItemDragEnd = () => {
    setDragId(null);
    setOverId(null);
  };

  /* -------------------------------- Merging ------------------------------- */

  const handleMerge = async () => {
    if (isProcessing || isAdding) return;
    if (items.length < 2) {
      setError("Please add at least 2 PDFs to merge.");
      return;
    }

    setError(null);
    setNotice(null);
    setIsProcessing(true);
    setStatus("Reading PDFs…");
    await nextFrame();

    try {
      const { PDFDocument } = await import("pdf-lib");
      const merged = await PDFDocument.create();
      let totalPages = 0;

      // Snapshot so the order can't change mid-merge.
      const ordered = [...items];

      for (let i = 0; i < ordered.length; i += 1) {
        const { file, pageCount } = ordered[i];
        setStatus(`Merging ${i + 1} of ${ordered.length}: ${file.name}`);
        await nextFrame();

        const bytes = new Uint8Array(await file.arrayBuffer());
        const source = await PDFDocument.load(bytes, { updateMetadata: false });
        const copied = await merged.copyPages(source, source.getPageIndices());
        copied.forEach((page) => merged.addPage(page));

        if (copied.length !== pageCount) {
          throw new Error("page-mismatch");
        }
        totalPages += copied.length;
      }

      setStatus("Saving merged PDF…");
      await nextFrame();
      const output = await merged.save({ useObjectStreams: true });

      const blob = new Blob([output.slice().buffer as ArrayBuffer], { type: PDF_MIME });
      setResult({
        url: URL.createObjectURL(blob),
        size: blob.size, // real size of the merged file
        fileCount: ordered.length,
        totalPages,
        originalSize: ordered.reduce((sum, i) => sum + i.file.size, 0),
      });
    } catch {
      setError("Something went wrong while merging your PDFs. Please try again.");
    } finally {
      setIsProcessing(false);
      setStatus("");
    }
  };

  const handleReset = () => {
    setItems([]);
    setResult(null);
    setError(null);
    setNotice(null);
    setIsProcessing(false);
    setIsAdding(false);
    setStatus("");
    setDragId(null);
    setOverId(null);
  };

  const hiddenInput = (
    <input
      ref={inputRef}
      type="file"
      multiple
      accept=".pdf,application/pdf"
      onChange={handleInputChange}
      className="sr-only"
      tabIndex={-1}
      aria-hidden="true"
    />
  );

  /* ------------------------------ Empty state ----------------------------- */
  if (items.length === 0) {
    return (
      <div>
        {hiddenInput}

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragEnter={handleZoneDragOver}
          onDragOver={handleZoneDragOver}
          onDragLeave={handleZoneDragLeave}
          onDrop={handleZoneDrop}
          disabled={isAdding}
          aria-label="Upload PDFs. Click to browse or drag and drop files."
          className={`glass group flex w-full flex-col items-center rounded-3xl border-2 border-dashed px-6 py-16 text-center transition-all duration-200 disabled:cursor-wait sm:py-20 ${
            isDragging
              ? "scale-[1.01] border-accent bg-accent/[0.06] shadow-[0_0_0_4px_rgb(184_245_61/0.1)]"
              : "border-white/15 hover:border-accent/50"
          }`}
        >
          <span
            className={`flex h-16 w-16 items-center justify-center rounded-2xl ring-1 transition-colors ${
              isDragging ? "bg-accent/20 text-accent ring-accent/40" : "bg-accent/10 text-accent ring-accent/20"
            }`}
          >
            {isAdding ? (
              <Loader2 className="h-7 w-7 animate-spin" aria-hidden="true" />
            ) : (
              <FileUp className="h-7 w-7" aria-hidden="true" />
            )}
          </span>
          <span className="mt-6 text-lg font-semibold">
            {isAdding ? "Reading PDFs…" : isDragging ? "Drop your PDFs here" : "Drag & drop PDFs, or click to browse"}
          </span>
          <span className="mt-2 text-sm text-white/50">
            Up to {MAX_FILES} PDF files • {formatBytes(MAX_FILE_SIZE_BYTES)} each
          </span>
        </button>

        {error && <ErrorMessage message={error} />}

        <p className="mt-5 flex items-center justify-center gap-2 text-center text-xs text-white/40">
          <ShieldCheck className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
          Your PDFs stay in your browser.
        </p>

        <p className="sr-only" role="status" aria-live="polite">
          {isAdding ? "Reading PDFs" : ""}
        </p>
      </div>
    );
  }

  /* ------------------------------ Result state ---------------------------- */
  if (result) {
    return (
      <div className="glass rounded-3xl p-5 sm:p-7">
        <div className="flex items-center gap-2 text-sm font-medium text-accent" role="status" aria-live="polite">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          Merge complete
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="PDFs merged" value={String(result.fileCount)} />
          <Stat label="Total pages" value={String(result.totalPages)} />
          <Stat label="Original size" value={formatBytes(result.originalSize)} />
          <Stat label="Merged size" value={formatBytes(result.size)} highlight />
        </dl>

        <p className="mt-4 text-sm text-white/50">
          Pages were combined in the order you chose. Page content and sizes are unchanged.
        </p>

        <ol className="mt-5 space-y-2">
          {items.map((item, index) => (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm"
            >
              <span className="w-5 shrink-0 font-mono text-xs text-white/40">{index + 1}</span>
              <span className="min-w-0 flex-1 truncate" title={item.file.name}>
                {item.file.name}
              </span>
              <span className="shrink-0 text-xs text-white/40">
                {item.pageCount} {item.pageCount === 1 ? "page" : "pages"}
              </span>
            </li>
          ))}
        </ol>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <a
            href={result.url}
            download={OUTPUT_NAME}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-accent px-6 py-3.5 text-base font-semibold text-ink transition hover:brightness-110"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Download Merged PDF
          </a>
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 px-6 py-3.5 text-base font-medium text-white/80 transition hover:border-white/25 hover:text-white"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Merge Another
          </button>
        </div>

        <p className="mt-5 flex items-center justify-center gap-2 text-center text-xs text-white/40">
          <ShieldCheck className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
          Your PDFs stay in your browser.
        </p>
      </div>
    );
  }

  /* ------------------------------ List state ------------------------------ */
  const totalSize = items.reduce((sum, i) => sum + i.file.size, 0);
  const totalPages = items.reduce((sum, i) => sum + i.pageCount, 0);
  const canMerge = items.length >= 2 && !busy;
  const atLimit = items.length >= MAX_FILES;

  const iconButtonClass =
    "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-white/70 transition hover:border-white/25 hover:text-white focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-white/10 disabled:hover:text-white/70";

  return (
    <div
      className="glass rounded-3xl p-5 sm:p-7"
      onDragEnter={handleZoneDragOver}
      onDragOver={handleZoneDragOver}
      onDragLeave={handleZoneDragLeave}
      onDrop={handleZoneDrop}
    >
      {hiddenInput}

      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-white/40">Merge order</p>
          <p className="mt-1 text-lg font-semibold">
            {items.length} {items.length === 1 ? "PDF" : "PDFs"} selected
          </p>
        </div>
        <p className="text-sm text-white/50">
          {totalPages} {totalPages === 1 ? "page" : "pages"} • {formatBytes(totalSize)}
        </p>
      </div>

      <p className="mt-2 text-sm text-white/50">
        PDFs are merged from top to bottom. Use the arrows or drag the handle to change the order.
      </p>

      <ol className="mt-5 space-y-3" aria-label="PDFs to merge, in merge order">
        {items.map((item, index) => {
          const isFirst = index === 0;
          const isLast = index === items.length - 1;
          const isDragTarget = overId === item.id && dragId !== item.id;

          return (
            <li
              key={item.id}
              draggable={!busy}
              onDragStart={(e) => handleItemDragStart(e, item.id)}
              onDragOver={(e) => handleItemDragOver(e, item.id)}
              onDrop={(e) => handleItemDrop(e, item.id)}
              onDragEnd={handleItemDragEnd}
              className={`flex items-center gap-3 rounded-2xl border px-3 py-3 transition sm:px-4 ${
                isDragTarget
                  ? "border-accent/60 bg-accent/[0.07]"
                  : "border-white/[0.08] bg-white/[0.03] hover:border-white/20"
              } ${dragId === item.id ? "opacity-50" : ""}`}
            >
              <GripVertical
                className="hidden h-5 w-5 shrink-0 cursor-grab text-white/30 sm:block"
                aria-hidden="true"
              />
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/[0.06] font-mono text-xs text-white/60">
                {index + 1}
              </span>
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent ring-1 ring-accent/20">
                <FileText className="h-5 w-5" aria-hidden="true" />
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium sm:text-base" title={item.file.name}>
                  {item.file.name}
                </p>
                <p className="mt-0.5 text-xs text-white/50 sm:text-sm">
                  {formatBytes(item.file.size)} • {item.pageCount} {item.pageCount === 1 ? "page" : "pages"}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => moveItem(index, index - 1)}
                  disabled={isFirst || busy}
                  aria-label={`Move ${item.file.name} up`}
                  className={iconButtonClass}
                >
                  <ArrowUp className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => moveItem(index, index + 1)}
                  disabled={isLast || busy}
                  aria-label={`Move ${item.file.name} down`}
                  className={iconButtonClass}
                >
                  <ArrowDown className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  disabled={busy}
                  aria-label={`Remove ${item.file.name}`}
                  className={`${iconButtonClass} hover:border-red-400/40 hover:text-red-300`}
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy || atLimit}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-white/80 transition hover:border-white/25 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isAdding ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Plus className="h-4 w-4" aria-hidden="true" />
          )}
          {isAdding ? "Reading PDFs…" : "Add more PDFs"}
        </button>
        <button
          type="button"
          onClick={handleReset}
          disabled={busy}
          className="text-sm text-white/50 underline-offset-4 transition-colors hover:text-white hover:underline disabled:cursor-not-allowed disabled:opacity-50"
        >
          Clear all
        </button>
        <span className="text-xs text-white/40">
          {items.length} of {MAX_FILES} • {formatBytes(MAX_FILE_SIZE_BYTES)} max each
        </span>
      </div>

      {items.length < 2 && <InfoNote>Add at least 2 PDFs to merge.</InfoNote>}

      {isProcessing && (
        <div className="mt-6" aria-hidden="true">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-1/3 animate-pulse rounded-full bg-accent" />
          </div>
        </div>
      )}

      {error && <ErrorMessage message={error} />}
      {!error && notice && (
        <p className="mt-4 flex items-center gap-2 text-sm text-accent">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          {notice}
        </p>
      )}

      <button
        type="button"
        onClick={handleMerge}
        disabled={!canMerge}
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-7 py-4 text-base font-semibold text-ink transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:brightness-100"
      >
        {isProcessing ? (
          <>
            <Loader2 className="h-5 w-5 shrink-0 animate-spin" aria-hidden="true" />
            <span className="truncate">{status || "Merging…"}</span>
          </>
        ) : (
          <>
            <Merge className="h-5 w-5" aria-hidden="true" />
            Merge PDFs
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </>
        )}
      </button>

      <p className="sr-only" role="status" aria-live="polite">
        {isProcessing ? status || "Merging your PDFs" : isAdding ? "Reading PDFs" : ""}
      </p>

      <p className="mt-5 flex items-center justify-center gap-2 text-center text-xs text-white/40">
        <ShieldCheck className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
        Your PDFs stay in your browser.
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Small presentational components                                           */
/* -------------------------------------------------------------------------- */

function ErrorMessage({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="mt-5 flex items-start gap-3 rounded-xl border border-red-400/25 bg-red-400/[0.07] px-4 py-3 text-sm text-red-200"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <p>{message}</p>
    </div>
  );
}

function InfoNote({ children }: { children: ReactNode }) {
  return (
    <div className="mt-4 flex items-start gap-3 rounded-xl border border-accent/20 bg-accent/[0.05] px-4 py-3 text-sm">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
      <p className="leading-relaxed text-white/60">{children}</p>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border px-3 py-4 text-center sm:px-4 ${
        highlight ? "border-accent/30 bg-accent/[0.08]" : "border-white/[0.08] bg-white/[0.03]"
      }`}
    >
      <dt className="text-xs uppercase tracking-widest text-white/45">{label}</dt>
      <dd className={`mt-1.5 text-xl font-semibold sm:text-2xl ${highlight ? "text-accent" : "text-white"}`}>
        {value}
      </dd>
    </div>
  );
}