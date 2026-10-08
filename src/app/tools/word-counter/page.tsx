import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import WordCounter from "./WordCounter";

export const metadata: Metadata = {
  title: "Word Counter | FixKit",
  description: "Count words, characters, sentences, paragraphs, and reading time instantly in your browser.",
};

export default function WordCounterPage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-ink text-white">
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-ink/70 backdrop-blur-xl">
        <nav aria-label="Main" className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <Link href="/" className="text-lg font-bold tracking-[0.2em]">
            FIX<span className="text-accent">KIT</span>
          </Link>

          <ul className="flex items-center gap-6">
            <li>
              <Link
                href="/tools"
                className="inline-flex items-center gap-2 text-sm text-white/60 transition-colors hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Back to Tools
              </Link>
            </li>
          </ul>
        </nav>
      </header>

      <main>
        <section className="bg-grid relative isolate px-5 pb-24 pt-14 sm:px-8 sm:pt-20">
          <div className="hero-glow" aria-hidden="true" />

          <div className="mx-auto max-w-4xl">
            <div className="text-center">
              <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl md:text-6xl">
                Word <span className="text-gradient">Counter</span>
              </h1>
              <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-white/60 sm:text-lg">
                Count words, characters, sentences, paragraphs, and reading time instantly.
              </p>
            </div>

            <div className="mt-10">
              <WordCounter />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}