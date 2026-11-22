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
