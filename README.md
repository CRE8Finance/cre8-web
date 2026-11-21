# CRE8 Web

Static pages for CRE8, exported from the design project.

| Page | File |
|---|---|
| Landing | `index.html` |
| Testnet waitlist | `waitlist.html` |
| Web app (prototype) | `app.html` |

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
