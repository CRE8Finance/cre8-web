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

Each portfolio page has its own share image (`assets/og/<key>.jpg`, `<key>-zh.jpg`), made by `node scripts/build-og.mjs` (macOS with Chrome). It shows the name, category, tickers and cover, no returns, so re-run it only when a portfolio is added or its holdings or cover change, then run `build-pages.mjs` again.

Blog posts live in `content/blog/<slug>.<en|zh>.md` (written and reviewed in the seo-aeo-geo repo, then copied here). `scripts/blog.mjs` turns them into `/blog/<slug>` and `/zh/blog/<slug>`, adds BlogPosting schema, and lists them in the sitemap and llms.txt. To add a post, add its slug to `BLOG_ORDER` in `scripts/blog.mjs`; both languages are required.

Copy for the pages lives in the script (English fund descriptions follow cre8-app `src/lib/fund-copy.ts`). Edit the script, not the generated files.

The 简体 home page (`zh/index.html`) and waitlist (`zh/waitlist/index.html`) aren't written separately: the script reads `index.html` and `waitlist.html`, applies the translation tables in `scripts/zh-home.json` and `scripts/zh-waitlist.json`, and writes the result, so layout, images, animation and template stay identical. If an English string in a table no longer appears on the English page, or English text is left untranslated, the build stops and names it. After changing copy on `index.html` or `waitlist.html`, update the table and re-run the script.

## Deploy

Cloudflare Worker `cre8-web` (`wrangler.jsonc`, `_worker.js`). Run `npx wrangler deploy` in this folder.

- `cre8.finance`, `www.cre8.finance` → `index.html`; content pages serve `<path>/index.html`, unknown paths 301 to `/`
- `tst.cre8.finance` → `app.html`
- `cre8.finance/waitlist` → `waitlist.html` (`/waitlist.html` and `tst.cre8.finance/waitlist` redirect there). On the landing domain `/api` only forwards `/api/auth/*` and `/api/waitlist/*`, which the waitlist page needs.
- While sign-up is open, all landing and content-page CTAs say “Launch app” and link to the testnet app (content pages: `scripts/build-pages.mjs`); with invites back on they say “Join waitlist” and link to `/waitlist`.
- `/api/*` on `tst.cre8.finance` and `localhost` is forwarded to the testnet backend (Railway `website` service, see `API_ORIGIN` in `_worker.js`). The landing domain doesn't forward it.

## Languages in `app.html` (English, 简体中文)

The app speaks English and Simplified Chinese. The language is picked in this order: `?lang=zh` or `?lang=en` in the URL (saved to `localStorage` `cre8.lang`, then removed from the URL), the saved choice, the browser language (`zh*` → Chinese), English. The button next to the account pill (and top right on the sign-in gate) switches instantly: it reads “中文” in English and “EN” in Chinese. Switching updates `<html lang>` and the title.

- Template text is `{{ t.key }}` from `STR` in the page script; text built in code uses `tr(english, chinese)`.
- Chinese fund names and descriptions (`ZH_FUND`) match the `zh` copy in `scripts/build-pages.mjs`; keep them in sync. Asset names are in `NAMES_ZH`.
- Chinese text uses the system Chinese font (PingFang SC, Noto Sans SC) through `@font-face` aliases on Geist and Geist Mono with a CJK `unicode-range`; Latin letters and numbers stay in Geist.
- `assets/vendor/cre8-wallet.js` follows `<html lang>`: its own messages are bilingual, and English messages from cre8-app code (trade failures, test USDT, setup errors) are mapped to Chinese in `scripts/vendor/wallet-entry.tsx`. Unknown ones show a general Chinese line and log the original to the console. The page calls `CRE8W.relang()` after switching.

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

`app.html` has no build step, so the wallet code is one prebuilt file, `assets/vendor/cre8-wallet.js` (about 6 MB, loaded only when someone has signed in before or is about to sign in). It exposes `window.CRE8W`: Privy sign-in (X with invite code, Google, email), the CRE8 session, Kernel UserOps, first-time account setup, test USDT, buy, sell, My mix and Earn. It is cre8-app's own code (same files that run in production there), wired up by `scripts/vendor/wallet-entry.tsx`. React comes from the page (`window.React` 18.3.1, the one `support.js` loads).

Rebuild it after cre8-app changes (Bun 1.4+):

```sh
git -C ../cre8-app fetch
bun scripts/build-vendor.ts
# options: CRE8_APP_DIR=../cre8-app  CRE8_APP_REF=origin/main  CRE8_APP_NODE_MODULES=<a cre8-app node_modules installed at that ref>
```

The script exports cre8-app's `src` at that ref to a temp folder, links an installed cre8-app `node_modules` (it checks the Privy, ZeroDev and viem versions match), reads `.env.production` from that ref (chain 97, Privy app ID, `/api`), and writes the bundle with the cre8-app commit in its first line.

Privy only runs on origins allowed in the Privy dashboard (now `tst.cre8.finance`), so on localhost the sign-in sheet opens but Privy can't finish. Add `http://localhost:5241` there to test sign-in locally.

### Earn (`docs/EARN_UX.zh-TW.md`)

Three kinds of money are always shown apart: wallet cash (Available), Cash Earn (Earning) and each portfolio's Earn extra position. Portfolio values are net of the Earn extra loan.

- Cash Earn: the Cash row's button is "Earn x%" with the best rate from `GET /api/earn/vaults`; it goes straight to the amount page with that vault, and the button there asks the wallet to sign (no extra review page; the wallet prompt is the confirmation). The amount page reads "Deposit to [Venus 5.1%]", where the second half is an iOS-style wheel (scroll-snap; touch, mouse wheel or tap the row above/below) listing every whitelisted vault with its live rate; it starts on the best rate and greys out vaults that aren't taking deposits (the wheel won't stop on them). The Earning row's button is "Take out" (the header's "Withdraw" stays for sending out). `CRE8W.earnDeposit` / `earnWithdraw` ask `/me/earn/deposit|withdraw` for calls, send them from the owner wallet (plain transactions, gas topped up like a buy), then record them with `/me/earn/confirm`. Withdraw takes any amount or Max and spreads across vault positions; if a vault is short on cash it says how much can come out now.
- Earn extra: `GET /api/strategy-earn/markets` gives `extraApyBps` per asset; a fund's rate is the weighted sum over its eligible holdings. The buy review card shows "Earn +x%" as the headline, off by default, hidden under 0.3%, when rates can't be read, on leveraged funds and own baskets. If it's on, `CRE8W.buy({ earnExtra: true })` asks `POST /portfolios/:id/strategy-earn/auto` for the consent calls (plus the session-key renewal when it says `renewal_required`) and signs them in the same UserOp as the buy's approvals, so stocks bought while the market is closed get Earn extra once they fill (backend#204). Selling goes through the normal sell: the backend repays and takes the shares back first, and what's left stays in Earn extra. The fund page row shows on/rate/earned and can turn it on (`strategyOpen`) or off (`strategyClose`). Earn extra events (`/strategy-earn/activity`: safety repays, rewards, on/off) appear in Activity as one plain sentence each. Portfolio value = `/status` total (already includes shares put up for Earn extra) + `earnNetUsd`.
- Every Earn screen has a small "Details" link that opens a drawer: where the money is (protocol, BscScan links), where the yield comes from, safety lines (LTV bar) and how to get out. Contract addresses and the liquidation line are copied from the backend profile until the API returns them (backend#209).
- When the backend can't read rates or balances it returns `status: "unavailable"`; the app shows "Temporarily unavailable" and never an error code.

### Not wired yet (waiting on the backend)

- Name, avatar and basket cover saved on the server (now kept only in the tab).
- Portfolio value history chart on Profile (flat line until there is an endpoint).
- My mix with all 103 assets: the backend and cre8-app's mix catalog still allow 40.

The 21 portfolios in `app.html` follow the launch lineup on tst (catalog keys, holdings and weights from `/api/strategies`, English copy from cre8-app `src/lib/fund-copy.ts`). The APY shown is the backend's `modelReturns.annualized` as of 2026-11-20.
