"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangeEvent, DragEvent, ReactNode } from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Download,
  FileText,
  FileUp,
  Info,
  Loader2,
  RotateCcw,
  ShieldCheck,
  Zap,
} from "lucide-react";

/* -------------------------------------------------------------------------- */
/*  Config                                                                    */
/* -------------------------------------------------------------------------- */

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const PDF_MIME = "application/pdf";

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;

  const kb = bytes / 1024;

  if (kb < 1024) {
    return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`;
  }

  const mb = kb / 1024;

  return `${mb.toFixed(mb < 10 ? 2 : 1)} MB`;
}

function buildOutputName(originalName: string): string {
  const dot = originalName.lastIndexOf(".");
  const base = dot > 0 ? originalName.slice(0, dot) : originalName;

  return `${base}-compressed.pdf`;
}

/**
 * Lets React paint a status update before heavy synchronous work continues.
 */
function nextFrame(): Promise<void> {
  return new Promise((resolve) =>
    requestAnimationFrame(() => setTimeout(resolve, 0))
  );
}

/**
 * Quick signature check: a real PDF has "%PDF-" near the start of the file.
 */
async function hasPdfSignature(file: File): Promise<boolean> {
  const head = new Uint8Array(
    await file.slice(0, 1024).arrayBuffer()
  );

  const text = new TextDecoder("latin1").decode(head);

  return text.includes("%PDF-");
}

/* -------------------------------------------------------------------------- */
/*  Optimization types                                                        */
/* -------------------------------------------------------------------------- */

type OptimizeOutcome = {
  /**
   * Bytes to offer for download.
   * Null means no smaller valid PDF was produced.
   */
  bytes: Uint8Array | null;

  pageCount: number;

  /**
   * True when pages were rebuilt into a fresh document.
   */
  rebuilt: boolean;
};

/* -------------------------------------------------------------------------- */
/*  PDF Optimization                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Lossless structural optimization with pdf-lib:
 *
 * 1. Re-save with compressed object streams.
 * 2. Rebuild the document by copying pages into a fresh file.
 * 3. Keep only a candidate that is genuinely smaller.
 *
 * Images are never re-encoded or rasterized.
 * Page sizes are untouched.
 */
async function optimizePdf(
  file: File,
  onStatus: (message: string) => void
): Promise<OptimizeOutcome> {
  onStatus("Reading your PDF…");

  if (!(await hasPdfSignature(file))) {
    throw new Error(
      "This file doesn't look like a valid PDF. It may be corrupted or renamed from another format."
    );
  }

  const original = new Uint8Array(await file.arrayBuffer());

  const { PDFDocument } = await import("pdf-lib");

  onStatus("Analyzing document structure…");
  await nextFrame();

  /**
   * Explicitly type source so TypeScript can correctly infer
   * the PDFPage type returned from copyPages().
   */
  let source: import("pdf-lib").PDFDocument;

  try {
    source = await PDFDocument.load(original, {
      updateMetadata: false,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";

    if (/encrypt/i.test(message)) {
      throw new Error(
        "This PDF is password-protected. Remove the password first, then try again."
      );
    }

    throw new Error(
      "This PDF could not be read. It may be corrupted or use an unsupported feature."
    );
  }

  const pageCount = source.getPageCount();

  if (pageCount < 1) {
    throw new Error("This PDF has no pages.");
  }

  const candidates: {
    bytes: Uint8Array;
    rebuilt: boolean;
  }[] = [];

  /* ---------------------------------------------------------------------- */
  /*  Candidate 1: Save with object streams                                 */
  /* ---------------------------------------------------------------------- */

  onStatus("Optimizing structure…");
  await nextFrame();

  try {
    candidates.push({
      bytes: await source.save({
        useObjectStreams: true,
      }),
      rebuilt: false,
    });
  } catch {
    /* Candidate skipped */
  }

  /* ---------------------------------------------------------------------- */
  /*  Candidate 2: Rebuild document                                         */
  /* ---------------------------------------------------------------------- */

  onStatus("Removing unused data…");
  await nextFrame();

  try {
    const fresh = await PDFDocument.create();

    const pages = await fresh.copyPages(
      source,
      source.getPageIndices()
    );

    pages.forEach((page) => {
      fresh.addPage(page);
    });

    candidates.push({
      bytes: await fresh.save({
        useObjectStreams: true,
      }),
      rebuilt: true,
    });
  } catch {
    /* Candidate skipped */
  }

  /* ---------------------------------------------------------------------- */
  /*  Verify candidates                                                      */
  /* ---------------------------------------------------------------------- */

  onStatus("Verifying result…");
  await nextFrame();

  const smaller = candidates
    .filter(
      (candidate) =>
        candidate.bytes.byteLength < original.byteLength
    )
    .sort(
      (a, b) =>
        a.bytes.byteLength - b.bytes.byteLength
    );

  for (const candidate of smaller) {
    try {
      const check = await PDFDocument.load(candidate.bytes, {
        updateMetadata: false,
      });

      if (check.getPageCount() === pageCount) {
        return {
          bytes: candidate.bytes,
          pageCount,
          rebuilt: candidate.rebuilt,
        };
      }
    } catch {
      /* Invalid candidate, try the next one */
    }
  }

  return {
    bytes: null,
    pageCount,
    rebuilt: false,
  };
}

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

type CompressionResult = {
  url: string;

  /**
   * Size of the file that will actually be downloaded.
   */
  size: number;

  pageCount: number;

  /**
   * True only when the output is genuinely smaller.
   */
  reduced: boolean;

  rebuilt: boolean;

  fileName: string;
};

/* -------------------------------------------------------------------------- */
/*  Component                                                                 */
/* -------------------------------------------------------------------------- */

export default function PdfCompressor() {
  const inputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] =
    useState<CompressionResult | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);

  /* ---------------------------------------------------------------------- */
  /*  Object URL cleanup                                                     */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    if (!result) return;

    const url = result.url;

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [result]);

  /* ---------------------------------------------------------------------- */
  /*  File validation                                                        */
  /* ---------------------------------------------------------------------- */

  const handleFile = useCallback(async (selected: File) => {
    setError(null);

    if (selected.type !== PDF_MIME) {
      setError(
        "Unsupported file type. Please upload a PDF file."
      );
      return;
    }

    if (selected.size === 0) {
      setError(
        "This file is empty. Please choose a different PDF."
      );
      return;
    }

    if (selected.size > MAX_FILE_SIZE_BYTES) {
      setError(
        `This file is ${formatBytes(
          selected.size
        )}. The maximum size is ${formatBytes(
          MAX_FILE_SIZE_BYTES
        )}.`
      );
      return;
    }

    if (!(await hasPdfSignature(selected))) {
      setError(
        "This file doesn't look like a valid PDF. It may be corrupted."
      );
      return;
    }

    setFile(selected);
    setResult(null);
  }, []);

  /* ---------------------------------------------------------------------- */
  /*  File input                                                             */
  /* ---------------------------------------------------------------------- */

  const handleInputChange = (
    e: ChangeEvent<HTMLInputElement>
  ) => {
    const selected = e.target.files?.[0];

    // Allow selecting the same file again.
    e.target.value = "";

    if (selected) {
      void handleFile(selected);
    }
  };

  /* ---------------------------------------------------------------------- */
  /*  Drag & Drop                                                            */
  /* ---------------------------------------------------------------------- */

  const handleDragOver = (
    e: DragEvent<HTMLButtonElement>
  ) => {
    e.preventDefault();

    e.dataTransfer.dropEffect = "copy";

    setIsDragging(true);
  };

  const handleDragLeave = (
    e: DragEvent<HTMLButtonElement>
  ) => {
    if (
      e.currentTarget.contains(
        e.relatedTarget as Node | null
      )
    ) {
      return;
    }

    setIsDragging(false);
  };

  const handleDrop = (
    e: DragEvent<HTMLButtonElement>
  ) => {
    e.preventDefault();

    setIsDragging(false);

    const dropped = e.dataTransfer.files?.[0];

    if (dropped) {
      void handleFile(dropped);
    }
  };

  /* ---------------------------------------------------------------------- */
  /*  Compress                                                               */
  /* ---------------------------------------------------------------------- */

  const handleCompress = async () => {
    if (!file || isProcessing) return;

    setError(null);
    setIsProcessing(true);
    setStatus("Starting…");

    await nextFrame();

    try {
      const outcome = await optimizePdf(
        file,
        setStatus
      );

      const reduced = outcome.bytes !== null;

      /**
       * If nothing got smaller, keep the original file
       * as the download.
       */
      const blob = outcome.bytes
        ? new Blob(
            [
              outcome.bytes.slice()
                .buffer as ArrayBuffer,
            ],
            {
              type: PDF_MIME,
            }
          )
        : new Blob([file], {
            type: PDF_MIME,
          });

      setResult({
        url: URL.createObjectURL(blob),

        size: blob.size,

        pageCount: outcome.pageCount,

        reduced,

        rebuilt: outcome.rebuilt,

        fileName: reduced
          ? buildOutputName(file.name)
          : file.name,
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while compressing. Please try again."
      );
    } finally {
      setIsProcessing(false);
      setStatus("");
    }
  };

  /* ---------------------------------------------------------------------- */
  /*  Reset                                                                  */
  /* ---------------------------------------------------------------------- */

  const handleReset = () => {
    setFile(null);
    setResult(null);
    setError(null);
    setIsProcessing(false);
    setStatus("");
  };

  /* ---------------------------------------------------------------------- */
  /*  Empty state                                                            */
  /* ---------------------------------------------------------------------- */

  if (!file) {
    return (
      <div>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf"
          onChange={handleInputChange}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
        />

        <button
          type="button"
          onClick={() =>
            inputRef.current?.click()
          }
          onDragEnter={handleDragOver}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          aria-label="Upload a PDF. Click to browse or drag and drop a file."
          className={`glass group flex w-full flex-col items-center rounded-3xl border-2 border-dashed px-6 py-16 text-center transition-all duration-200 sm:py-20 ${
            isDragging
              ? "scale-[1.01] border-accent bg-accent/6 shadow-[0_0_0_4px_rgb(184_245_61/0.1)]"
              : "border-white/15 hover:border-accent/50"
          }`}
        >
          <span
            className={`flex h-16 w-16 items-center justify-center rounded-2xl ring-1 transition-colors ${
              isDragging
                ? "bg-accent/20 text-accent ring-accent/40"
                : "bg-accent/10 text-accent ring-accent/20"
            }`}
          >
            <FileUp
              className="h-7 w-7"
              aria-hidden="true"
            />
          </span>

          <span className="mt-6 text-lg font-semibold">
            {isDragging
              ? "Drop your PDF here"
              : "Drag & drop a PDF, or click to browse"}
          </span>

          <span className="mt-2 text-sm text-white/50">
            Supported format: PDF
          </span>

          <span className="mt-1 text-sm text-white/50">
            Maximum file size:{" "}
            {formatBytes(MAX_FILE_SIZE_BYTES)}
          </span>
        </button>

        {error && (
          <ErrorMessage message={error} />
        )}

        <p className="mt-5 flex items-center justify-center gap-2 text-center text-xs text-white/40">
          <ShieldCheck
            className="h-3.5 w-3.5 text-accent"
            aria-hidden="true"
          />

          Your PDF stays in your browser.
        </p>
      </div>
    );
  }

  /* ---------------------------------------------------------------------- */
  /*  Result state                                                           */
  /* ---------------------------------------------------------------------- */

  if (result) {
    const savedBytes =
      file.size - result.size;

    const savedPct =
      (savedBytes / file.size) * 100;

    return (
      <div className="glass rounded-3xl p-5 sm:p-7">
        {result.reduced ? (
          <div className="flex items-center gap-2 text-sm font-medium text-accent">
            <CheckCircle2
              className="h-4 w-4"
              aria-hidden="true"
            />

            Compression complete
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm font-medium text-amber-300">
            <Info
              className="h-4 w-4"
              aria-hidden="true"
            />

            No further compression possible
          </div>
        )}

        <div className="mt-5 flex items-center gap-3 rounded-xl border border-white/8 bg-white/3 px-4 py-3">
          <FileText
            className="h-5 w-5 shrink-0 text-accent"
            aria-hidden="true"
          />

          <div className="min-w-0">
            <p className="text-xs uppercase tracking-widest text-white/40">
              Original filename
            </p>

            <p
              className="truncate text-sm font-medium"
              title={file.name}
            >
              {file.name}
            </p>
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-3 gap-3">
          <Stat
            label="Original"
            value={formatBytes(file.size)}
          />

          <Stat
            label={
              result.reduced
                ? "Compressed"
                : "Output"
            }
            value={formatBytes(result.size)}
          />

          <Stat
            label={
              result.reduced
                ? "Saved"
                : "Change"
            }
            value={
              result.reduced
                ? `${Math.max(
                    savedPct,
                    0
                  ).toFixed(
                    savedPct < 10 ? 1 : 0
                  )}%`
                : "0%"
            }
            highlight={result.reduced}
            warn={!result.reduced}
          />
        </dl>

        {result.reduced ? (
          <p className="mt-4 text-sm text-white/50">
            Saved{" "}
            <span className="font-medium text-white/80">
              {formatBytes(savedBytes)}
            </span>{" "}
            across{" "}
            <span className="font-medium text-white/80">
              {result.pageCount}
            </span>{" "}
            {result.pageCount === 1
              ? "page"
              : "pages"}
            . All pages, page sizes and image
            quality are unchanged.
          </p>
        ) : (
          <InfoNote>
            This PDF is already well optimized.
            Our browser-based compression
            couldn&apos;t make it smaller without
            changing its content, so the original
            file is kept as your download. PDFs
            that are mostly large images usually
            need image recompression, which this
            tool doesn&apos;t do to protect quality.
          </InfoNote>
        )}

        {result.reduced &&
          result.rebuilt && (
            <InfoNote>
              The document was rebuilt to remove
              unused data. Page content is
              preserved, but interactive extras
              such as bookmarks or fillable form
              fields may not carry over. Check the
              file before replacing your original.
            </InfoNote>
          )}

        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <a
            href={result.url}
            download={result.fileName}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-accent px-6 py-3.5 text-base font-semibold text-ink transition hover:brightness-110"
          >
            <Download
              className="h-4 w-4"
              aria-hidden="true"
            />

            {result.reduced
              ? "Download PDF"
              : "Download original PDF"}
          </a>

          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 px-6 py-3.5 text-base font-medium text-white/80 transition hover:border-white/25 hover:text-white"
          >
            <RotateCcw
              className="h-4 w-4"
              aria-hidden="true"
            />

            Compress Another
          </button>
        </div>

        <p className="mt-5 flex items-center justify-center gap-2 text-center text-xs text-white/40">
          <ShieldCheck
            className="h-3.5 w-3.5 text-accent"
            aria-hidden="true"
          />

          Your PDF stays in your browser.
        </p>
      </div>
    );
  }

  /* ---------------------------------------------------------------------- */
  /*  Selected file state                                                    */
  /* ---------------------------------------------------------------------- */

  return (
    <div className="glass rounded-3xl p-5 sm:p-7">
      <div className="flex items-center gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-accent/10 text-accent ring-1 ring-accent/20">
          <FileText
            className="h-6 w-6"
            aria-hidden="true"
          />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-widest text-white/40">
            Selected PDF
          </p>

          <p
            className="mt-1 truncate text-lg font-semibold"
            title={file.name}
          >
            {file.name}
          </p>

          <p className="mt-0.5 text-sm text-white/50">
            {formatBytes(file.size)}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={handleReset}
        disabled={isProcessing}
        className="mt-4 text-sm text-white/50 underline-offset-4 transition-colors hover:text-white hover:underline disabled:cursor-not-allowed disabled:opacity-50"
      >
        Choose a different PDF
      </button>

      <InfoNote>
        Compression is lossless: FixKit optimizes
        the PDF&apos;s internal structure without
        re-encoding images or changing page sizes.
        Results vary. Some PDFs shrink noticeably,
        others are already as small as they can get.
      </InfoNote>

      {isProcessing && (
        <div
          className="mt-6"
          aria-hidden="true"
        >
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-1/3 animate-pulse rounded-full bg-accent" />
          </div>
        </div>
      )}

      {error && (
        <ErrorMessage message={error} />
      )}

      <button
        type="button"
        onClick={handleCompress}
        disabled={isProcessing}
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-7 py-4 text-base font-semibold text-ink transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:brightness-100"
      >
        {isProcessing ? (
          <>
            <Loader2
              className="h-5 w-5 animate-spin"
              aria-hidden="true"
            />

            {status || "Compressing…"}
          </>
        ) : (
          <>
            <Zap
              className="h-5 w-5"
              aria-hidden="true"
            />

            Compress PDF

            <ArrowRight
              className="h-4 w-4"
              aria-hidden="true"
            />
          </>
        )}
      </button>

      <p
        className="sr-only"
        role="status"
        aria-live="polite"
      >
        {isProcessing
          ? status || "Compressing your PDF"
          : ""}
      </p>

      <p className="mt-5 flex items-center justify-center gap-2 text-center text-xs text-white/40">
        <ShieldCheck
          className="h-3.5 w-3.5 text-accent"
          aria-hidden="true"
        />

        Your PDF stays in your browser.
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Small presentational components                                           */
/* -------------------------------------------------------------------------- */

function ErrorMessage({
  message,
}: {
  message: string;
}) {
  return (
    <div
      role="alert"
      className="mt-5 flex items-start gap-3 rounded-xl border border-red-400/25 bg-red-400/7 px-4 py-3 text-sm text-red-200"
    >
      <AlertCircle
        className="mt-0.5 h-4 w-4 shrink-0"
        aria-hidden="true"
      />

      <p>{message}</p>
    </div>
  );
}

function InfoNote({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="mt-4 flex items-start gap-3 rounded-xl border border-accent/20 bg-accent/5 px-4 py-3 text-sm">
      <Info
        className="mt-0.5 h-4 w-4 shrink-0 text-accent"
        aria-hidden="true"
      />

      <p className="leading-relaxed text-white/60">
        {children}
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight = false,
  warn = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  warn?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border px-3 py-4 text-center sm:px-4 ${
        highlight
          ? "border-accent/30 bg-accent/8"
          : warn
            ? "border-amber-400/25 bg-amber-400/6"
            : "border-white/8 bg-white/3"
      }`}
    >
      <dt className="text-xs uppercase tracking-widest text-white/45">
        {label}
      </dt>

      <dd
        className={`mt-1.5 text-xl font-semibold sm:text-2xl ${
          highlight
            ? "text-accent"
            : warn
              ? "text-amber-300"
              : "text-white"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}