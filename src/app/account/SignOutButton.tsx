"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function SignOutButton() {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignOut = async () => {
    if (isSigningOut) return;

    setError(null);
    setIsSigningOut(true);

    try {
      const supabase = createClient();
      const { error: signOutError } = await supabase.auth.signOut();

      if (signOutError) {
        setError("Couldn't sign out. Please try again.");
        setIsSigningOut(false);
        return;
      }

      // Go home first, then refresh so server components re-read the (now empty) session.
      router.replace("/");
      router.refresh();
    } catch {
      setError("Couldn't sign out. Please try again.");
      setIsSigningOut(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={handleSignOut}
        disabled={isSigningOut}
        aria-busy={isSigningOut}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/10 px-6 py-3 text-base font-medium text-white/80 transition hover:border-red-400/40 hover:text-red-300 focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSigningOut ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Signing out…
          </>
        ) : (
          <>
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Sign Out
          </>
        )}
      </button>

      {error && (
        <div
          role="alert"
          className="mt-4 flex items-start gap-3 rounded-xl border border-red-400/25 bg-red-400/[0.07] px-4 py-3 text-sm text-red-200"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>{error}</p>
        </div>
      )}
    </div>
  );
}