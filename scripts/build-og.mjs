#!/usr/bin/env node
/**
 * 每個組合一張分享圖（og:image，1200×630），英文與簡體各一張，寫到 assets/og/<key>.jpg、<key>-zh.jpg。
 * 讀 scripts/og-data.json（build-pages.mjs 產生），用本機 Chrome 無頭模式截圖，再用 sips 轉 JPEG。只在 macOS 上跑。
 * 圖上只有名稱、分類、代號與封面，不放報酬率，所以成分或封面變了才需要重跑：
 *
 *   node scripts/build-pages.mjs && node scripts/build-og.mjs && node scripts/build-pages.mjs
 *
 * （第二次 build-pages 是讓新基金的頁面改指到剛產生的圖。）
 */
import { readFile, writeFile, mkdir, rm, mkdtemp } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const only = process.argv.slice(2);

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const url = (rel) => pathToFileURL(join(ROOT, rel)).href;

function card(f, lang) {
  const m = f[lang];
  const zh = lang === 'zh';
  const size = [...m.name].length > (zh ? 6 : 15) ? 76 : 96;
  const shown = f.tickers.slice(0, 8);
  const more = f.tickers.length - shown.length;
  return `<!DOCTYPE html><html lang="${zh ? 'zh-Hans' : 'en'}"><head><meta charset="utf-8">
<link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=switzer@300,400&display=swap">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500&family=Geist+Mono:wght@400;500&display=swap">
<style>
*{box-sizing:border-box;margin:0}
html,body{width:1200px;height:630px;overflow:hidden;background:#F3F5F7;color:#0B0F14}
body{display:grid;grid-template-columns:1fr 500px;font-family:'Geist','PingFang SC',sans-serif}
.l{padding:64px 56px 60px 72px;display:flex;flex-direction:column}
.logo{height:26px;align-self:flex-start}
.mid{margin-top:auto}
.kind{font-size:22px;letter-spacing:.14em;text-transform:uppercase;color:#5B6672}
h1{margin-top:18px;font-family:'Switzer','PingFang SC',sans-serif;font-weight:300;font-size:${size}px;line-height:1.02;letter-spacing:${zh ? '0' : '-.045em'}}
.tk{margin-top:36px;display:flex;flex-wrap:wrap;gap:10px}
.tk span{font-family:'Geist Mono',monospace;font-size:22px;padding:8px 14px;border-radius:999px;background:#fff;box-shadow:inset 0 0 0 1px rgba(11,15,20,.1)}
.r{position:relative;margin:28px 28px 28px 0;border-radius:24px;overflow:hidden;background:#E6EAEE}
.r img{width:100%;height:100%;object-fit:cover;object-position:50% 22%}
</style></head><body>
<div class="l"><img class="logo" src="${url('assets/cre8-logo-dark.svg')}" alt="">
<div class="mid"><div class="kind">${esc(m.kind)}</div><h1>${esc(m.name)}</h1>
<div class="tk">${shown.map((t) => `<span>${esc(t)}</span>`).join('')}${more > 0 ? `<span>+${more}</span>` : ''}</div></div></div>
<div class="r"><img src="${url(`app/${f.img}.jpg`)}" alt=""></div>
</body></html>`;
}

const funds = JSON.parse(await readFile(join(ROOT, 'scripts/og-data.json'), 'utf8')).filter((f) => !only.length || only.includes(f.key));
const tmp = await mkdtemp(join(tmpdir(), 'cre8-og-'));
await mkdir(join(ROOT, 'assets/og'), { recursive: true });
for (const f of funds) {
  for (const lang of ['en', 'zh']) {
    const name = f.key + (lang === 'zh' ? '-zh' : '');
    const html = join(tmp, name + '.html');
    const png = join(tmp, name + '.png');
    await writeFile(html, card(f, lang));
    execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files', '--force-device-scale-factor=1', '--window-size=1200,630', '--virtual-time-budget=8000', `--user-data-dir=${join(tmp, 'profile')}`, `--screenshot=${png}`, pathToFileURL(html).href], { stdio: 'ignore' });
    execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '82', png, '--out', join(ROOT, 'assets/og', name + '.jpg')], { stdio: 'ignore' });
  }
  console.log('og', f.key);
}
await rm(tmp, { recursive: true, force: true });
console.log(`OK：${funds.length * 2} 張分享圖寫到 assets/og/。`);
