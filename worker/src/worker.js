/*
 * Karbon proxy — Cloudflare Worker.
 *
 * The planner is a public static site, so it must NOT hold the Karbon API
 * credentials. This Worker sits between the site and Karbon: it holds the
 * secrets, checks a shared staff passphrase, and returns only the minimal
 * client/contact fields the planner needs (name, email, address).
 *
 * Secrets (set with `wrangler secret put <NAME>` — never commit these):
 *   KARBON_BEARER_TOKEN   the Karbon API bearer/access token
 *   KARBON_ACCESS_KEY     the Karbon "AccessKey" header value
 *   APP_PASSPHRASE        the shared passphrase staff type into the planner
 *
 * Vars (wrangler.toml or dashboard):
 *   ALLOWED_ORIGIN        the site origin allowed to call this (CORS)
 *   KARBON_BASE_URL       Karbon API base, default https://api.karbonhq.com/v3
 *
 * Endpoint:  GET /search?q=<name>     header: X-Passphrase: <passphrase>
 *            -> { results: [ { type, name, email, address, id } ] }
 */

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    const url = new URL(request.url);
    if (request.method !== "GET" || !url.pathname.replace(/\/+$/, "").endsWith("/search")) {
      return json({ error: "Not found" }, 404, cors);
    }

    // Shared-passphrase auth (constant-time compare).
    const given = request.headers.get("X-Passphrase") || "";
    if (!env.APP_PASSPHRASE || !timingSafeEqual(given, env.APP_PASSPHRASE)) {
      return json({ error: "Unauthorized — check the passphrase." }, 401, cors);
    }

    const q = (url.searchParams.get("q") || "").trim();
    if (q.length < 2) return json({ results: [] }, 200, cors);

    try {
      const results = await searchKarbon(q, env);
      return json({ results }, 200, cors);
    } catch (e) {
      return json({ error: "Karbon lookup failed: " + (e && e.message ? e.message : String(e)) }, 502, cors);
    }
  },
};

/* ---- Karbon -------------------------------------------------------------- *
 * NOTE: Karbon's API shapes can vary by tenant/version. The field mapping
 * below is best-effort against the v3 Contacts/Organizations endpoints — once
 * you can test against your tenant, adjust `pick()` and the query if needed.
 * Everything else (auth, CORS, the planner UI) is independent of these details.
 */
async function searchKarbon(q, env) {
  const base = (env.KARBON_BASE_URL || "https://api.karbonhq.com/v3").replace(/\/+$/, "");
  const headers = {
    Authorization: `Bearer ${env.KARBON_BEARER_TOKEN}`,
    AccessKey: env.KARBON_ACCESS_KEY,
    Accept: "application/json",
  };
  const filter = `contains(tolower(FullName),'${odataEscape(q.toLowerCase())}')`;
  const endpoints = [
    { type: "contact", url: `${base}/Contacts?$top=10&$filter=${encodeURIComponent(filter)}` },
    { type: "organization", url: `${base}/Organizations?$top=10&$filter=${encodeURIComponent(`contains(tolower(Name),'${odataEscape(q.toLowerCase())}')`)}` },
  ];

  const results = [];
  for (const ep of endpoints) {
    const res = await fetch(ep.url, { headers });
    if (!res.ok) continue; // skip an endpoint that isn't available on this tenant
    const data = await res.json();
    const items = Array.isArray(data) ? data : (data.value || data.Value || []);
    for (const it of items) results.push(pick(it, ep.type));
  }
  return results.slice(0, 15);
}

/* Map a Karbon record to the minimal shape the planner uses. */
function pick(it, type) {
  const name = it.FullName || it.Name || it.fullName || it.name || "(unnamed)";
  const email =
    it.EmailAddress || it.Email || it.PrimaryEmail ||
    (Array.isArray(it.EmailAddresses) && it.EmailAddresses[0] &&
      (it.EmailAddresses[0].Address || it.EmailAddresses[0].EmailAddress)) || "";
  const a = (Array.isArray(it.Addresses) && it.Addresses[0]) || it.Address || null;
  const address = a
    ? [a.AddressLines || a.Line1, a.City || a.Town, a.PostalCode || a.Postcode, a.CountryCode || a.Country]
        .filter(Boolean).join(", ")
    : "";
  const id = it.ContactKey || it.OrganizationKey || it.Key || it.Id || it.id || "";
  return { type, name, email, address, id };
}

function odataEscape(s) { return String(s).replace(/'/g, "''"); }

/* ---- helpers ------------------------------------------------------------- */
function corsHeaders(request, env) {
  const allowed = env.ALLOWED_ORIGIN || "*";
  const origin = request.headers.get("Origin") || "";
  const allowOrigin = allowed === "*" ? "*" : (origin === allowed ? origin : allowed);
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "X-Passphrase, Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function json(body, status, cors) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}

/* Constant-time string comparison to avoid leaking the passphrase via timing. */
function timingSafeEqual(a, b) {
  a = String(a); b = String(b);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
