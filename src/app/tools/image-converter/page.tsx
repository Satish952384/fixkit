import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import ImageConverter from "./ImageConverter";

export const metadata: Metadata = {
  title: "Convert Image | FixKit",
  description: "Convert images between JPG, PNG, and WebP directly in your browser. Fast, private, and simple.",
};

export default function ImageConverterPage() {
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
                href="/"
                className="inline-flex items-center gap-2 text-sm text-white/60 transition-colors hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Home
              </Link>
            </li>
            <li>
              <Link href="/#tools" className="text-sm text-white/60 transition-colors hover:text-white">
                All tools
              </Link>
            </li>
          </ul>
        </nav>
      </header>

      <main>
        <section className="bg-grid relative isolate px-5 pb-24 pt-14 sm:px-8 sm:pt-20">
          <div className="hero-glow" aria-hidden="true" />

          <div className="mx-auto max-w-3xl">
            <div className="text-center">
              <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl md:text-6xl">
                Convert <span className="text-gradient">Image</span>
              </h1>
              <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-white/60 sm:text-lg">
                Convert images between JPG, PNG, and WebP directly in your browser. Fast, private, and simple.
              </p>
            </div>

            <div className="mt-10">
              <ImageConverter />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}