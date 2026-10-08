import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Mail, ShieldCheck, User as UserIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "./SignOutButton";

export const metadata: Metadata = {
  title: "Your Account | FixKit",
  description: "Manage your FixKit account.",
  robots: { index: false, follow: false },
};

/** Only accept https image URLs; user metadata is not fully trusted. */
function safeAvatarUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

export default async function AccountPage() {
  const supabase = await createClient();

  // getUser() verifies the session with Supabase Auth instead of trusting the cookie contents.
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  const metadata_ = user.user_metadata ?? {};
  const displayName = readString(metadata_.full_name) ?? readString(metadata_.name);
  const avatarUrl = safeAvatarUrl(metadata_.avatar_url) ?? safeAvatarUrl(metadata_.picture);
  const email = user.email ?? "No email on this account";

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
        <section className="bg-grid relative isolate px-5 pb-24 pt-14 sm:px-8 sm:pt-20">
          <div className="hero-glow" aria-hidden="true" />

          <div className="mx-auto max-w-md">
            <h1 className="text-center text-4xl font-semibold tracking-tight sm:text-5xl">
              Your <span className="text-gradient">Account</span>
            </h1>

            <div className="glass mt-10 rounded-3xl p-6 sm:p-8">
              <div className="flex items-center gap-4">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarUrl}
                    alt={displayName ? `Profile picture of ${displayName}` : "Your profile picture"}
                    width={64}
                    height={64}
                    referrerPolicy="no-referrer"
                    className="h-16 w-16 shrink-0 rounded-full border border-white/10 object-cover"
                  />
                ) : (
                  <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent ring-1 ring-accent/20">
                    <UserIcon className="h-7 w-7" aria-hidden="true" />
                  </span>
                )}

                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-widest text-white/40">Signed in with Google</p>
                  <p className="mt-1 truncate text-lg font-semibold" title={displayName ?? email}>
                    {displayName ?? "FixKit user"}
                  </p>
                </div>
              </div>

              <dl className="mt-6 space-y-3 text-sm">
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3">
                  <dt className="flex items-center gap-2 text-white/40">
                    <Mail className="h-4 w-4" aria-hidden="true" />
                    Email
                  </dt>
                  <dd className="mt-1 break-all font-medium">{email}</dd>
                </div>
                {displayName && (
                  <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3">
                    <dt className="flex items-center gap-2 text-white/40">
                      <UserIcon className="h-4 w-4" aria-hidden="true" />
                      Name
                    </dt>
                    <dd className="mt-1 font-medium">{displayName}</dd>
                  </div>
                )}
              </dl>

              <div className="mt-6">
                <SignOutButton />
              </div>

              <p className="mt-5 flex items-center justify-center gap-2 text-center text-xs text-white/40">
                <ShieldCheck className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
                Your files are still processed only in your browser.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}