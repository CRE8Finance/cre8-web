/**
 * Blog：讀 content/blog/<slug>.<en|zh>.md，轉成 HTML 片段給 build-pages.mjs 套版。
 * 原稿在 seo-aeo-geo repo（content/drafts），定稿後複製過來；改文章改 .md，不改產生出來的頁面。
 * 只支援文章用到的 markdown：front matter、# 標題、段落、- / 1. 清單、表格、---、[連結](url)、**粗體**。
 */
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { loadCharts, chartHtml } from './blog-charts.mjs';

// 文章順序（列表頁照這個排；第 1 篇是總覽）。新文章加在這裡。
export const BLOG_ORDER = [
  'what-is-cre8',
  'buy-us-stocks-with-usdt',
  'what-is-bstock',
  'bstock-vs-xstocks-vs-ondo',
  'buy-tokenized-stocks-on-bnb-chain',
  'binance-bstock-vs-cre8',
  'buy-us-stock-basket-with-usdt',
  'copy-pelosi-portfolio-with-crypto',
  'dca-us-stocks-with-usdt',
  'earn-yield-on-usdt-and-bstock',
  'how-to-buy-on-cre8',
  'cre8-portfolios-explained',
  'build-your-own-portfolio',
  'is-cre8-safe',
];

const escHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// 行內：先跳脫，再轉連結與粗體。站外連結開新分頁並加 rel。
function inline(text) {
  let s = escHtml(text);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, href) => {
    const ext = /^https?:\/\//.test(href) && !href.startsWith('https://cre8.finance');
    const url = href.startsWith('https://cre8.finance') ? href.slice('https://cre8.finance'.length) || '/' : href;
    return `<a href="${url}"${ext ? ' rel="noopener" target="_blank"' : ''}>${label}</a>`;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  return s;
}

const cells = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());

function mdToHtml(md, lang, charts) {
  const lines = md.split('\n');
  const out = [];
  let para = [];
  const flush = () => { if (para.length) { out.push(`<p>${inline(para.join(' '))}</p>`); para = []; } };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const t = line.trim();
    if (!t) { flush(); continue; }
    // 截圖佔位（[截图：…]／[Screenshot: …]）等實際截圖補上前不輸出。
    if (/^\[(截图|Screenshot)[：:]/.test(t)) { flush(); continue; }
    let m;
    // 數據圖：![chart](chart:<id>)，資料在 content/blog/charts/<id>.json。
    if ((m = t.match(/^!\[chart\]\(chart:([\w-]+)\)$/))) { flush(); const c = charts[m[1]]; if (!c) throw new Error(`blog：找不到數據圖 ${m[1]}`); out.push(chartHtml(c, lang)); continue; }
    // 圖片：![alt](/assets/blog/x.webp)，獨立一行。
    if ((m = t.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/))) { flush(); out.push(`<figure class="post-fig"><img src="${m[2]}" alt="${escHtml(m[1])}" loading="lazy" decoding="async"></figure>`); continue; }
    if ((m = t.match(/^(#{2,4})\s+(.*)$/))) { flush(); const n = m[1].length; out.push(`<h${n}>${inline(m[2])}</h${n}>`); continue; }
    if (/^---+$/.test(t)) { flush(); out.push('<hr>'); continue; }
    if (t.startsWith('|') && i + 1 < lines.length && /^\|?\s*:?-{3,}/.test(lines[i + 1].trim())) {
      flush();
      const headCells = cells(t);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) { rows.push(cells(lines[i])); i++; }
      i--;
      out.push(`<div class="table-wrap"><table class="cmp post-table"><thead><tr>${headCells.map((c) => `<th scope="col">${inline(c)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c, j) => (j === 0 ? `<th scope="row">${inline(c)}</th>` : `<td>${inline(c)}</td>`)).join('')}</tr>`).join('')}</tbody></table></div>`);
      continue;
    }
    if ((m = t.match(/^([-*]|\d+\.)\s+/))) {
      flush();
      const ordered = /\d/.test(m[1]);
      const items = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) { items.push(lines[i].trim().replace(/^([-*]|\d+\.)\s+/, '')); i++; }
      i--;
      const tag = ordered ? 'ol' : 'ul';
      out.push(`<${tag}>${items.map((x) => `<li>${inline(x)}</li>`).join('')}</${tag}>`);
      continue;
    }
    para.push(t);
  }
  flush();
  return out.join('\n');
}

const plain = (md) => md.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();

function parse(src, file, lang, charts) {
  const fm = src.match(/^---\n([\s\S]*?)\n---\n/);
  if (!fm) throw new Error(`${file}：沒有 front matter`);
  const meta = Object.fromEntries(fm[1].split('\n').map((l) => l.match(/^(\w+):\s*(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].trim()]));
  let body = src.slice(fm[0].length).trim();
  // 原稿的「# 標題」與署名行由版型產生，這裡拿掉。
  const h1 = body.match(/^#\s+(.+)\n/);
  if (!h1) throw new Error(`${file}：沒有 # 標題`);
  body = body.slice(h1[0].length).trim();
  body = body.replace(/^(作者|By)[：:\s][^\n]*\n/, '').trim();
  const firstPara = body.split(/\n\s*\n/)[0];
  for (const k of ['published', 'updated']) if (!/^\d{4}-\d{2}-\d{2}$/.test(meta[k] || '')) throw new Error(`${file}：${k} 格式要 YYYY-MM-DD`);
  return { title: h1[1].trim(), meta, lede: plain(firstPara), html: mdToHtml(body, lang, charts) };
}

// 回傳 [{ slug, en, zh }]，照 BLOG_ORDER 排；兩種語言都要有，缺了就停。
export async function loadPosts(root) {
  const dir = join(root, 'content', 'blog');
  const files = await readdir(dir);
  const charts = await loadCharts();
  const slugs = [...new Set(files.filter((f) => f.endsWith('.md')).map((f) => f.replace(/\.(en|zh)\.md$/, '')))];
  for (const s of slugs) if (!BLOG_ORDER.includes(s)) throw new Error(`blog：${s} 沒列在 BLOG_ORDER`);
  const posts = [];
  for (const slug of BLOG_ORDER) {
    const post = { slug };
    for (const lang of ['en', 'zh']) {
      const file = `${slug}.${lang}.md`;
      if (!files.includes(file)) throw new Error(`blog：缺 ${file}`);
      post[lang] = parse(await readFile(join(dir, file), 'utf8'), file, lang, charts);
    }
    posts.push(post);
  }
  return posts;
}
