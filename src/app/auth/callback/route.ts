import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * OAuth callback for Supabase Auth (Google Sign-In).
 *
 * Supabase redirects the user here with a one-time `code` query parameter.
 * We exchange it for a session, which writes the auth cookies through the
 * server client, then send the user to the homepage.
 *
 * Every outcome (success, missing code, failed exchange) redirects to "/".
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        console.error("Supabase OAuth code exchange failed:", error.message);
      }
    } catch (err) {
      console.error("Unexpected error during Supabase OAuth callback:", err);
    }
  }

  return NextResponse.redirect(new URL("/", origin));
}