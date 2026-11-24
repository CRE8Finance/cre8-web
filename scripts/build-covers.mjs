#!/usr/bin/env node
/**
 * Blog 封面：背景圖（cre8-visual-style 產生，放在 content/blog/covers/<slug>.jpg）＋文章標題，
 * 英文與簡體各一張，寫到 assets/blog/covers/<slug>.<en|zh>.jpg（1200×630，同時當文章頂圖與 og:image）。
 * 用本機 Chrome 截圖（macOS），字型用官網的 Switzer（標題）與 Geist。
 *
 *   node scripts/build-covers.mjs [slug ...] && node scripts/build-pages.mjs
 */
import { readFile, writeFile, mkdir, rm, mkdtemp, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const only = process.argv.slice(2);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const url = (rel) => pathToFileURL(join(ROOT, rel)).href;

async function title(slug, lang) {
  const src = await readFile(join(ROOT, 'content/blog', `${slug}.${lang}.md`), 'utf8');
  return src.match(/^#\s+(.+)$/m)[1].trim();
}

function card(bg, t, lang) {
  const zh = lang === 'zh';
  const n = [...t].length;
  const size = zh ? (n > 22 ? 66 : 76) : n > 60 ? 60 : 68;
  return `<!DOCTYPE html><html lang="${zh ? 'zh-Hans' : 'en'}"><head><meta charset="utf-8">
<link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=switzer@300,400&display=swap">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500&family=Noto+Sans+SC:wght@300;400&display=swap">
<style>
*{box-sizing:border-box;margin:0}
html,body{width:1200px;height:630px;overflow:hidden}
body{position:relative;background:#0B0F14 url('${bg}') center/cover no-repeat;font-family:'Geist','Noto Sans SC','PingFang SC',sans-serif}
.shade{position:absolute;inset:0;background:linear-gradient(90deg,rgba(243,245,247,.95) 0%,rgba(243,245,247,.88) 50%,rgba(243,245,247,.4) 70%,rgba(243,245,247,0) 84%)}
.t{position:absolute;left:64px;top:56px;bottom:56px;width:720px;display:flex;flex-direction:column}
.logo{height:34px;align-self:flex-start}
h1{margin-top:auto;font-family:'Switzer','Noto Sans SC','PingFang SC',sans-serif;font-weight:300;font-size:${size}px;line-height:1.1;letter-spacing:${zh ? '0' : '-.03em'};color:#0B0F14;text-wrap:balance}
.k{margin-top:24px;font-size:24px;letter-spacing:.12em;text-transform:uppercase;color:#4A5B6A}
</style></head><body><div class="shade"></div>
<div class="t"><img class="logo" src="${url('assets/cre8-logo-dark.svg')}" alt=""><h1>${esc(t)}</h1><div class="k">${zh ? 'CRE8 文章' : 'CRE8 Blog'}</div></div>
</body></html>`;
}

const slugs = (await readdir(join(ROOT, 'content/blog/covers'))).filter((f) => f.endsWith('.jpg')).map((f) => f.replace(/\.jpg$/, '')).filter((s) => !only.length || only.includes(s));
const tmp = await mkdtemp(join(tmpdir(), 'cre8-cover-'));
await mkdir(join(ROOT, 'assets/blog/covers'), { recursive: true });
for (const slug of slugs) {
  if (!existsSync(join(ROOT, 'content/blog', `${slug}.en.md`))) throw new Error(`封面 ${slug} 沒有對應文章`);
  for (const lang of ['en', 'zh']) {
    const html = join(tmp, `${slug}.${lang}.html`), png = join(tmp, `${slug}.${lang}.png`);
    await writeFile(html, card(url(`content/blog/covers/${slug}.jpg`), await title(slug, lang), lang));
    execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files', '--force-device-scale-factor=1', '--window-size=1200,630', '--virtual-time-budget=8000', `--user-data-dir=${join(tmp, 'profile')}`, `--screenshot=${png}`, pathToFileURL(html).href], { stdio: 'ignore' });
    execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '82', png, '--out', join(ROOT, 'assets/blog/covers', `${slug}.${lang}.jpg`)], { stdio: 'ignore' });
  }
  console.log('cover', slug);
}
await rm(tmp, { recursive: true, force: true });
console.log(`OK：${slugs.length * 2} 張封面寫到 assets/blog/covers/。`);
