"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Loader2, LogOut, User as UserIcon } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

/**
 * Auth area for the navbar.
 *
 * - Logged out: a "Sign In" link to /login.
 * - Logged in: an account link (to /account) showing the email, plus a separate "Sign Out" button.
 *
 * The session comes from Supabase Auth (cookie-based via @supabase/ssr), so it
 * survives page refreshes. Nothing is stored manually, and no service-role key is used.
 * This component only controls what is displayed; real access control for
 * protected pages happens on the server.
 */
export default function AuthNav() {
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] = useState<User | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let supabase: ReturnType<typeof createClient>;

    try {
      supabase = createClient();
    } catch {
      // Missing env variables: treat as logged out instead of crashing the navbar.
      setUser(null);
      setIsReady(true);
      return;
    }

    // Read the existing session (restored from cookies after a refresh).
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        setUser(data.session?.user ?? null);
        setIsReady(true);
      })
      .catch(() => {
        if (!active) return;
        setUser(null);
        setIsReady(true);
      });

    // Keep the UI in sync with sign-in, sign-out and token refresh events
    // (including sign-outs that happen in another tab).
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setUser(session?.user ?? null);
      setIsReady(true);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    if (isSigningOut) return;

    setError(null);
    setIsSigningOut(true);

    try {
      const supabase = createClient();
      const { error: signOutError } = await supabase.auth.signOut();

      if (signOutError) {
        setError("Couldn't sign out. Please try again.");
        return;
      }

      // Update the UI immediately; the auth listener will also confirm it.
      setUser(null);

      // Leave protected pages, then re-read server state.
      if (pathname.startsWith("/account")) {
        router.replace("/");
      }
      router.refresh();
    } catch {
      setError("Couldn't sign out. Please try again.");
    } finally {
      setIsSigningOut(false);
    }
  };

  // Reserve the space while the session loads so the navbar doesn't jump or flash "Sign In".
  if (!isReady) {
    return <span className="h-9 w-20 rounded-full bg-white/[0.05]" aria-hidden="true" />;
  }

  if (!user) {
    return (
      <Link
        href="/login"
        className="rounded-full px-4 py-2 text-sm text-white/70 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-accent"
      >
        Sign In
      </Link>
    );
  }

  const email = user.email ?? "Account";
  const isOnAccountPage = pathname.startsWith("/account");

  return (
    <div className="relative flex items-center gap-1 sm:gap-2">
      <Link
        href="/account"
        title={email}
        aria-label={`Your account (${email})`}
        aria-current={isOnAccountPage ? "page" : undefined}
        className={`flex h-9 min-w-0 items-center gap-2 rounded-full border bg-white/[0.04] px-2.5 text-sm transition hover:border-accent/50 hover:bg-accent/[0.06] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:px-3.5 ${
          isOnAccountPage ? "border-accent/40 text-white" : "border-white/10 text-white/80"
        }`}
      >
        <UserIcon className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
        <span className="hidden max-w-[11rem] truncate sm:inline">{email}</span>
      </Link>

      <button
        type="button"
        onClick={handleSignOut}
        disabled={isSigningOut}
        aria-busy={isSigningOut}
        aria-label="Sign Out"
        className="inline-flex h-9 items-center gap-2 rounded-full px-2.5 text-sm text-white/70 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:text-white/70 sm:px-3"
      >
        {isSigningOut ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <LogOut className="h-4 w-4" aria-hidden="true" />
        )}
        <span className="hidden sm:inline">{isSigningOut ? "Signing out…" : "Sign Out"}</span>
      </button>

      {error && (
        <p
          role="alert"
          className="absolute right-0 top-full z-50 mt-2 w-max max-w-[16rem] rounded-xl border border-red-400/25 bg-red-400/[0.07] px-3 py-2 text-xs text-red-200"
        >
          {error}
        </p>
      )}
    </div>
  );
}