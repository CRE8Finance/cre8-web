# CRE8 Web

Static pages for CRE8, exported from the design project.

| Page | File |
|---|---|
| Landing | `index.html` |
| Testnet waitlist (not deployed) | `waitlist.html` |
| Web app (prototype) | `app.html` |
| Portfolios, How it works, Compare (EN + 简体 `/zh`) | `portfolios/`, `how-it-works/`, `compare/`, `zh/` (generated) |

## Run locally

No build step. Serve the folder with any static server:

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

Opening the files straight from disk (`file://`) won't work, because the pages load their runtime by relative URL.

## How the pages work

Each page is a self-contained HTML file. `support.js` renders the markup inside `<x-dc>` and runs the small `Component` class in each page's `<script type="text/x-dc">`. It loads React 18.3.1 and Babel 7.29.0 from unpkg at runtime.

- `app/`: portfolio cover images and ticker logos
- `assets/`: logos and background photos

## Status

These are design prototypes. The waitlist's X connect, post check, Gmail, quiz and Telegram steps only simulate the flow in the browser. Nothing is sent anywhere yet.

## Static content pages

`portfolios/`, `how-it-works/`, `compare/`, `zh/`, `sitemap.xml` and `llms.txt` are plain HTML generated from the testnet API, so crawlers that don't run JavaScript can read them. The script also rewrites the `<!-- gen:... -->` blocks in `index.html` (Top portfolios, FAQ, FAQPage schema) and the How it works panel APY. Re-run it whenever the funds or their returns change:

```sh
node scripts/build-pages.mjs        # needs Node 18+, no dependencies
node --test scripts/test-worker.mjs # worker routing
```

Copy for the pages lives in the script (English fund descriptions follow cre8-app `src/lib/fund-copy.ts`). Edit the script, not the generated files.

## Deploy

Cloudflare Worker `cre8-web` (`wrangler.jsonc`, `_worker.js`). Run `npx wrangler deploy` in this folder.

- `cre8.finance`, `www.cre8.finance` → `index.html`; content pages serve `<path>/index.html`, unknown paths 301 to `/`
- `tst.cre8.finance` → `app.html`
- `waitlist.html` is left out (`.assetsignore`).

The 21 portfolios in `app.html` follow the launch lineup on tst (catalog keys, holdings and weights from `/api/strategies`, English copy from cre8-app `src/lib/fund-copy.ts`). The APY shown is the backend's `modelReturns.annualized` as of 2026-11-20.
