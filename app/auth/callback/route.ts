import { type NextRequest, NextResponse } from "next/server";

/**
 * OAuth callback handler for all Supabase identity providers.
 *
 * After a successful OAuth flow (e.g. Twitter via linkIdentity), Supabase
 * redirects here with either:
 *   - PKCE:     ?code=XXX  (supabase-js client auto-exchanges via detectSessionInUrl)
 *   - Implicit: #access_token=XXX  (handled client-side; not visible server-side)
 *   - Error:    ?error=access_denied&error_description=...
 *
 * This route normalises all three cases into a clean client-side redirect so
 * the TwitterLinkSync component has a single, predictable entry point.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const error = url.searchParams.get("error");
  const code = url.searchParams.get("code");

  // Twitter denied access or any upstream OAuth error
  if (error) {
    const dest = new URL("/command-center", url.origin);
    dest.searchParams.set("error", error);
    const desc = url.searchParams.get("error_description");
    if (desc) dest.searchParams.set("error_description", desc);
    return NextResponse.redirect(dest);
  }

  // Happy path: redirect to command-center.
  // If a PKCE code is present, pass it through — the supabase-js client will
  // exchange it automatically on the next page load (detectSessionInUrl: true).
  const dest = new URL("/command-center", url.origin);
  dest.searchParams.set("linked", "twitter");
  if (code) dest.searchParams.set("code", code);

  return NextResponse.redirect(dest);
}
