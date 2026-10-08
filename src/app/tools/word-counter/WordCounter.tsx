"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { AlertCircle, Check, Copy, ShieldCheck, Trash2 } from "lucide-react";

/* -------------------------------------------------------------------------- */
/*  Config                                                                    */
/* -------------------------------------------------------------------------- */

const WORDS_PER_MINUTE = 200;
const COPY_FEEDBACK_MS = 2000;

/* -------------------------------------------------------------------------- */
/*  Text analysis                                                             */
/* -------------------------------------------------------------------------- */

type TextStats = {
  words: number;
  characters: number;
  charactersNoSpaces: number;
  sentences: number;
  paragraphs: number;
  readingTime: string;
};

const EMPTY_STATS: TextStats = {
  words: 0,
  characters: 0,
  charactersNoSpaces: 0,
  sentences: 0,
  paragraphs: 0,
  readingTime: "< 1 min",
};

/** Words are runs of non-whitespace characters, so tabs, line breaks and repeated spaces are handled. */
function countWords(text: string): number {
  const trimmed = text.trim();
  if (trimmed === "") return 0;
  return trimmed.split(/\s+/).length;
}

/**
 * Sentences end with one or more of . ! ? (plus optional closing quotes/brackets)
 * followed by whitespace or the end of the text. "Wait...", "What?!" and "Hi!!" each count once.
 * Text with no terminal punctuation still counts as one sentence if it contains any words.
 * Decimals such as "3.14" and "a.b" are not treated as sentence ends, because no whitespace follows the dot.
 */
function countSentences(text: string): number {
  const trimmed = text.trim();
  if (trimmed === "") return 0;

  const matches = trimmed.match(/[^.!?\s][^.!?]*[.!?]+["'”’)\]]*(?=\s|$)/g);
  const counted = matches ? matches.length : 0;

  // Trailing text that has no closing punctuation (e.g. "Hello world. This has no end")
  const lastTerminator = Math.max(
    trimmed.lastIndexOf("."),
    trimmed.lastIndexOf("!"),
    trimmed.lastIndexOf("?"),
  );
  const tail = lastTerminator === -1 ? trimmed : trimmed.slice(lastTerminator + 1);
  const hasUnterminatedTail = /[\p{L}\p{N}]/u.test(tail) && !/^["'”’)\]]*\s*$/.test(tail);

  if (counted === 0) return 1;
  return counted + (hasUnterminatedTail && !/[.!?]["'”’)\]]*$/.test(trimmed) ? 1 : 0);
}

/** Paragraphs are blocks of text separated by one or more blank lines. Empty/whitespace-only blocks are ignored. */
function countParagraphs(text: string): number {
  if (text.trim() === "") return 0;
  return text.split(/(?:\r?\n[ \t]*){2,}/).filter((block) => block.trim() !== "").length;
}

function formatReadingTime(words: number): string {
  if (words === 0) return "< 1 min";
  const minutes = Math.ceil(words / WORDS_PER_MINUTE);
  return minutes <= 1 ? "< 1 min" : `${minutes} min`;
}

function analyzeText(text: string): TextStats {
  if (text === "") return EMPTY_STATS;

  const words = countWords(text);
  return {
    words,
    // Spread counts Unicode code points, so emoji count as one character instead of two.
    characters: Array.from(text).length,
    charactersNoSpaces: Array.from(text.replace(/\s/g, "")).length,
    sentences: countSentences(text),
    paragraphs: countParagraphs(text),
    readingTime: formatReadingTime(words),
  };
}

const numberFormat = new Intl.NumberFormat("en-US");

/* -------------------------------------------------------------------------- */
/*  Component                                                                 */
/* -------------------------------------------------------------------------- */

type CopyState = "idle" | "copied" | "error";

export default function WordCounter() {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaId = useId();

  const [text, setText] = useState("");
  const [copyState, setCopyState] = useState<CopyState>("idle");

  // Stats are derived from the text, so they are computed rather than stored in state.
  const stats = useMemo(() => analyzeText(text), [text]);

  // Clear any pending feedback timer on unmount.
  useEffect(() => {
    return () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    };
  }, []);

  const showCopyFeedback = (state: CopyState) => {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    setCopyState(state);
    resetTimerRef.current = setTimeout(() => setCopyState("idle"), COPY_FEEDBACK_MS);
  };

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
  };

  const handleClear = () => {
    setText("");
    setCopyState("idle");
    textareaRef.current?.focus();
  };

  const copyWithFallback = (value: string): boolean => {
    // Fallback for browsers or contexts without the async Clipboard API.
    const textarea = textareaRef.current;
    if (!textarea) return false;
    const previousStart = textarea.selectionStart;
    const previousEnd = textarea.selectionEnd;
    textarea.focus();
    textarea.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    textarea.setSelectionRange(previousStart, previousEnd);
    return ok && value === textarea.value;
  };

  const handleCopy = async () => {
    if (text === "") return;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        showCopyFeedback("copied");
        return;
      }
      showCopyFeedback(copyWithFallback(text) ? "copied" : "error");
    } catch {
      showCopyFeedback(copyWithFallback(text) ? "copied" : "error");
    }
  };

  const isEmpty = text === "";

  const statCards: { label: string; value: string }[] = [
    { label: "Words", value: numberFormat.format(stats.words) },
    { label: "Characters", value: numberFormat.format(stats.characters) },
    { label: "No spaces", value: numberFormat.format(stats.charactersNoSpaces) },
    { label: "Sentences", value: numberFormat.format(stats.sentences) },
    { label: "Paragraphs", value: numberFormat.format(stats.paragraphs) },
    { label: "Reading time", value: stats.readingTime },
  ];

  const actionButtonClass =
    "inline-flex items-center justify-center gap-2 rounded-full border border-white/10 px-5 py-2.5 text-sm font-medium text-white/80 transition hover:border-white/25 hover:text-white focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-white/10 disabled:hover:text-white/80";

  return (
    <div className="space-y-5">
      {/* Editor */}
      <div className="glass rounded-3xl p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label htmlFor={textareaId} className="text-sm font-medium">
            Your text
          </label>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              disabled={isEmpty}
              aria-label="Copy text to clipboard"
              className={`${actionButtonClass} ${
                copyState === "copied" ? "border-accent/50 text-accent hover:border-accent/50 hover:text-accent" : ""
              }`}
            >
              {copyState === "copied" ? (
                <Check className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Copy className="h-4 w-4" aria-hidden="true" />
              )}
              {copyState === "copied" ? "Copied!" : "Copy"}
            </button>
            <button
              type="button"
              onClick={handleClear}
              disabled={isEmpty}
              aria-label="Clear all text"
              className={`${actionButtonClass} hover:border-red-400/40 hover:text-red-300`}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Clear
            </button>
          </div>
        </div>

        <textarea
          ref={textareaRef}
          id={textareaId}
          value={text}
          onChange={handleChange}
          spellCheck={true}
          placeholder="Start typing or paste your text here…"
          className="mt-4 block h-72 min-h-[12rem] w-full resize-y rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-base leading-relaxed text-white placeholder:text-white/30 transition focus:border-accent/60 focus:outline-none focus:ring-4 focus:ring-accent/10 sm:h-96 sm:px-5"
        />

        {copyState === "error" && (
          <p className="mt-4 flex items-start gap-2 text-sm text-red-300">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            Couldn&apos;t copy automatically. Select the text and press Ctrl+C (or ⌘C) instead.
          </p>
        )}

        <p className="sr-only" role="status" aria-live="polite">
          {copyState === "copied" ? "Text copied to clipboard" : copyState === "error" ? "Copy failed" : ""}
        </p>

        <p className="mt-5 flex items-center justify-center gap-2 text-center text-xs text-white/40">
          <ShieldCheck className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
          Your text stays in your browser.
        </p>
      </div>

      {/* Statistics */}
      <section aria-labelledby="stats-heading" className="glass rounded-3xl p-5 sm:p-7">
        <h2 id="stats-heading" className="text-xs font-medium uppercase tracking-widest text-white/40">
          Statistics
        </h2>

        <dl className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {statCards.map((card, index) => (
            <div
              key={card.label}
              className={`min-w-0 rounded-2xl border px-3 py-4 text-center sm:px-4 ${
                index === 0 ? "border-accent/30 bg-accent/[0.08]" : "border-white/[0.08] bg-white/[0.03]"
              }`}
            >
              <dt className="truncate text-xs uppercase tracking-widest text-white/45">{card.label}</dt>
              <dd
                className={`mt-1.5 truncate text-2xl font-semibold tabular-nums sm:text-3xl ${
                  index === 0 ? "text-accent" : "text-white"
                }`}
              >
                {card.value}
              </dd>
            </div>
          ))}
        </dl>

        <p className="mt-4 text-xs text-white/40">
          Reading time assumes about {WORDS_PER_MINUTE} words per minute.
        </p>
      </section>
    </div>
  );
}