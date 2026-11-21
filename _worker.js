/**
 * Cloudflare Worker `cre8-web`：cre8.finance 是首頁（index.html），tst.cre8.finance 是 app（app.html）。
 * waitlist.html 不上線（.assetsignore 排除）。其他檔案照原路徑回靜態資源。
 */
const LANDING_HOSTS = ['cre8.finance', 'www.cre8.finance'];
const LANDING = 'https://cre8.finance';
const APP = 'https://tst.cre8.finance';

const isPage = (path) => !(path.split('/').pop() || '').includes('.');

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const host = url.hostname.toLowerCase();
    const path = url.pathname;
    const landing = LANDING_HOSTS.includes(host);
    const app = host === 'tst.cre8.finance';

    // 兩個網域之間的連結：首頁的 app.html 到 tst，app 的 index.html 回首頁。
    if (landing && path === '/app.html') return Response.redirect(APP + '/', 302);
    if (app && path === '/index.html') return Response.redirect(LANDING + '/', 302);

    // 頁面路徑（沒有副檔名，含舊版 app 的 /funds/... 等）都回這個網域的頁面。
    if (isPage(path)) {
      const page = app ? '/app.html' : '/index.html';
      return env.ASSETS.fetch(new Request(new URL(page, url), request));
    }
    return env.ASSETS.fetch(request);
  },
};
