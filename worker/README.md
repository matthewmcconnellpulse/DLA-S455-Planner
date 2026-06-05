# Karbon proxy (Cloudflare Worker)

A tiny serverless proxy that lets the **public** planner pull client/contact details from
Karbon **without ever exposing the Karbon API keys**. The Worker holds the secrets, checks a
shared staff passphrase, locks CORS to your site, and returns only name/email/address.

```
Planner (GitHub Pages)  ──X-Passphrase──►  this Worker  ──Bearer + AccessKey──►  Karbon API
```

## One-time setup

1. **Install Wrangler & log in** (needs a free Cloudflare account):
   ```bash
   npm i -g wrangler          # or use: npx wrangler ...
   wrangler login
   ```

2. **Set the secrets** (encrypted — never committed):
   ```bash
   cd worker
   wrangler secret put KARBON_BEARER_TOKEN   # your Karbon API bearer/access token
   wrangler secret put KARBON_ACCESS_KEY     # your Karbon "AccessKey" header value
   wrangler secret put APP_PASSPHRASE        # a passphrase you share with Pulse staff
   ```
   (Generate the Karbon credentials in Karbon: *Settings → API/Developer*.)

3. **Check `wrangler.toml`** — set `ALLOWED_ORIGIN` to your published site origin
   (default `https://matthewmcconnellpulse.github.io`).

4. **Deploy:**
   ```bash
   wrangler deploy
   ```
   You'll get a URL like `https://karbon-proxy.<your-subdomain>.workers.dev`.

5. **Connect the planner:** open the planner → **🔗 Karbon** → paste that proxy URL and the
   passphrase. They're saved in your browser only. Staff each enter the passphrase once.

## Endpoint

```
GET /search?q=<name>      header:  X-Passphrase: <passphrase>
→ { "results": [ { "type": "contact|organization", "name", "email", "address", "id" } ] }
```

## Notes & security

- The passphrase is a light gate suitable for an internal tool (your choice). It travels over
  HTTPS and is compared in constant time. Rotate it any time with `wrangler secret put APP_PASSPHRASE`.
- CORS is restricted to `ALLOWED_ORIGIN`, so other sites can't call your proxy from a browser.
- The Karbon field mapping in `src/worker.js` (`pick()` / the OData filter) is best-effort against
  the v3 Contacts/Organizations endpoints. Once you can test against your tenant, adjust those if
  the field names differ — the auth/CORS/UI parts won't need to change.
- Want stronger auth later (SSO / email allowlist)? Cloudflare Access can sit in front of this
  Worker without code changes.
