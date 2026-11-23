/**
 * Blog 數據圖：資料在 content/blog/charts/<id>.json（每張都寫來源與日期），這裡畫成內嵌 SVG。
 * 文章裡寫一行 `![chart](chart:<id>)`。字型跟著頁面（Geist），不另外載。
 *
 * 來自 CRE8 API 的圖（組合權重、模型淨值回測）用快照，不在每次 build 重抓，免得文章日期和圖對不上：
 *   node scripts/blog-charts.mjs --snapshot   # 重新抓 API，覆寫 weights-*.json、nav-*.json
 * 其他圖（第三方市場數據、算術例子）是手寫 JSON，改數字要附新來源。
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, 'content', 'blog', 'charts');
const API = (process.env.CRE8_API || 'https://website-production-d8e9f7cc.up.railway.app').replace(/\/$/, '');

const INK = '#0B0F14', MUTED = '#6B7785', GRID = 'rgba(11,15,20,.08)', BLUE = '#2F5B7C', GOLD = '#D9A441', LIGHT = '#A9BCCB';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmt = (n, d = 0) => n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });

// 橫條圖：rows [{label:{en,zh}, value, highlight?}]，unit 'usdM' | 'pct' | 'usdt'
function bars(c, lang) {
  const rows = c.rows;
  const W = 720, rowH = 40, top = 8, labelW = 190, valW = 110;
  const H = top + rows.length * rowH + 8;
  const max = Math.max(...rows.map((r) => r.value));
  const val = (v) => (c.unit === 'usdM' ? (v >= 1000 ? `$${+(v / 1000).toFixed(2)}B` : `$${fmt(v, 1)}M`) : c.unit === 'pct' ? `${+v.toFixed(2)}%` : `${fmt(v, 0)} U`);
  const barW = W - labelW - valW;
  const body = rows.map((r, i) => {
    const y = top + i * rowH;
    const w = Math.max(2, (r.value / max) * barW);
    return `<text x="0" y="${y + 24}" font-size="14" fill="${INK}">${esc(r.label[lang] ?? r.label.en)}</text>`
      + `<rect x="${labelW}" y="${y + 10}" width="${w.toFixed(1)}" height="20" rx="4" fill="${r.highlight ? GOLD : BLUE}"/>`
      + `<text x="${labelW + w + 10}" y="${y + 25}" font-size="13" fill="${INK}" font-family="'Geist Mono',monospace">${val(r.value)}</text>`;
  }).join('');
  return { W, H, body };
}

// 折線圖：series [{label:{en,zh}, points:[[x,y],...], color?}]；x 是日期字串或數字
function lines(c, lang) {
  const W = 720, legendH = c.series.length > 1 ? 28 : 0, H = 300 + legendH, L = 56, R = c.dots ? 40 : 16, T = 16 + legendH, B = 36;
  const all = c.series.flatMap((s) => s.points);
  const xs = all.map((p) => (typeof p[0] === 'string' ? Date.parse(p[0]) : p[0]));
  const ys = all.map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  let y0 = Math.min(...ys, c.yMin ?? Infinity), y1 = Math.max(...ys);
  // 整齊的刻度：步長取 1、2、2.5、5 × 10^n
  const raw = (y1 - y0) / 4, mag = 10 ** Math.floor(Math.log10(raw || 1));
  const step = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((k) => k >= raw);
  y0 = Math.floor(y0 / step) * step; y1 = Math.ceil(y1 / step) * step;
  const X = (x) => L + ((x - x0) / (x1 - x0 || 1)) * (W - L - R);
  const Y = (y) => T + (1 - (y - y0) / (y1 - y0 || 1)) * (H - T - B);
  let grid = '';
  for (let v = y0; v <= y1 + step / 2; v += step) {
    grid += `<line x1="${L}" x2="${W - R}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" stroke="${GRID}"/>`
      + `<text x="${L - 8}" y="${(Y(v) + 4).toFixed(1)}" font-size="12" text-anchor="end" fill="${MUTED}" font-family="'Geist Mono',monospace">${c.yFormat === 'index' ? fmt(v, 0) : fmt(v, 0) + (c.ySuffix || '')}</text>`;
  }
  const xl = c.xLabels || [];
  const xlab = xl.map(([x, text], i) => {
    const xv = typeof x === 'string' ? Date.parse(x) : x;
    const anchor = i === 0 ? 'start' : i === xl.length - 1 ? 'end' : 'middle';
    return `<text x="${X(xv).toFixed(1)}" y="${H - 10}" font-size="12" text-anchor="${anchor}" fill="${MUTED}" font-family="'Geist Mono',monospace">${esc(typeof text === 'object' ? text[lang] : text)}</text>`;
  }).join('');
  const colors = [BLUE, GOLD, LIGHT];
  const paths = c.series.map((s, i) => {
    const d = s.points.map((p, j) => `${j ? 'L' : 'M'}${X(typeof p[0] === 'string' ? Date.parse(p[0]) : p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join('');
    const seen = new Set(c.series.slice(0, i).flatMap((o) => o.points.map((q) => q.join())));
    const dots = c.dots ? s.points.map((p) => (seen.has(p.join()) ? '' : `<circle cx="${X(typeof p[0] === 'string' ? Date.parse(p[0]) : p[0]).toFixed(1)}" cy="${Y(p[1]).toFixed(1)}" r="4" fill="${s.color || colors[i]}"/><text x="${(X(typeof p[0] === 'string' ? Date.parse(p[0]) : p[0]) + 8).toFixed(1)}" y="${(Y(p[1]) - 8).toFixed(1)}" font-size="12" fill="${INK}" font-family="'Geist Mono',monospace">${fmt(p[1], 0)}</text>`)).join('') : '';
    return `<path d="${d}" fill="none" stroke="${s.color || colors[i]}" stroke-width="2.25" stroke-linejoin="round"/>${dots}`;
  }).join('');
  const legend = c.series.length > 1 ? c.series.map((s, i) => `<g transform="translate(${L + i * 200},4)"><rect width="12" height="12" rx="2" fill="${s.color || colors[i]}"/><text x="18" y="11" font-size="13" fill="${INK}">${esc(s.label[lang])}</text></g>`).join('') : '';
  return { W, H, body: grid + xlab + paths + legend };
}

export async function loadCharts() {
  const { readdir } = await import('node:fs/promises');
  const files = (await readdir(DIR).catch(() => [])).filter((f) => f.endsWith('.json'));
  const charts = {};
  for (const f of files) charts[f.replace(/\.json$/, '')] = JSON.parse(await readFile(join(DIR, f), 'utf8'));
  return charts;
}

export function chartHtml(c, lang) {
  const { W, H, body } = c.type === 'line' ? lines(c, lang) : bars(c, lang);
  const title = c.title[lang];
  return `<figure class="post-fig post-chart"><figcaption class="post-chart__title">${esc(title)}</figcaption>`
    + `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}" xmlns="http://www.w3.org/2000/svg" font-family="Geist, 'PingFang SC', sans-serif">${body}</svg>`
    + `<figcaption class="post-chart__src">${esc(c.source[lang])}</figcaption></figure>`;
}

// ---------------------------------------------------------------- 快照（只在 --snapshot 時跑）
async function getJson(path) {
  for (let i = 0; ; i++) {
    const res = await fetch(API + path, { headers: { accept: 'application/json' } }).catch((e) => ({ ok: false, status: e.message }));
    if (res.ok) return res.json();
    if (i >= 4) throw new Error(`${path}: HTTP ${res.status}`);
    await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
  }
}

async function snapshot() {
  const names = { pelosi: { en: 'Pelosi Portfolio', zh: '佩洛西持仓' }, mag7: { en: 'Mag7', zh: '美股七巨头' }, 'ai-chips': { en: 'AI Chips', zh: 'AI 芯片' } };
  const tick = { NVDA: ['NVIDIA', '英伟达'], GOOGL: ['Alphabet', '谷歌'], MSFT: ['Microsoft', '微软'], AMZN: ['Amazon', '亚马逊'], INTC: ['Intel', '英特尔'], AVGO: ['Broadcom', '博通'], AAPL: ['Apple', '苹果'], META: ['Meta', 'Meta'], TSLA: ['Tesla', '特斯拉'], TSM: ['TSMC', '台积电'], SKHY: ['SK hynix', 'SK 海力士'], MRVL: ['Marvell', '迈威尔'], PENG: ['Penguin Solutions', 'Penguin Solutions'] };
  const list = await getJson('/api/strategies?limit=100');
  for (const key of Object.keys(names)) {
    const s = list.items.find((x) => x.isPublic && x.catalogKey === key);
    const d = await getJson(`/api/strategies/${s.id}`);
    const v = d.versions.find((x) => x.status === 'active') || d.versions[d.versions.length - 1];
    const num = (v.execution?.numeraire || '').toLowerCase();
    const alloc = v.allocation.assets.filter((a) => a.address.toLowerCase() !== num && a.weightBps > 0);
    const syms = (d.description.split('：')[1] || '').split('，')[0].split('、').map((x) => x.trim().toUpperCase().replace(/B$/, ''));
    const asOf = d.modelReturns.asOf;
    const rows = alloc.map((a, i) => { const t = syms[i]; const n = tick[t] || [t, t]; return { label: { en: `${t} · ${n[0]}`, zh: `${t} · ${n[1]}` }, value: a.weightBps / 100 }; });
    await writeFile(join(DIR, `weights-${key}.json`), JSON.stringify({ type: 'bar', unit: 'pct', title: { en: `${names[key].en}: target weights`, zh: `${names[key].zh}：目标权重` },
      source: { en: `Source: CRE8 portfolio data, as of ${asOf}.`, zh: `来源：CRE8 组合数据，截至 ${asOf}。` }, rows }, null, 1) + '\n');
    // 淨值：每週取一點，起點換算成 100
    const nav = d.modelNav.map((p) => [p.date, Number(p.value)]);
    const base = 1; // 模型淨值以 1 起算（和組合頁「至今」報酬一致）
    const pts = nav.filter((_, i) => i % 7 === 0 || i === nav.length - 1).map(([dt, val]) => [dt, Math.round((val / base) * 10000) / 100]);
    const first = nav[0][0], last = nav[nav.length - 1][0];
    await writeFile(join(DIR, `nav-${key}.json`), JSON.stringify({ type: 'line', yFormat: 'index', title: { en: `${names[key].en}: model backtest, ${first.slice(0, 7)} = 100`, zh: `${names[key].zh}：模型回测，${first.slice(0, 7)} = 100` },
      source: { en: `Source: CRE8 model backtest (current weights applied to historical prices, not a track record), ${first} to ${last}. Past performance does not predict future results.`, zh: `来源：CRE8 模型回测（用当前权重套历史价格，不是实盘战绩），${first} 至 ${last}。过去表现不代表未来。` },
      xLabels: [[first, first.slice(0, 7)], [pts[Math.floor(pts.length / 2)][0], pts[Math.floor(pts.length / 2)][0].slice(0, 7)], [last, last.slice(0, 7)]],
      series: [{ label: names[key], points: pts }] }, null, 1) + '\n');
    console.log('snapshot', key, asOf);
  }
}

if (process.argv.includes('--snapshot')) await snapshot();
