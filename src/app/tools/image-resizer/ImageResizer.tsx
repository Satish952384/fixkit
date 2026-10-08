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
  Link2,
  Link2Off,
  Loader2,
  Maximize2,
  RotateCcw,
  SlidersHorizontal,
} from "lucide-react";

/* -------------------------------------------------------------------------- */
/*  Config                                                                    */
/* -------------------------------------------------------------------------- */

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_PIXELS = 50_000_000; // 50 megapixels (source images)
const MAX_OUTPUT_PIXELS = 50_000_000; // 50 megapixels (resized output)
const MAX_DIMENSION = 16_384; // conservative per-side canvas limit
const DEFAULT_QUALITY = 90;

const ACCEPTED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
type AcceptedMime = (typeof ACCEPTED_MIME_TYPES)[number];

type OutputFormat = "original" | "jpeg" | "png" | "webp";

type Preset = 25 | 50 | 75 | 100 | "custom";
const PRESETS: { value: Preset; label: string }[] = [
  { value: 25, label: "25%" },
  { value: 50, label: "50%" },
  { value: 75, label: "75%" },
  { value: 100, label: "100%" },
  { value: "custom", label: "Custom" },
];

const FORMAT_OPTIONS: { value: OutputFormat; label: string; hint: string }[] = [
  { value: "original", label: "Original", hint: "Keep the current format" },
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

function resolveOutputMime(inputMime: AcceptedMime, format: OutputFormat): AcceptedMime {
  if (format === "jpeg") return "image/jpeg";
  if (format === "png") return "image/png";
  if (format === "webp") return "image/webp";
  return inputMime;
}

/** PNG is lossless: the canvas ignores any quality value for it. */
function isLossyMime(mime: AcceptedMime): boolean {
  return mime !== "image/png";
}

function buildOutputName(originalName: string, mime: AcceptedMime, width: number, height: number): string {
  const dot = originalName.lastIndexOf(".");
  const base = dot > 0 ? originalName.slice(0, dot) : originalName;
  return `${base}-${width}x${height}.${EXTENSION_BY_MIME[mime]}`;
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
          reject(new Error("Resizing failed. The image may be too large for your browser. Try smaller dimensions."));
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

async function resizeImage(
  file: File,
  outputMime: AcceptedMime,
  width: number,
  height: number,
  quality: number,
): Promise<Blob> {
  const sourceUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(sourceUrl);

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

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
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

/** Parses a dimension field. Returns null when empty/invalid. */
function parseDimension(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

type SourcePreview = { url: string; width: number; height: number };

type ResizeResult = {
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

export default function ImageResizer() {
  const inputRef = useRef<HTMLInputElement>(null);
  const widthId = useId();
  const heightId = useId();
  const qualityId = useId();
  const dimensionErrorId = useId();
  const formatNameId = useId();

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<SourcePreview | null>(null);
  const [result, setResult] = useState<ResizeResult | null>(null);

  const [widthText, setWidthText] = useState("");
  const [heightText, setHeightText] = useState("");
  const [lockAspect, setLockAspect] = useState(true);
  const [preset, setPreset] = useState<Preset>(100);

  const [format, setFormat] = useState<OutputFormat>("original");
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
      setWidthText(String(width));
      setHeightText(String(height));
      setPreset(100);
      setLockAspect(true);
      setFormat("original");
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

  /* ------------------------------ Dimensions ------------------------------ */

  const applyPreset = (value: Preset) => {
    setPreset(value);
    if (!preview || value === "custom") return;
    const w = Math.max(1, Math.round((preview.width * value) / 100));
    const h = Math.max(1, Math.round((preview.height * value) / 100));
    setWidthText(String(w));
    setHeightText(String(h));
  };

  const handleWidthChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (!preview) return;
    const value = e.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
    setWidthText(value);
    setPreset("custom");
    if (lockAspect) {
      const w = parseDimension(value);
      setHeightText(w ? String(Math.max(1, Math.round((w * preview.height) / preview.width))) : "");
    }
  };

  const handleHeightChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (!preview) return;
    const value = e.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
    setHeightText(value);
    setPreset("custom");
    if (lockAspect) {
      const h = parseDimension(value);
      setWidthText(h ? String(Math.max(1, Math.round((h * preview.width) / preview.height))) : "");
    }
  };

  const toggleLock = () => {
    if (!preview) return;
    const next = !lockAspect;
    setLockAspect(next);
    // When re-locking, snap height to match the current width.
    if (next) {
      const w = parseDimension(widthText);
      if (w) setHeightText(String(Math.max(1, Math.round((w * preview.height) / preview.width))));
    }
  };

  const targetWidth = parseDimension(widthText);
  const targetHeight = parseDimension(heightText);

  let dimensionError: string | null = null;
  if (widthText === "" || heightText === "" || !targetWidth || !targetHeight) {
    dimensionError = "Enter a width and height greater than 0.";
  } else if (targetWidth > MAX_DIMENSION || targetHeight > MAX_DIMENSION) {
    dimensionError = `Each side can be at most ${MAX_DIMENSION.toLocaleString()} px.`;
  } else if (targetWidth * targetHeight > MAX_OUTPUT_PIXELS) {
    dimensionError = "The output is larger than 50 megapixels. Please choose smaller dimensions.";
  }

  /* ------------------------------ Processing ------------------------------ */

  const handleResize = async () => {
    if (!file || isProcessing || dimensionError || !targetWidth || !targetHeight) return;
    const sourceMime = normalizeMime(file.type);
    if (!sourceMime) return;

    setError(null);
    setIsProcessing(true);

    // Let the loading state paint before the (synchronous-heavy) canvas work begins.
    await new Promise<void>((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));

    try {
      const outputMime = resolveOutputMime(sourceMime, format);
      const blob = await resizeImage(file, outputMime, targetWidth, targetHeight, quality);

      setResult({
        url: URL.createObjectURL(blob),
        size: blob.size, // real size of the encoded Blob
        width: targetWidth,
        height: targetHeight,
        mime: outputMime,
        fileName: buildOutputName(file.name, outputMime, targetWidth, targetHeight),
        qualityApplied: isLossyMime(outputMime) ? quality : null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong while resizing. Please try again.");
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
    setWidthText("");
    setHeightText("");
    setPreset(100);
    setLockAspect(true);
    setFormat("original");
    setQuality(DEFAULT_QUALITY);
  };

  const inputMime = file ? normalizeMime(file.type) : null;
  const effectiveMime = inputMime ? resolveOutputMime(inputMime, format) : null;
  const showQuality = effectiveMime !== null && isLossyMime(effectiveMime);

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
    const changeLabel = `${isLarger ? "+" : "−"}${Math.abs(changePct).toFixed(0)}%`;
    const resultIsLossless = result.qualityApplied === null;

    return (
      <div className="glass rounded-3xl p-5 sm:p-7">
        <div className="flex items-center gap-2 text-sm font-medium text-accent">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          Resize complete
        </div>

        <dl className="mt-5 grid grid-cols-3 gap-3">
          <Stat label="Original" value={formatBytes(file.size)} />
          <Stat label="Output" value={formatBytes(result.size)} />
          <Stat label={isLarger ? "Larger by" : "Smaller by"} value={changeLabel.slice(1)} highlight={!isLarger} warn={isLarger} />
        </dl>

        <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3">
            <dt className="text-white/40">Dimensions</dt>
            <dd className="mt-0.5 font-medium">
              {result.width} × {result.height} px
            </dd>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3">
            <dt className="text-white/40">Format</dt>
            <dd className="mt-0.5 font-medium">{LABEL_BY_MIME[result.mime]}</dd>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3">
            <dt className="text-white/40">Size change</dt>
            <dd className="mt-0.5 font-medium">{changeLabel}</dd>
          </div>
        </dl>

        <p className="mt-4 text-sm text-white/50">
          {resultIsLossless ? "Lossless PNG output." : `Quality ${result.qualityApplied}%.`} Resized from{" "}
          {preview.width} × {preview.height} px.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <PreviewCard
            title="Original"
            src={preview.url}
            alt={`Original image ${file.name}`}
            meta={`${preview.width} × ${preview.height} px`}
          />
          <PreviewCard
            title="Resized"
            src={result.url}
            alt={`Resized version of ${file.name}`}
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
            Download Image
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
            Start over
          </button>
        </div>
      </div>
    );
  }

  /* --------------------- Selected image / controls state ------------------- */
  const numberInputClass =
    "mt-2 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 font-mono text-base text-white placeholder:text-white/30 transition focus:border-accent/60 focus:outline-none focus:ring-4 focus:ring-accent/10 disabled:cursor-not-allowed disabled:opacity-50";

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
        {/* Presets */}
        <fieldset disabled={isProcessing}>
          <legend className="text-sm font-medium">Size preset</legend>
          <div className="mt-3 grid grid-cols-5 gap-2">
            {PRESETS.map((p) => (
              <label key={String(p.value)} className="cursor-pointer">
                <input
                  type="radio"
                  name="resize-preset"
                  value={String(p.value)}
                  checked={preset === p.value}
                  onChange={() => applyPreset(p.value)}
                  className="peer sr-only"
                />
                <span className="flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.02] px-2 py-2.5 text-sm font-medium transition hover:border-white/25 peer-checked:border-accent/60 peer-checked:bg-accent/[0.07] peer-checked:text-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent peer-disabled:opacity-50">
                  {p.label}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {/* Width / height */}
        <fieldset disabled={isProcessing}>
          <legend className="sr-only">Output dimensions in pixels</legend>
          <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
            <div>
              <label htmlFor={widthId} className="text-sm font-medium">
                Width (px)
              </label>
              <input
                id={widthId}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={widthText}
                onChange={handleWidthChange}
                aria-invalid={dimensionError ? true : undefined}
                aria-describedby={dimensionError ? dimensionErrorId : undefined}
                className={numberInputClass}
              />
            </div>

            <button
              type="button"
              onClick={toggleLock}
              disabled={isProcessing}
              role="switch"
              aria-checked={lockAspect}
              aria-label="Lock aspect ratio"
              title={lockAspect ? "Aspect ratio locked" : "Aspect ratio unlocked"}
              className={`mb-0.5 flex h-12 w-12 items-center justify-center rounded-xl border transition focus-visible:outline-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                lockAspect
                  ? "border-accent/50 bg-accent/10 text-accent"
                  : "border-white/10 bg-white/[0.03] text-white/50 hover:border-white/25 hover:text-white"
              }`}
            >
              {lockAspect ? (
                <Link2 className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Link2Off className="h-5 w-5" aria-hidden="true" />
              )}
            </button>

            <div>
              <label htmlFor={heightId} className="text-sm font-medium">
                Height (px)
              </label>
              <input
                id={heightId}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={heightText}
                onChange={handleHeightChange}
                aria-invalid={dimensionError ? true : undefined}
                aria-describedby={dimensionError ? dimensionErrorId : undefined}
                className={numberInputClass}
              />
            </div>
          </div>

          <p className="mt-2 text-xs text-white/40">
            Aspect ratio is {lockAspect ? "locked" : "unlocked"}.{" "}
            {lockAspect ? "Changing one side updates the other." : "Width and height change independently."}
          </p>

          {dimensionError && (
            <p id={dimensionErrorId} role="alert" className="mt-2 flex items-center gap-2 text-sm text-red-300">
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              {dimensionError}
            </p>
          )}
        </fieldset>

        {/* Output format */}
        <fieldset disabled={isProcessing}>
          <legend id={formatNameId} className="text-sm font-medium">
            Output format
          </legend>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
                  <span className="text-sm font-medium">
                    {option.label}
                    {option.value === "original" && inputMime ? ` (${LABEL_BY_MIME[inputMime]})` : ""}
                  </span>
                  <span className="mt-0.5 text-xs text-white/45">{option.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

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
            {effectiveMime === "image/jpeg" && (
              <InfoNote>JPEG doesn&apos;t support transparency. Any transparent areas will become white.</InfoNote>
            )}
          </div>
        )}

        {!showQuality && effectiveMime === "image/png" && (
          <InfoNote>PNG is lossless, so there is no quality setting. Resizing changes the dimensions only.</InfoNote>
        )}
      </div>

      {/* Output summary */}
      {!dimensionError && targetWidth && targetHeight && (
        <p className="mt-7 flex flex-wrap items-center gap-x-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white/60">
          <Maximize2 className="h-4 w-4 text-accent" aria-hidden="true" />
          <span className="font-mono text-white/80">
            {preview.width} × {preview.height}
          </span>
          <ArrowRight className="h-4 w-4 text-accent" aria-hidden="true" />
          <span className="font-mono font-medium text-accent">
            {targetWidth} × {targetHeight}
          </span>
          <span>px</span>
        </p>
      )}

      {error && <ErrorMessage message={error} />}

      <button
        type="button"
        onClick={handleResize}
        disabled={isProcessing || dimensionError !== null}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-7 py-4 text-base font-semibold text-ink transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:brightness-100"
      >
        {isProcessing ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            Resizing…
          </>
        ) : (
          <>
            <Maximize2 className="h-5 w-5" aria-hidden="true" />
            Resize Image
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </>
        )}
      </button>

      <p className="sr-only" role="status" aria-live="polite">
        {isProcessing ? "Resizing your image" : ""}
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