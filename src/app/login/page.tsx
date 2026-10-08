import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import LoginForm from "./LoginForm";

export const metadata: Metadata = {
  title: "Sign In | FixKit",
  description: "Sign in to FixKit with your Google account.",
};

export default function LoginPage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-ink text-white">
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-ink/70 backdrop-blur-xl">
        <nav aria-label="Main" className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <Link href="/" className="text-lg font-bold tracking-[0.2em]">
            FIX<span className="text-accent">KIT</span>
          </Link>

          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-white/60 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to FixKit
          </Link>
        </nav>
      </header>

      <main>
        <section className="bg-grid relative isolate flex min-h-[calc(100vh-4rem)] items-center px-5 py-16 sm:px-8">
          <div className="hero-glow" aria-hidden="true" />

          <div className="mx-auto w-full max-w-md">
            <div className="text-center">
              <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
                Welcome to <span className="text-gradient">FixKit</span>
              </h1>
              <p className="mx-auto mt-4 max-w-sm text-base leading-relaxed text-white/60">
                Sign in to keep your digital tools in one simple place.
              </p>
            </div>

            <div className="mt-10">
              <LoginForm />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}