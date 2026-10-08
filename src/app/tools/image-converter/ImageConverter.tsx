"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { ChangeEvent, DragEvent, ReactNode } from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Download,
  ImageUp,
  Info,
  Loader2,
  RefreshCw,
  RotateCcw,
  SlidersHorizontal,
} from "lucide-react";

/* -------------------------------------------------------------------------- */
/*  Config                                                                    */
/* -------------------------------------------------------------------------- */

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_PIXELS = 50_000_000; // 50 megapixels
const DEFAULT_QUALITY = 90;

type AcceptedMime = "image/jpeg" | "image/png" | "image/webp";
type OutputFormat = "jpeg" | "png" | "webp";

const MIME_BY_FORMAT: Record<OutputFormat, AcceptedMime> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

const FORMAT_OPTIONS: { value: OutputFormat; label: string; hint: string }[] = [
  { value: "jpeg", label: "JPEG", hint: "Photos · no transparency" },
  { value: "png", label: "PNG", hint: "Lossless · keeps transparency" },
  { value: "webp", label: "WebP", hint: "Small · keeps transparency" },
];

const EXTENSION_BY_MIME: Record<AcceptedMime, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const LABEL_BY_MIME: Record<AcceptedMime, string> = {
  "image/jpeg": "JPEG",
  "image/png": "PNG",
  "image/webp": "WebP",
};

const CHECKERBOARD_STYLE = {
  backgroundImage: "conic-gradient(#181a1e 25%, #22252a 0 50%, #181a1e 0 75%, #22252a 0)",
  backgroundSize: "16px 16px",
} as const;

/* -------------------------------------------------------------------------- */
/*  Reusable image helpers                                                    */
/* -------------------------------------------------------------------------- */

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(mb < 10 ? 2 : 1)} MB`;
}

function normalizeMime(type: string): AcceptedMime | null {
  const lower = type.toLowerCase();
  if (lower === "image/jpg" || lower === "image/jpeg") return "image/jpeg";
  if (lower === "image/png") return "image/png";
  if (lower === "image/webp") return "image/webp";
  return null;
}

/** PNG is lossless: the canvas ignores any quality value for it. */
function isLossyMime(mime: AcceptedMime): boolean {
  return mime !== "image/png";
}

/** Keeps the original filename base and swaps only the extension. */
function buildOutputName(originalName: string, mime: AcceptedMime): string {
  const dot = originalName.lastIndexOf(".");
  const base = dot > 0 ? originalName.slice(0, dot) : originalName;
  return `${base}.${EXTENSION_BY_MIME[mime]}`;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("This image could not be read. The file may be corrupted."));
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, mime: AcceptedMime, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Conversion failed. Please try a different image or format."));
          return;
        }
        if (blob.type !== mime) {
          reject(new Error(`Your browser can't export ${LABEL_BY_MIME[mime]} files. Try another format.`));
          return;
        }
        resolve(blob);
      },
      mime,
      quality,
    );
  });
}

async function convertImage(file: File, outputMime: AcceptedMime, quality: number): Promise<Blob> {
  const sourceUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(sourceUrl);
    const width = img.naturalWidth;
    const height = img.naturalHeight;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Your browser doesn't support image processing.");

    // JPEG has no alpha channel: paint white so transparent areas don't turn black.
    if (outputMime === "image/jpeg") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
    }
    ctx.drawImage(img, 0, 0, width, height);

    const blob = await canvasToBlob(canvas, outputMime, isLossyMime(outputMime) ? quality / 100 : undefined);

    // Free the canvas backing store promptly.
    canvas.width = 0;
    canvas.height = 0;
    return blob;
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

type SourcePreview = { url: string; width: number; height: number };

type ConversionResult = {
  url: string;
  size: number;
  width: number;
  height: number;
  mime: AcceptedMime;
  fileName: string;
  qualityApplied: number | null;
};

/* -------------------------------------------------------------------------- */
/*  Component                                                                 */
/* -------------------------------------------------------------------------- */

export default function ImageConverter() {
  const inputRef = useRef<HTMLInputElement>(null);
  const qualityId = useId();

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<SourcePreview | null>(null);
  const [result, setResult] = useState<ConversionResult | null>(null);

  const [format, setFormat] = useState<OutputFormat>("jpeg");
  const [quality, setQuality] = useState(DEFAULT_QUALITY);

  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Revoke object URLs whenever they are replaced or the component unmounts.
  useEffect(() => {
    if (!preview) return;
    const url = preview.url;
    return () => URL.revokeObjectURL(url);
  }, [preview]);

  useEffect(() => {
    if (!result) return;
    const url = result.url;
    return () => URL.revokeObjectURL(url);
  }, [result]);

  const handleFile = useCallback(async (selected: File) => {
    setError(null);

    const mime = normalizeMime(selected.type);
    if (!mime) {
      setError("Unsupported file type. Please upload a JPG, JPEG, PNG, or WEBP image.");
      return;
    }
    if (selected.size === 0) {
      setError("This file is empty. Please choose a different image.");
      return;
    }
    if (selected.size > MAX_FILE_SIZE_BYTES) {
      setError(`This file is ${formatBytes(selected.size)}. The maximum size is ${formatBytes(MAX_FILE_SIZE_BYTES)}.`);
      return;
    }

    const url = URL.createObjectURL(selected);
    try {
      const img = await loadImage(url);
      const width = img.naturalWidth;
      const height = img.naturalHeight;

      if (width < 1 || height < 1) {
        URL.revokeObjectURL(url);
        setError("This image has invalid dimensions and can't be processed.");
        return;
      }
      if (width * height > MAX_PIXELS) {
        URL.revokeObjectURL(url);
        setError("This image is larger than 50 megapixels. Please use a smaller image.");
        return;
      }

      setFile(selected);
      setPreview({ url, width, height });
      setResult(null);
      // Default to a different format than the source so a conversion actually happens.
      setFormat(mime === "image/jpeg" ? "png" : "jpeg");
    } catch (err) {
      URL.revokeObjectURL(url);
      setError(err instanceof Error ? err.message : "This image could not be opened.");
    }
  }, []);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (selected) void handleFile(selected);
  };

  const handleDragOver = (e: DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLButtonElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) void handleFile(dropped);
  };

  const handleConvert = async () => {
    if (!file || isProcessing) return;
    const sourceMime = normalizeMime(file.type);
    if (!sourceMime || !preview) return;

    setError(null);
    setIsProcessing(true);

    // Let the loading state paint before the (synchronous-heavy) canvas work begins.
    await new Promise<void>((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));

    try {
      const outputMime = MIME_BY_FORMAT[format];
      const blob = await convertImage(file, outputMime, quality);

      setResult({
        url: URL.createObjectURL(blob),
        size: blob.size, // real size of the encoded Blob
        width: preview.width,
        height: preview.height,
        mime: outputMime,
        fileName: buildOutputName(file.name, outputMime),
        qualityApplied: isLossyMime(outputMime) ? quality : null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong while converting. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    setIsProcessing(false);
    setFormat("jpeg");
    setQuality(DEFAULT_QUALITY);
  };

  const inputMime = file ? normalizeMime(file.type) : null;
  const outputMime = MIME_BY_FORMAT[format];
  const showQuality = isLossyMime(outputMime);
  const sameFormat = inputMime === outputMime;

  /* ------------------------------ Empty state ----------------------------- */
  if (!file || !preview) {
    return (
      <div>
        <input
          ref={inputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
          onChange={handleInputChange}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
        />

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragEnter={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          aria-label="Upload an image. Click to browse or drag and drop a file."
          className={`glass group flex w-full flex-col items-center rounded-3xl border-2 border-dashed px-6 py-16 text-center transition-all duration-200 sm:py-20 ${
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
            <ImageUp className="h-7 w-7" aria-hidden="true" />
          </span>
          <span className="mt-6 text-lg font-semibold">
            {isDragging ? "Drop your image here" : "Drag & drop an image, or click to browse"}
          </span>
          <span className="mt-2 text-sm text-white/50">Supported formats: JPG, JPEG, PNG, WEBP</span>
          <span className="mt-1 text-sm text-white/50">
            Maximum file size: {formatBytes(MAX_FILE_SIZE_BYTES)} · Maximum resolution: 50 megapixels
          </span>
        </button>

        {error && <ErrorMessage message={error} />}

        <p className="mt-5 text-center text-xs text-white/40">
          Your image is processed in your browser and never uploaded to a server.
        </p>
      </div>
    );
  }

  /* ------------------------------ Result state ---------------------------- */
  if (result) {
    const changePct = ((result.size - file.size) / file.size) * 100;
    const isLarger = result.size > file.size;
    const changeValue = `${Math.abs(changePct).toFixed(0)}%`;
    const changeLabel = `${isLarger ? "+" : "−"}${changeValue}`;
    const resultIsLossless = result.qualityApplied === null;

    return (
      <div className="glass rounded-3xl p-5 sm:p-7">
        <div className="flex items-center gap-2 text-sm font-medium text-accent">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          Conversion complete
        </div>

        <dl className="mt-5 grid grid-cols-3 gap-3">
          <Stat label="Original" value={formatBytes(file.size)} />
          <Stat label="Output" value={formatBytes(result.size)} />
          <Stat
            label={isLarger ? "Larger by" : "Smaller by"}
            value={changeValue}
            highlight={!isLarger}
            warn={isLarger}
          />
        </dl>

        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <Detail label="Original format" value={inputMime ? LABEL_BY_MIME[inputMime] : ""} />
          <Detail label="Output format" value={LABEL_BY_MIME[result.mime]} />
          <Detail label="Original size" value={`${preview.width} × ${preview.height} px`} />
          <Detail label="Output size" value={`${result.width} × ${result.height} px`} />
        </dl>

        <p className="mt-4 text-sm text-white/50">
          Size change: <span className="font-medium text-white/80">{changeLabel}</span>
          {" · "}
          {resultIsLossless ? "Lossless PNG output." : `Quality ${result.qualityApplied}%.`}
          {result.mime === "image/jpeg" && " Transparent areas were filled with white."}
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <PreviewCard
            title="Original"
            src={preview.url}
            alt={`Original image ${file.name}`}
            meta={`${preview.width} × ${preview.height} px · ${inputMime ? LABEL_BY_MIME[inputMime] : ""}`}
          />
          <PreviewCard
            title="Converted"
            src={result.url}
            alt={`Converted version of ${file.name}`}
            meta={`${result.width} × ${result.height} px · ${LABEL_BY_MIME[result.mime]}`}
            accent
          />
        </div>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <a
            href={result.url}
            download={result.fileName}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-accent px-6 py-3.5 text-base font-semibold text-ink transition hover:brightness-110"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Download {result.fileName}
          </a>
          <button
            type="button"
            onClick={() => setResult(null)}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 px-6 py-3.5 text-base font-medium text-white/80 transition hover:border-white/25 hover:text-white"
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            Adjust settings
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 px-6 py-3.5 text-base font-medium text-white/80 transition hover:border-white/25 hover:text-white"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Convert another
          </button>
        </div>
      </div>
    );
  }

  /* --------------------- Selected image / controls state ------------------- */
  return (
    <div className="glass rounded-3xl p-5 sm:p-7">
      {/* File summary */}
      <div className="flex flex-col gap-5 sm:flex-row">
        <div
          className="flex h-48 w-full shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 sm:h-40 sm:w-40"
          style={CHECKERBOARD_STYLE}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview.url} alt={`Preview of ${file.name}`} className="max-h-full max-w-full object-contain" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-widest text-white/40">Selected image</p>
          <p className="mt-1 truncate text-lg font-semibold" title={file.name}>
            {file.name}
          </p>
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div>
              <dt className="text-white/40">File size</dt>
              <dd className="mt-0.5 font-medium">{formatBytes(file.size)}</dd>
            </div>
            <div>
              <dt className="text-white/40">Dimensions</dt>
              <dd className="mt-0.5 font-medium">
                {preview.width} × {preview.height} px
              </dd>
            </div>
            <div>
              <dt className="text-white/40">Format</dt>
              <dd className="mt-0.5 font-medium">{inputMime ? LABEL_BY_MIME[inputMime] : ""}</dd>
            </div>
          </dl>
          <button
            type="button"
            onClick={handleReset}
            disabled={isProcessing}
            className="mt-4 text-sm text-white/50 underline-offset-4 transition-colors hover:text-white hover:underline disabled:cursor-not-allowed disabled:opacity-50"
          >
            Choose a different image
          </button>
        </div>
      </div>

      <hr className="my-7 border-white/[0.07]" />

      <div className="space-y-7">
        {/* Output format */}
        <fieldset disabled={isProcessing}>
          <legend className="text-sm font-medium">Convert to</legend>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {FORMAT_OPTIONS.map((option) => (
              <label key={option.value} className="cursor-pointer">
                <input
                  type="radio"
                  name="output-format"
                  value={option.value}
                  checked={format === option.value}
                  onChange={() => setFormat(option.value)}
                  className="peer sr-only"
                />
                <span className="flex h-full flex-col rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 transition hover:border-white/25 peer-checked:border-accent/60 peer-checked:bg-accent/[0.07] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent peer-disabled:opacity-50">
                  <span className="text-sm font-medium">{option.label}</span>
                  <span className="mt-0.5 text-xs text-white/45">{option.hint}</span>
                </span>
              </label>
            ))}
          </div>

          {sameFormat && (
            <InfoNote>
              This image is already {inputMime ? LABEL_BY_MIME[inputMime] : ""}. It will be decoded and re-encoded, which
              may change the file size slightly. Pick a different format for a true conversion.
            </InfoNote>
          )}
        </fieldset>

        {/* Transparency note for JPEG */}
        {format === "jpeg" && (
          <InfoNote>
            JPEG doesn&apos;t support transparency. Any transparent areas in your image will be filled with white.
          </InfoNote>
        )}

        {/* Quality (JPEG / WebP only) */}
        {showQuality && (
          <div>
            <div className="flex items-center justify-between">
              <label htmlFor={qualityId} className="text-sm font-medium">
                Quality
              </label>
              <output htmlFor={qualityId} className="rounded-full bg-accent/10 px-3 py-1 font-mono text-sm text-accent">
                {quality}%
              </output>
            </div>
            <input
              id={qualityId}
              type="range"
              min={10}
              max={100}
              step={1}
              value={quality}
              disabled={isProcessing}
              onChange={(e) => setQuality(Number(e.target.value))}
              className="mt-4 h-2 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-accent disabled:cursor-not-allowed disabled:opacity-40"
            />
            <div className="mt-2 flex justify-between text-xs text-white/40">
              <span>Smaller file</span>
              <span>Higher quality</span>
            </div>
          </div>
        )}

        {!showQuality && (
          <InfoNote>PNG is lossless, so there is no quality setting. Transparency is preserved.</InfoNote>
        )}
      </div>

      {/* Conversion summary */}
      {inputMime && (
        <p className="mt-7 flex flex-wrap items-center gap-x-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white/60">
          <RefreshCw className="h-4 w-4 text-accent" aria-hidden="true" />
          <span className="font-mono text-white/80">{LABEL_BY_MIME[inputMime]}</span>
          <ArrowRight className="h-4 w-4 text-accent" aria-hidden="true" />
          <span className="font-mono font-medium text-accent">{LABEL_BY_MIME[outputMime]}</span>
        </p>
      )}

      {error && <ErrorMessage message={error} />}

      <button
        type="button"
        onClick={handleConvert}
        disabled={isProcessing}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-7 py-4 text-base font-semibold text-ink transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:brightness-100"
      >
        {isProcessing ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            Converting…
          </>
        ) : (
          <>
            <RefreshCw className="h-5 w-5" aria-hidden="true" />
            Convert Image
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </>
        )}
      </button>

      <p className="sr-only" role="status" aria-live="polite">
        {isProcessing ? "Converting your image" : ""}
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

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3">
      <dt className="text-white/40">{label}</dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
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
          ? "border-accent/30 bg-accent/[0.08]"
          : warn
            ? "border-amber-400/25 bg-amber-400/[0.06]"
            : "border-white/[0.08] bg-white/[0.03]"
      }`}
    >
      <dt className="text-xs uppercase tracking-widest text-white/45">{label}</dt>
      <dd
        className={`mt-1.5 text-xl font-semibold sm:text-2xl ${
          highlight ? "text-accent" : warn ? "text-amber-300" : "text-white"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function PreviewCard({
  title,
  src,
  alt,
  meta,
  accent = false,
}: {
  title: string;
  src: string;
  alt: string;
  meta: string;
  accent?: boolean;
}) {
  return (
    <figure className={`overflow-hidden rounded-2xl border ${accent ? "border-accent/30" : "border-white/10"}`}>
      <div className="flex h-56 items-center justify-center" style={CHECKERBOARD_STYLE}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className="max-h-full max-w-full object-contain" />
      </div>
      <figcaption className="flex items-center justify-between gap-3 border-t border-white/[0.07] bg-white/[0.02] px-4 py-3 text-xs">
        <span className={`font-medium uppercase tracking-widest ${accent ? "text-accent" : "text-white/50"}`}>
          {title}
        </span>
        <span className="text-white/45">{meta}</span>
      </figcaption>
    </figure>
  );
}