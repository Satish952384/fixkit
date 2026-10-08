"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, Loader2, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

function GoogleLogo() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.44a5.5 5.5 0 0 1-2.39 3.61v3h3.86c2.26-2.09 3.58-5.17 3.58-8.85Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.56.38-2.29V6.62H1.29A12 12 0 0 0 0 12c0 1.94.46 3.77 1.29 5.38l3.98-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75Z"
      />
    </svg>
  );
}

export default function LoginForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    if (isLoading) return;

    setError(null);
    setIsLoading(true);

    try {
      const supabase = createClient();
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (oauthError) {
        setError("We couldn't start Google sign-in. Please try again.");
        setIsLoading(false);
      }
      // On success the browser is redirected to Google, so loading stays on
      // until the page unloads. This also prevents duplicate clicks.
    } catch {
      setError("Something went wrong while starting sign-in. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <div className="glass rounded-3xl p-6 sm:p-8">
      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={isLoading}
        aria-busy={isLoading}
        className="inline-flex w-full items-center justify-center gap-3 rounded-full bg-white px-6 py-3.5 text-base font-semibold text-ink transition hover:bg-white/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:bg-white"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            Redirecting to Google…
          </>
        ) : (
          <>
            <GoogleLogo />
            Continue with Google
          </>
        )}
      </button>

      {error && (
        <div
          role="alert"
          className="mt-5 flex items-start gap-3 rounded-xl border border-red-400/25 bg-red-400/[0.07] px-4 py-3 text-sm text-red-200"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>{error}</p>
        </div>
      )}

      <p className="sr-only" role="status" aria-live="polite">
        {isLoading ? "Redirecting to Google" : ""}
      </p>

      <p className="mt-6 flex items-center justify-center gap-2 text-center text-xs text-white/40">
        <ShieldCheck className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
        We only use your Google account to sign you in.
      </p>

      <div className="mt-6 border-t border-white/[0.07] pt-5 text-center">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-white/50 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to FixKit
        </Link>
      </div>
    </div>
  );
}