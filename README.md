# CRE8 Web

Static pages for CRE8, exported from the design project.

| Page | File |
|---|---|
| Landing | `index.html` |
| Waitlist (`cre8.finance/waitlist`) | `waitlist.html` |
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

- Waitlist: Connect X (Privy, through `assets/vendor/cre8-wallet.js`), then Follow @CRE8Finance adds you with `POST /api/waitlist/join`; joined users see `GET /api/waitlist/me`. The bonus tasks (post, Gmail, quiz, Telegram) have no backend yet: they stay on the page, disabled, marked “coming soon” (`TASKS_LIVE` in `waitlist.html`).
- App (`tst.cre8.finance`): invite-only. The first screen is the sign-in gate (invite code + X for new users; X, Google or email for approved users); nothing else renders until you're signed in.

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
- `cre8.finance/waitlist` → `waitlist.html` (`/waitlist.html` and `tst.cre8.finance/waitlist` redirect there). On the landing domain `/api` only forwards `/api/auth/*` and `/api/waitlist/*`, which the waitlist page needs.
- All landing and content-page CTAs say “Join waitlist” and link to `/waitlist` (content pages: `scripts/build-pages.mjs`).
- `/api/*` on `tst.cre8.finance` and `localhost` is forwarded to the testnet backend (Railway `website` service, see `API_ORIGIN` in `_worker.js`). The landing domain doesn't forward it.

## Testnet data in `app.html`

The app reads live data from the backend through `/api` (same origin, so no CORS):

- Discover cards: APY is `modelReturns.annualized` from `GET /api/strategies`.
- Portfolio page: the chart is the model NAV (`modelNav`) from `GET /api/strategies/:id`; holdings and weights come from the active version; volatility and max drawdown are computed from the NAV.

`python3 -m http.server` doesn't run the worker, so `/api` won't work there. To try it locally run the worker:

```sh
npx wrangler dev --port 5241 --local-upstream localhost:5241
# open http://localhost:5241/app.html
```

(`--local-upstream localhost` makes the worker see a local host; without it wrangler uses the first route, `cre8.finance`, and you get the landing page.)

### Sign-in, holdings, buy and sell (`assets/vendor/cre8-wallet.js`)

`app.html` has no build step, so the wallet code is one prebuilt file, `assets/vendor/cre8-wallet.js` (about 6 MB, loaded only when someone has signed in before or is about to sign in). It exposes `window.CRE8W`: Privy sign-in (X with invite code, Google, email), the CRE8 session, Kernel UserOps, first-time account setup, test USDT, buy, sell and My mix. It is cre8-app's own code (same files that run in production there), wired up by `scripts/vendor/wallet-entry.tsx`. React comes from the page (`window.React` 18.3.1, the one `support.js` loads).

Rebuild it after cre8-app changes (Bun 1.4+):

```sh
git -C ../cre8-app fetch
bun scripts/build-vendor.ts
# options: CRE8_APP_DIR=../cre8-app  CRE8_APP_REF=origin/main  CRE8_APP_NODE_MODULES=<a cre8-app node_modules installed at that ref>
```

The script exports cre8-app's `src` at that ref to a temp folder, links an installed cre8-app `node_modules` (it checks the Privy, ZeroDev and viem versions match), reads `.env.production` from that ref (chain 97, Privy app ID, `/api`), and writes the bundle with the cre8-app commit in its first line.

Privy only runs on origins allowed in the Privy dashboard (now `tst.cre8.finance`), so on localhost the sign-in sheet opens but Privy can't finish. Add `http://localhost:5241` there to test sign-in locally.

### Not wired yet (waiting on the backend)

- Earn (`docs/EARN_UX.zh-TW.md`): cash Earn vault list, Earning row, Withdraw, the "Earn extra" switch on the buy review and fund page. Screens and states are in place and show "Coming soon"; `loadEarn()` and the `earn` branches in `confirm()` are the hook points.
- Name, avatar and basket cover saved on the server (now kept only in the tab).
- Portfolio value history chart on Profile (flat line until there is an endpoint).
- My mix with all 103 assets: the backend and cre8-app's mix catalog still allow 40.

The 21 portfolios in `app.html` follow the launch lineup on tst (catalog keys, holdings and weights from `/api/strategies`, English copy from cre8-app `src/lib/fund-copy.ts`). The APY shown is the backend's `modelReturns.annualized` as of 2026-11-20.
