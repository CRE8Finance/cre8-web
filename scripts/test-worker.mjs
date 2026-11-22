// _worker.js 的路由測試：node --test scripts/test-worker.mjs（先跑過 build-pages.mjs，讓頁面檔存在）。
// ASSETS 用這個資料夾裡的真實檔案模擬（照 .assetsignore 排除的檔案回 404）。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
// _worker.js 是 ES module，但資料夾沒有 package.json，複製成 .mjs 再載入。
const tmp = await mkdtemp(join(tmpdir(), 'cre8-worker-'));
await writeFile(join(tmp, 'worker.mjs'), await readFile(join(ROOT, '_worker.js'), 'utf8'));
const worker = (await import(pathToFileURL(join(tmp, 'worker.mjs')).href)).default;
const ignored = (await readFile(join(ROOT, '.assetsignore'), 'utf8')).split('\n').map((s) => s.trim()).filter(Boolean);

const env = {
  ASSETS: {
    async fetch(req) {
      const p = decodeURIComponent(new URL(req.url).pathname);
      if (ignored.some((x) => p === '/' + x || p.startsWith('/' + x + '/'))) return new Response('nope', { status: 404 });
      try {
        const body = await readFile(join(ROOT, p));
        const type = p.endsWith('.html') ? 'text/html' : p.endsWith('.xml') ? 'application/xml' : 'application/octet-stream';
        return new Response(body, { headers: { 'content-type': type } });
      } catch { return new Response('not found', { status: 404 }); }
    },
  },
};
const get = (url) => worker.fetch(new Request(url, { redirect: 'manual' }), env);
const loc = (res) => res.headers.get('location');

const FUND_PAGES = ['/portfolios/pelosi', '/portfolios/ai-chips', '/portfolios/tqqq'];
const PAGES = ['/portfolios', '/how-it-works', '/compare', '/zh', '/zh/portfolios', '/zh/how-it-works', '/zh/compare', ...FUND_PAGES, ...FUND_PAGES.map((p) => '/zh' + p)];

test('新頁面在 cre8.finance 回 200 和自己的 HTML', async () => {
  for (const p of PAGES) {
    const res = await get('https://cre8.finance' + p);
    assert.equal(res.status, 200, p);
    const html = await res.text();
    assert.match(html, new RegExp(`<link rel="canonical" href="https://cre8\\.finance${p.replace(/\//g, '\\/')}">`), p);
    assert.equal(res.headers.get('x-robots-tag'), null, p);
  }
});

test('首頁仍是 index.html', async () => {
  const res = await get('https://cre8.finance/');
  assert.equal(res.status, 200);
  assert.match(await res.text(), /The Home of <br>Productive Portfolios/);
});

test('不存在的頁面 301 回 /', async () => {
  for (const p of ['/nope', '/portfolios/nope', '/zh/nope', '/funds/pelosi', '/waitlist']) {
    const res = await get('https://cre8.finance' + p);
    assert.equal(res.status, 301, p);
    assert.equal(loc(res), 'https://cre8.finance/', p);
  }
});

test('index.html 與結尾斜線 301 到正式網址', async () => {
  const cases = { '/index.html': 'https://cre8.finance/', '/zh/index.html': 'https://cre8.finance/zh', '/portfolios/pelosi/index.html': 'https://cre8.finance/portfolios/pelosi', '/how-it-works/': 'https://cre8.finance/how-it-works', '/zh/': 'https://cre8.finance/zh' };
  for (const [p, to] of Object.entries(cases)) {
    const res = await get('https://cre8.finance' + p);
    assert.equal(res.status, 301, p);
    assert.equal(loc(res), to, p);
  }
});

test('http 與 www 轉到 https://cre8.finance', async () => {
  let res = await get('http://cre8.finance/compare');
  assert.equal(res.status, 301);
  assert.equal(loc(res), 'https://cre8.finance/compare');
  res = await get('https://www.cre8.finance/zh');
  assert.equal(res.status, 301);
  assert.equal(loc(res), 'https://cre8.finance/zh');
});

test('sitemap 與 robots：首頁網域列出全部頁面', async () => {
  const res = await get('https://cre8.finance/sitemap.xml');
  assert.equal(res.status, 200);
  const xml = await res.text();
  for (const p of PAGES) assert.ok(xml.includes(`<loc>https://cre8.finance${p}</loc>`), p);
  assert.ok(xml.includes('<loc>https://cre8.finance/</loc>'));
  assert.match(await (await get('https://cre8.finance/robots.txt')).text(), /Sitemap: https:\/\/cre8\.finance\/sitemap\.xml/);
});

test('tst 仍然 noindex、頁面路徑回 app.html、沒有 sitemap', async () => {
  const robots = await (await get('https://tst.cre8.finance/robots.txt')).text();
  assert.doesNotMatch(robots, /Sitemap/);
  for (const p of ['/', '/portfolios/pelosi', '/funds/1']) {
    const res = await get('https://tst.cre8.finance' + p);
    assert.equal(res.status, 200, p);
    assert.equal(res.headers.get('x-robots-tag'), 'noindex, nofollow', p);
    const html = await res.text();
    assert.doesNotMatch(html, /The Home of <br>Productive Portfolios/, p);
  }
  assert.equal((await get('https://tst.cre8.finance/sitemap.xml')).status, 404);
  const ix = await get('https://tst.cre8.finance/index.html');
  assert.equal(ix.status, 302);
  assert.equal(loc(ix), 'https://cre8.finance/');
});

test('workers.dev 也 noindex', async () => {
  const res = await get('https://cre8-web.example.workers.dev/how-it-works');
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('x-robots-tag'), 'noindex, nofollow');
});

test('scripts/ 不會被當成靜態檔送出', async () => {
  const res = await get('https://cre8.finance/scripts/build-pages.mjs');
  assert.equal(res.status, 404);
});
