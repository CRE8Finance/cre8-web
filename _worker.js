/**
 * Cloudflare Worker `cre8-web`：cre8.finance 是首頁（index.html），tst.cre8.finance 是 app（app.html）。
 * waitlist.html 不上線（.assetsignore 排除）。其他檔案照原路徑回靜態資源。
 * SEO：一律 https；首頁網域的內容頁（/portfolios/...、/how-it-works、/compare、/zh/...）各回自己的 <路徑>/index.html，
 * 這些頁面由 scripts/build-pages.mjs 產生；不存在的頁面路徑 301 回 /。tst 與 workers.dev 不給收錄。
 */
const LANDING_HOSTS = ['cre8.finance', 'www.cre8.finance'];
const LANDING = 'https://cre8.finance';
const APP = 'https://tst.cre8.finance';

const isPage = (path) => !(path.split('/').pop() || '').includes('.');

const ROBOTS_LANDING = `User-agent: *
Allow: /

Sitemap: ${LANDING}/sitemap.xml
`;
const ROBOTS_NOINDEX = `User-agent: *
Allow: /
`;

// ---- /api/*：轉發到後端（只在 tst 與 localhost） ----------------------------------------------
// 照 cre8-app `public/_worker.js` 的 proxyApi：路徑原樣轉、保留 /api 前綴（Railway 的 website 服務自己剝掉再轉給 API）；
// 只轉 Authorization／Content-Type／Accept／Idempotency-Key，cookie 與其他標頭不轉；X-Forwarded-For 用 Cloudflare 看到的來源 IP；
// 不跟隨轉址；30 秒逾時回 504、連不上回 502；上游的狀態與 body 原樣回傳，只拿掉 set-cookie。
const API_ORIGIN = 'https://website-production-d8e9f7cc.up.railway.app';
const API_FORWARDED_HEADERS = ['authorization', 'content-type', 'accept', 'idempotency-key'];
const API_TIMEOUT_MS = 30_000;

const apiError = (status, code, message) => Response.json({ error: { code, message } }, { status, headers: { 'cache-control': 'no-store' } });

async function proxyApi(request, url) {
  const headers = new Headers();
  for (const name of API_FORWARDED_HEADERS) {
    const value = request.headers.get(name);
    if (value !== null) headers.set(name, value);
  }
  const client = request.headers.get('cf-connecting-ip');
  if (client) headers.set('x-forwarded-for', client);
  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  let res;
  try {
    res = await fetch(API_ORIGIN + url.pathname + url.search, {
      method: request.method, headers, body: hasBody ? request.body : undefined, redirect: 'manual', signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });
  } catch (cause) {
    const timedOut = cause && (cause.name === 'TimeoutError' || cause.name === 'AbortError');
    return timedOut ? apiError(504, 'UPSTREAM_TIMEOUT', 'The server took too long to answer') : apiError(502, 'UPSTREAM_UNAVAILABLE', 'The server could not be reached');
  }
  const out = new Headers(res.headers);
  out.delete('set-cookie');
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: out });
}

const text = (body, type) => new Response(body, { headers: { 'content-type': type, 'cache-control': 'public, max-age=3600' } });

// 圖、字型、vendor 檔名沒有 hash，快取一天、背景再驗證一週；HTML 每次驗證。
function withHeaders(res, path, noindex) {
  const h = new Headers(res.headers);
  h.set('strict-transport-security', 'max-age=31536000; includeSubDomains');
  if (noindex) h.set('x-robots-tag', 'noindex, nofollow');
  if (/\.(webp|jpe?g|png|svg|ico|js|css|woff2?)$/i.test(path) && res.ok) h.set('cache-control', 'public, max-age=86400, stale-while-revalidate=604800');
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const host = url.hostname.toLowerCase();
    const path = url.pathname;
    const landing = LANDING_HOSTS.includes(host);
    const app = host === 'tst.cre8.finance';
    const local = host === 'localhost' || host === '127.0.0.1';

    // 一律 https；www 併到主網域。
    if (url.protocol === 'http:' && !local) { url.protocol = 'https:'; return Response.redirect(url.toString(), 301); }
    if (host === 'www.cre8.finance') return Response.redirect(LANDING + path + url.search, 301);

    // app（tst）與本機：/api/* 轉給後端。首頁網域不開。
    if ((app || local) && (path === '/api' || path.startsWith('/api/'))) return proxyApi(request, url);

    // 兩個網域之間的連結：首頁的 app.html 到 tst，app 的 index.html 回首頁。
    if (landing && path === '/app.html') return Response.redirect(APP + '/', 302);
    if (app && path === '/index.html') return Response.redirect(LANDING + '/', 302);

    const noindex = !landing && !local; // tst 與 workers.dev
    if (path === '/robots.txt') return text(noindex ? ROBOTS_NOINDEX : ROBOTS_LANDING, 'text/plain; charset=utf-8');
    // sitemap.xml 是產生器寫的靜態檔，只給首頁網域。
    if (path === '/sitemap.xml' && noindex) return new Response('Not found', { status: 404 });

    // 每頁只有一個網址：/x/index.html 與結尾斜線 301 到 /x。
    if (landing && /(^|\/)index\.html$/.test(path)) return Response.redirect(LANDING + (path.slice(0, -'/index.html'.length) || '/'), 301);
    if (!app && isPage(path) && path !== '/') {
      if (path.endsWith('/')) return Response.redirect((landing ? LANDING : url.origin) + path.replace(/\/+$/, ''), 301);
      // 內容頁：回 <路徑>/index.html；首頁網域上不存在的頁面 301 回 /。
      const page = await env.ASSETS.fetch(new Request(new URL(path + '/index.html', url), request));
      if (page.ok) return withHeaders(page, path, noindex);
      if (landing) return Response.redirect(LANDING + '/', 301);
    }

    // 其餘頁面路徑（tst 上含舊版 app 的 /funds/... 等）都回這個網域的單頁。
    let res;
    if (isPage(path)) {
      const page = app ? '/app.html' : '/index.html';
      res = await env.ASSETS.fetch(new Request(new URL(page, url), request));
    } else {
      res = await env.ASSETS.fetch(request);
    }
    return withHeaders(res, path, noindex);
  },
};
