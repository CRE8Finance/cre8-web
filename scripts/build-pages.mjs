#!/usr/bin/env node
/**
 * 產生官網的靜態內容頁（給不跑 JS 的 AI 爬蟲與搜尋引擎看）。
 *
 *   node scripts/build-pages.mjs            # 從測試網 API 抓基金資料
 *   CRE8_API=https://... node scripts/build-pages.mjs
 *
 * 產出（全部是純 HTML，不靠 support.js）：
 *   portfolios/index.html、portfolios/<catalogKey>/index.html、how-it-works/index.html、compare/index.html
 *   zh/index.html、zh/portfolios/...、zh/how-it-works/index.html、zh/compare/index.html
 *   sitemap.xml、llms.txt
 * 並就地改寫 index.html 裡標了 <!-- gen:... --> 的區塊（Top portfolios、FAQ、FAQPage schema、How it works 面板的 APY）。
 *
 * 資料：/api/strategies（列表）＋ /api/strategies/:id（成分、權重、modelReturns、modelNav）。
 * 權重：allocation.assets 依順序對 description 裡列的代號（後端寫入時同序）；同一個地址在每檔基金都要對到同一個代號，
 * 對不上就停下來（不要產出錯的持股）。英文說明照 cre8-app src/lib/fund-copy.ts。
 * 只用 node 內建（fetch、fs），不加依賴。
 */
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const API = (process.env.CRE8_API || 'https://website-production-d8e9f7cc.up.railway.app').replace(/\/$/, '');
const SITE = 'https://cre8.finance';
const APP = 'https://tst.cre8.finance/';
const X = 'https://x.com/CRE8Finance';
const BUILT = new Date().toISOString().slice(0, 10);

// ---------------------------------------------------------------- 基金的固定文案（依 catalogKey）
// img：app/ 底下的封面。en.desc 照 cre8-app fund-copy.ts；zh 由我們寫。
const FUND_META = {
  pelosi: { img: 'p-pelosi', en: { name: 'Pelosi Portfolio', desc: 'Built from the stock trades Nancy Pelosi’s household discloses to Congress. NVIDIA, Alphabet, Microsoft, Amazon and Intel make up the core, with a small position in Broadcom.' }, zh: { name: '佩洛西持仓', desc: '根据南希·佩洛西家庭向美国国会申报的股票交易整理。核心是英伟达、Alphabet、微软、亚马逊和英特尔，另有一小部分博通。' } },
  trump: { img: 'p-trump', en: { name: 'Trump Holdings', desc: 'Built from Donald Trump’s financial disclosures: NVIDIA, Apple, Microsoft, Amazon, Meta, Tesla, Alphabet and Netflix in equal weights.' }, zh: { name: '特朗普持仓', desc: '根据特朗普的财务申报整理：英伟达、苹果、微软、亚马逊、Meta、特斯拉、Alphabet 和奈飞，等权重。' } },
  duan: { img: 'p-duan', en: { name: 'Duan Yongping', desc: 'Built from the US stocks Duan Yongping reports in his public filings: Apple, PDD Holdings, NVIDIA and Tesla in equal weights.' }, zh: { name: '段永平', desc: '根据段永平公开申报的美股持仓整理：苹果、拼多多、英伟达和特斯拉，等权重。' } },
  musk: { img: 'p-musk', en: { name: 'Musk Basket', desc: 'Elon Musk’s world. Tesla, SpaceX and bitcoin make up the core, with a small position in Dogecoin.' }, zh: { name: '马斯克宇宙', desc: '马斯克的世界：核心是特斯拉、SpaceX 和比特币，另有一小部分狗狗币。' } },
  mag7: { img: 'p-mag7', en: { name: 'Mag7', desc: 'Seven of the largest US technology companies in equal weights: Apple, Microsoft, Alphabet, Amazon, NVIDIA, Meta and Tesla.' }, zh: { name: '美股七巨头 Mag7', desc: '美国七家最大的科技公司，等权重：苹果、微软、Alphabet、亚马逊、英伟达、Meta 和特斯拉。' } },
  everyday: { img: 'p-everyday', en: { name: 'Everyday Brands', desc: 'Companies people use every day. Apple, Amazon, Netflix, Alphabet, Meta and Microsoft make up the core in equal weights, with a small position in Reddit.' }, zh: { name: '每天在用的公司', desc: '大家每天都在用的公司。苹果、亚马逊、奈飞、Alphabet、Meta 和微软等权重做核心，另有一小部分 Reddit。' } },
  'ai-chips': { img: 'p-ai', en: { name: 'AI Chips', desc: 'The chipmakers behind AI computing. NVIDIA, TSMC, Intel and SK hynix make up the core, with small positions in Broadcom, Marvell and Penguin Solutions.' }, zh: { name: 'AI 芯片', desc: 'AI 算力背后的芯片公司。核心是英伟达、台积电、英特尔和 SK 海力士，另有少量博通、Marvell 和 Penguin Solutions。' } },
  'ai-memory': { img: 'p-aimem', en: { name: 'AI Memory', desc: 'The memory and storage makers that AI data centers depend on: SK hynix, Micron and SanDisk in equal weights.' }, zh: { name: 'AI 存储', desc: 'AI 数据中心离不开的存储芯片厂商：SK 海力士、美光和闪迪，等权重。' } },
  'ai-models': { img: 'p-aimodel', en: { name: 'AI Model Makers', desc: 'Companies behind the leading AI models: Anthropic, Amazon, Alphabet, Microsoft, SpaceX and Meta in equal weights.' }, zh: { name: 'AI 模型公司', desc: '做出主流 AI 模型的公司：Anthropic、亚马逊、Alphabet、微软、SpaceX 和 Meta，等权重。' } },
  'new-giants': { img: 'p-giants', en: { name: 'New Giants', desc: 'Two of the largest new names on the market, SpaceX and Anthropic, in equal weights.' }, zh: { name: '新上市巨头', desc: '刚上市的两家大公司，SpaceX 和 Anthropic，等权重。' } },
  'korea-semiconductors': { img: 'p-korea', en: { name: 'Korea Semis', desc: 'Korea’s chip industry: SK hynix and a broad South Korea market fund (EWY) in equal weights.' }, zh: { name: '韩国半导体', desc: '韩国芯片产业：SK 海力士加上一只覆盖韩国大盘的 ETF（EWY），等权重。' } },
  china: { img: 'p-china', en: { name: 'China Tech', desc: 'Chinese e-commerce leaders Alibaba and PDD Holdings in equal weights.' }, zh: { name: '中概股', desc: '中国电商龙头阿里巴巴和拼多多，等权重。' } },
  'crypto-treasuries': { img: 'p-ctsy', en: { name: 'Crypto Treasuries', desc: 'Listed companies that hold crypto on their balance sheets. Strategy (MSTR), BitMine (BMNR) and BNC make up the core, with a small position in CYPH.' }, zh: { name: '币股财库', desc: '把加密资产放在资产负债表上的上市公司。核心是 Strategy（MSTR）、BitMine（BMNR）和 BNC，另有一小部分 CYPH。' } },
  'bitcoin-plus': { img: 'p-btcplus', en: { name: 'Bitcoin Plus', desc: 'Bitcoin alongside two listed companies tied to it, Strategy (MSTR) and Coinbase, in equal weights.' }, zh: { name: '比特币加强版', desc: '比特币，加上两家跟比特币绑在一起的上市公司 Strategy（MSTR）和 Coinbase，等权重。' } },
  bnb: { img: 'p-bnb', en: { name: 'BNB Ecosystem', desc: 'The BNB Chain ecosystem: BNB itself and BNC, a listed company that holds BNB, in equal weights.' }, zh: { name: 'BNB 生态', desc: 'BNB Chain 生态：BNB 本身，加上持有 BNB 的上市公司 BNC，等权重。' } },
  'crypto-infrastructure': { img: 'p-cinfra', en: { name: 'Crypto Infrastructure', desc: 'The companies that move money in crypto: Circle, Coinbase and Robinhood in equal weights.' }, zh: { name: '币圈基础设施', desc: '在加密世界里搬钱的公司：Circle、Coinbase 和 Robinhood，等权重。' } },
  meme: { img: 'p-meme', en: { name: 'Meme Stocks', desc: 'Retail favourites. GameStop and Dogecoin make up the core, with small positions in AMC and Trump Media (DJT).' }, zh: { name: '迷因股', desc: '散户的心头好。核心是 GameStop 和狗狗币，另有少量 AMC 和特朗普媒体（DJT）。' } },
  'gold-bitcoin': { img: 'p-goldbtc', en: { name: 'Gold + Bitcoin', desc: 'Two stores of value side by side: tokenized gold (XAUt) and bitcoin in equal weights.' }, zh: { name: '黄金加比特币', desc: '两种价值储存放在一起：黄金代币 XAUt 和比特币，等权重。' } },
  'us-market': { img: 'p-us', en: { name: 'US Market', desc: 'The broad US market through two index funds, the Nasdaq-100 (QQQ) and the S&P 500 (SPY), in equal weights.' }, zh: { name: '美股大盘', desc: '用两只指数 ETF 买整个美股大盘：纳斯达克 100（QQQ）和标普 500（SPY），等权重。' } },
  soxl: { img: 'p-soxl', en: { name: '3x Semiconductors', desc: 'Three times the daily move of US semiconductor stocks, through a single 3x leveraged token (SOXL).' }, zh: { name: '三倍半导体', desc: '通过一只三倍杠杆代币（SOXL），追踪美国半导体股每日涨跌的三倍。' } },
  tqqq: { img: 'p-tqqq', en: { name: '3x Nasdaq', desc: 'Three times the daily move of the Nasdaq-100, through a single 3x leveraged token (TQQQ).' }, zh: { name: '三倍纳指', desc: '通过一只三倍杠杆代币（TQQQ），追踪纳斯达克 100 每日涨跌的三倍。' } },
};

// 代號 → 顯示代號、英文名、中文名。新資產沒列在這裡會停下來，免得頁面出現看不懂的代號。
const ASSETS = {
  NVDAB: ['NVDA', 'NVIDIA', '英伟达'], GOOGLB: ['GOOGL', 'Alphabet (Google)', 'Alphabet（谷歌）'], MSFTB: ['MSFT', 'Microsoft', '微软'],
  AMZNB: ['AMZN', 'Amazon', '亚马逊'], INTCB: ['INTC', 'Intel', '英特尔'], AVGOB: ['AVGO', 'Broadcom', '博通'], AAPLB: ['AAPL', 'Apple', '苹果'],
  METAB: ['META', 'Meta', 'Meta'], TSLAB: ['TSLA', 'Tesla', '特斯拉'], NFLXB: ['NFLX', 'Netflix', '奈飞'], RDDTB: ['RDDT', 'Reddit', 'Reddit'],
  TSMB: ['TSM', 'TSMC', '台积电'], SKHYB: ['SKHY', 'SK hynix', 'SK 海力士'], MRVLB: ['MRVL', 'Marvell', 'Marvell'], PENGB: ['PENG', 'Penguin Solutions', 'Penguin Solutions'],
  MUB: ['MU', 'Micron', '美光'], SNDKB: ['SNDK', 'SanDisk', '闪迪'], ANTB: ['ANT', 'Anthropic', 'Anthropic'], SPCXB: ['SPCX', 'SpaceX', 'SpaceX'],
  EWYB: ['EWY', 'iShares MSCI South Korea ETF', '韩国大盘 ETF'], BABAB: ['BABA', 'Alibaba', '阿里巴巴'], PDDB: ['PDD', 'PDD Holdings', '拼多多'],
  MSTRB: ['MSTR', 'Strategy', 'Strategy（原 MicroStrategy）'], BMNRB: ['BMNR', 'BitMine', 'BitMine'], BNCB: ['BNC', 'BNC (listed BNB holder)', 'BNC（持有 BNB 的上市公司）'],
  CYPHB: ['CYPH', 'Cypherpunk', 'Cypherpunk'], BTCB: ['BTC', 'Bitcoin', '比特币'], COINB: ['COIN', 'Coinbase', 'Coinbase'], WBNB: ['BNB', 'BNB', 'BNB'],
  CRCLB: ['CRCL', 'Circle', 'Circle'], HOODB: ['HOOD', 'Robinhood', 'Robinhood'], GMEB: ['GME', 'GameStop', 'GameStop（游戏驿站）'], DOGE: ['DOGE', 'Dogecoin', '狗狗币'],
  AMCB: ['AMC', 'AMC Entertainment', 'AMC 院线'], DJTB: ['DJT', 'Trump Media', '特朗普媒体'], XAUT: ['XAUt', 'Tether Gold (tokenized gold)', '黄金代币'],
  QQQB: ['QQQ', 'Invesco QQQ (Nasdaq-100)', '纳指 100 ETF'], SPYB: ['SPY', 'SPDR S&P 500 ETF', '标普 500 ETF'],
  SOXLB: ['SOXL', 'Direxion Daily Semiconductor Bull 3x', '三倍做多半导体 ETF'], TQQQB: ['TQQQ', 'ProShares UltraPro QQQ (3x Nasdaq-100)', '三倍做多纳指 ETF'],
};
const CRYPTO = new Set(['BTC', 'BNB', 'DOGE']);

// ---------------------------------------------------------------- 抓資料
async function getJson(path) {
  // 測試網後端偶爾回 502：一次一個、失敗重試幾次。
  for (let i = 0; ; i++) {
    const res = await fetch(API + path, { headers: { accept: 'application/json' } }).catch((e) => ({ ok: false, status: e.message }));
    if (res.ok) return res.json();
    if (i >= 4) throw new Error(`${path}: HTTP ${res.status}`);
    await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
  }
}

async function loadFunds() {
  const list = await getJson('/api/strategies?limit=100');
  const items = (list.items || []).filter((s) => s.isPublic && s.catalogKey);
  const details = [];
  for (const s of items) details.push(await getJson(`/api/strategies/${s.id}`));
  const addrSym = new Map();
  const funds = details.map((d) => {
    const meta = FUND_META[d.catalogKey];
    if (!meta) throw new Error(`沒有文案的基金：${d.catalogKey}（加進 FUND_META）`);
    const v = d.versions.find((x) => x.status === 'active') || d.versions[d.versions.length - 1];
    const numeraire = (v.execution?.numeraire || '').toLowerCase();
    const alloc = v.allocation.assets.filter((a) => a.address.toLowerCase() !== numeraire && a.weightBps > 0);
    const listed = (d.description.split('：')[1] || '').split('，')[0].split('、').map((s) => s.trim().toUpperCase()).filter(Boolean);
    const comps = new Map((d.modelComponents || []).map((c) => [c.symbol.toUpperCase(), c.includedFrom]));
    if (listed.length !== alloc.length) throw new Error(`${d.catalogKey}：說明列了 ${listed.length} 個代號，權重有 ${alloc.length} 個`);
    const holdings = alloc.map((a, i) => {
      const sym = listed[i];
      const addr = a.address.toLowerCase();
      if (addrSym.has(addr) && addrSym.get(addr) !== sym) throw new Error(`${addr} 對到兩個代號：${addrSym.get(addr)}、${sym}`);
      addrSym.set(addr, sym);
      if (!comps.has(sym)) throw new Error(`${d.catalogKey}：${sym} 不在 modelComponents`);
      const info = ASSETS[sym];
      if (!info) throw new Error(`沒有名稱的資產：${sym}（加進 ASSETS）`);
      return { sym, ticker: info[0], en: info[1], zh: info[2], weight: a.weightBps / 100, includedFrom: comps.get(sym) };
    });
    const total = holdings.reduce((s, h) => s + h.weight, 0);
    if (Math.abs(total - 100) > 0.05) throw new Error(`${d.catalogKey}：權重合計 ${total}`);
    const mr = d.modelReturns || {};
    const nav = d.modelNav || [];
    return {
      key: d.catalogKey, id: d.id, category: d.category, meta, holdings,
      apy: num(mr.annualized), asOf: mr.asOf, start: nav[0]?.date,
      rets: { d7: num(mr.d7), d30: num(mr.d30), d90: num(mr.d90), y1: num(mr.y1), all: num(mr.all) },
      min: Number(BigInt(d.minDepositUsdtWei || v.minDepositUsdtWei || '0') / 10n ** 18n),
      rebalance: v.execution?.rebalance,
    };
  });
  const order = { person: 0, theme: 1, leveraged: 2 };
  funds.sort((a, b) => order[a.category] - order[b.category] || (b.apy ?? -1e9) - (a.apy ?? -1e9));
  return funds;
}
const num = (s) => (s === null || s === undefined || s === '' ? null : Number(s));

// ---------------------------------------------------------------- 小工具
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const strip = (html) => html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
const pct = (n, d = 1) => (n === null ? '—' : (n >= 0 ? '+' : '−') + Math.abs(n).toFixed(d) + '%');
const cls = (n) => (n === null ? '' : n >= 0 ? 'pos' : 'neg');
const wt = (w) => (Math.round(w * 100) / 100).toString() + '%';
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const date = (iso, lang) => {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  return lang === 'zh' ? `${y}年${m}月${d}日` : `${MON[m - 1]} ${d}, ${y}`;
};
const list = (arr, lang) => {
  if (lang === 'zh') return arr.join('、');
  return arr.length < 3 ? arr.join(' and ') : arr.slice(0, -1).join(', ') + ' and ' + arr[arr.length - 1];
};
const enPath = (p) => p; // '/portfolios/pelosi'
const zhPath = (p) => (p === '/' ? '/zh' : '/zh' + p);
const abs = (p) => SITE + (p === '/' ? '/' : p);
const ld = (obj) => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;

// ---------------------------------------------------------------- 共用介面字串
const T = {
  en: {
    lang: 'en', htmlLang: 'en', locale: 'en_US', home: 'Home', portfolios: 'Portfolios', how: 'How it works', compare: 'Compare', faq: 'Questions',
    openApp: 'Open app', other: '中文', otherLabel: '简体中文', openTestnet: 'Open the testnet', apyLabel: 'Model APY', min: 'USDT minimum',
    kinds: { person: 'People', theme: 'Theme', leveraged: 'Leveraged' },
    groups: { person: 'People portfolios', theme: 'Theme portfolios', leveraged: 'Leveraged portfolios' },
  },
  zh: {
    lang: 'zh', htmlLang: 'zh-Hans', locale: 'zh_CN', home: '首页', portfolios: '组合', how: '怎么运作', compare: '对比', faq: '常见问题',
    openApp: '打开应用', other: 'EN', otherLabel: 'English', openTestnet: '打开测试网', apyLabel: '模型年化', min: 'USDT 起投',
    kinds: { person: '人物', theme: '主题', leveraged: '杠杆' },
    groups: { person: '人物组合', theme: '主题组合', leveraged: '杠杆组合' },
  },
};
const P = (lang, p) => (lang === 'zh' ? zhPath(p) : enPath(p));

function head({ lang, path, title, description, schema, extraHead = '' }) {
  const t = T[lang];
  const self = P(lang, path);
  return `<!DOCTYPE html>
<html lang="${t.htmlLang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${abs(self)}">
<link rel="alternate" hreflang="en" href="${abs(enPath(path))}">
<link rel="alternate" hreflang="zh-Hans" href="${abs(zhPath(path))}">
<link rel="alternate" hreflang="x-default" href="${abs(enPath(path))}">
<meta name="theme-color" content="#F3F5F7">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
<meta property="og:type" content="website">
<meta property="og:site_name" content="CRE8">
<meta property="og:locale" content="${t.locale}">
<meta property="og:url" content="${abs(self)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${SITE}/assets/og.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="@CRE8Finance">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${SITE}/assets/og.jpg">
${schema.map(ld).join('\n')}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600&family=Instrument+Serif&family=Geist+Mono:wght@400;500&display=swap" rel="stylesheet" media="print" onload="this.media='all'">
<link rel="stylesheet" href="/assets/pages.css">
${extraHead}</head>
<body>
${siteHead(lang, path)}`;
}

function siteHead(lang, path) {
  const t = T[lang];
  const cur = (p) => (path === p || (p !== '/' && path.startsWith(p + '/')) ? ' aria-current="page"' : '');
  const other = lang === 'zh' ? enPath(path) : zhPath(path);
  return `<header class="site-head"><div class="site-head__bar">
<a class="site-head__logo" href="${P(lang, '/')}"><img src="/assets/cre8-logo-dark.svg" alt="CRE8" width="107" height="20"></a>
<nav aria-label="${lang === 'zh' ? '主导航' : 'Main'}"><a href="${P(lang, '/portfolios')}"${cur('/portfolios')}>${t.portfolios}</a><a href="${P(lang, '/how-it-works')}"${cur('/how-it-works')}>${t.how}</a><a href="${P(lang, '/compare')}"${cur('/compare')}>${t.compare}</a></nav>
<div class="site-head__right"><a class="site-head__lang" href="${other}" hreflang="${lang === 'zh' ? 'en' : 'zh-Hans'}" lang="${lang === 'zh' ? 'en' : 'zh-Hans'}">${t.other}</a><a class="btn btn--gold btn--sm" href="${APP}">${t.openApp} <span aria-hidden="true">→</span></a></div>
</div></header>`;
}

function siteFoot(lang, funds) {
  const t = T[lang];
  const featured = ['pelosi', 'trump', 'ai-chips', 'mag7'].map((k) => funds.find((f) => f.key === k)).filter(Boolean);
  return `<footer class="site-foot wrap">
<div class="site-foot__brand"><img src="/assets/cre8-logo-light.svg" alt="CRE8" width="129" height="24"><span>© 2026 CRE8</span></div>
<nav aria-label="${lang === 'zh' ? '页脚' : 'Footer'}"><a href="${P(lang, '/portfolios')}">${lang === 'zh' ? '全部组合' : 'All portfolios'}</a>${featured.map((f) => `<a href="${P(lang, '/portfolios/' + f.key)}">${esc(f.meta[lang].name)}</a>`).join('')}<a href="${P(lang, '/how-it-works')}">${t.how}</a><a href="${P(lang, '/compare')}">${t.compare}</a><a href="${lang === 'zh' ? '/' : '/zh'}" lang="${lang === 'zh' ? 'en' : 'zh-Hans'}">${t.otherLabel}</a><a href="${APP}">${lang === 'zh' ? '测试网应用' : 'Testnet app'}</a><a href="${X}" rel="noopener">X</a></nav>
</footer>
</body>
</html>
`;
}

const crumbs = (lang, items) => {
  // items: [[label, path|null], ...]，最後一項是目前頁面
  const html = `<ol class="crumbs">${items.map(([l, p], i) => `<li>${i < items.length - 1 ? `<a href="${P(lang, p)}">${esc(l)}</a>` : `<span aria-current="page">${esc(l)}</span>`}</li>`).join('')}</ol>`;
  const schema = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items.map(([l, p], i) => ({ '@type': 'ListItem', position: i + 1, name: l, item: abs(P(lang, p)) })) };
  return { html, schema };
};

const ORG = { '@type': 'Organization', name: 'CRE8', url: SITE + '/', logo: SITE + '/assets/cre8-mark-512.png', sameAs: [X] };

function fundRow(f, lang, opts = {}) {
  const m = f.meta[lang];
  const sub = opts.sub ? `<small>${esc(opts.sub)}</small>` : '';
  return `<a class="fund-row" href="${P(lang, '/portfolios/' + f.key)}"><span class="fund-row__l"><span class="fund-row__img"><img src="/app/${f.meta.img}.jpg" alt="" width="128" height="128" loading="lazy" decoding="async"></span><span class="fund-row__nm">${esc(m.name)}${sub}</span></span><span class="fund-row__r"><span class="${cls(f.apy)}">${pct(f.apy)}</span><i aria-hidden="true">↗︎</i></span></a>`;
}

const ctaBand = (lang) =>
  lang === 'zh'
    ? `<section class="cta"><h2>从 50 USDT 开始。</h2><p>现在是测试网，测试 USDT 免费，登录需要邀请码。</p><div class="actions"><a class="btn btn--light" href="${APP}">打开测试网 <span aria-hidden="true">↗︎</span></a></div></section>`
    : `<section class="cta"><h2>Start with 50 USDT.</h2><p>CRE8 is on testnet. Test USDT is free, and signing in needs an invite code.</p><div class="actions"><a class="btn btn--light" href="${APP}">Open the testnet <span aria-hidden="true">↗︎</span></a></div></section>`;

// ---------------------------------------------------------------- 基金頁
function sourceText(f, lang) {
  const names = (pred) => f.holdings.filter(pred).map((h) => (lang === 'zh' ? h.zh : h.en.replace(/ \(.*\)$/, '')));
  const core = names((h) => h.weight > 5);
  const sat = names((h) => h.weight <= 5);
  const coreW = f.holdings.find((h) => h.weight > 5)?.weight;
  const equal = f.holdings.every((h) => Math.abs(h.weight - f.holdings[0].weight) < 0.02);
  const about = (w) => (Math.round(w * 10) / 10).toString() + '%';
  const weightLine = lang === 'zh'
    ? (equal ? `${list(core, lang)}各占约 ${about(coreW)}。` : `核心的${list(core, lang)}各占约 ${about(coreW)}${sat.length ? `，${list(sat, lang)}${sat.length > 1 ? '各' : ''}占 5%` : ''}。`)
    : (equal ? `${list(core, lang)} get about ${about(coreW)} each.` : `${list(core, lang)} make up the core at about ${about(coreW)} each${sat.length ? `, with 5%${sat.length > 1 ? ' each' : ''} in ${list(sat, lang)}` : ''}.`);
  const S = {
    en: {
      pelosi: [`Nancy Pelosi’s household reports its stock trades to the US House of Representatives in Periodic Transaction Reports, usually 30 to 45 days after the trade. This portfolio is built from those filings.`, `Many of the trades are call options. The portfolio holds the underlying shares instead. The filings give dollar ranges, not exact amounts, so CRE8 sets the weights: ${weightLine}`],
      trump: [`Built from the financial disclosures Donald Trump files with the US Office of Government Ethics. The filings list holdings in value ranges, without share counts, and arrive weeks to months after the trades.`, `Because the amounts are ranges, the portfolio holds the large US stocks that appear in the filings in equal weights. Companies he owns or runs, such as Trump Media, are left out. ${weightLine}`],
      duan: [`Built from the quarterly 13F filings of H&H International Investment, the firm that reports Duan Yongping’s US stock holdings to the SEC. 13F filings come out up to 45 days after each quarter ends.`, `The portfolio holds the names from those filings that can be bought on-chain, in equal weights. Berkshire Hathaway, a large holding in the filing, is left out because there’s no on-chain market deep enough to buy it. ${weightLine}`],
      musk: [`This one isn’t a disclosure portfolio. Elon Musk doesn’t publish a personal stock list, so the basket holds the listed companies he runs, Tesla and SpaceX, plus bitcoin, which both companies hold on their balance sheets, and a small position in Dogecoin.`, weightLine],
      theme: [`CRE8 picks the companies that fit the theme and can be bought on-chain with enough liquidity. Names with deep markets form the core; names with thinner markets get about 5% each.`, weightLine],
      leveraged: [`A single token, ${f.holdings[0].ticker}, that tracks ${f.holdings[0].en}, an ETF that aims for three times the daily move of its index. Leveraged portfolios are kept separate from the theme portfolios.`],
    },
    zh: {
      pelosi: [`佩洛西家庭会以“定期交易报告”（Periodic Transaction Report）向美国众议院申报股票交易，通常在交易后 30 到 45 天公开。这个组合就是根据这些申报整理的。`, `她的交易很多是看涨期权，组合改为持有对应的股票。申报只给金额区间、没有确切数字，所以权重由 CRE8 设定：${weightLine}`],
      trump: [`根据特朗普向美国政府道德办公室（OGE）提交的财务申报整理。申报只列持仓的金额区间、没有股数，而且会比实际交易晚几周到几个月。`, `因为金额是区间，组合对申报中出现的美国大型股采用等权重，不放他自己拥有或经营的公司（例如特朗普媒体）。${weightLine}`],
      duan: [`根据 H&H International Investment 的季度 13F 申报整理，这是向美国证监会（SEC）申报段永平美股持仓的机构。13F 在每季结束后最晚 45 天公开。`, `组合持有申报里能在链上买到的股票，等权重。申报里占比很大的伯克希尔·哈撒韦没有放进来，因为链上没有足够深的市场可以买。${weightLine}`],
      musk: [`这个组合不是申报跟踪型。马斯克没有公开个人持股清单，所以组合放的是他经营的两家上市公司特斯拉和 SpaceX，加上两家公司账上都有的比特币，再配一小部分狗狗币。`, weightLine],
      theme: [`CRE8 挑选符合主题、而且能在链上以足够流动性买到的公司。市场深的放在核心，市场较浅的每个约占 5%。`, weightLine],
      leveraged: [`只持有一个代币 ${f.holdings[0].ticker}，追踪的是${f.holdings[0].zh}，一只目标为指数每日涨跌三倍的 ETF。杠杆组合单独一类，不混进主题组合。`],
    },
  };
  const k = f.category === 'person' ? f.key : f.category;
  return S[lang][k] || S[lang].theme;
}

function methodText(f, lang) {
  const late = f.holdings.filter((h) => h.includedFrom && f.start && h.includedFrom > f.start);
  const missing = f.holdings.filter((h) => !h.includedFrom);
  const rule = f.rebalance === 'monthly_drift' && f.holdings.length > 1
    ? (lang === 'zh' ? '组合每月再平衡一次；任何资产偏离目标权重超过 5 个百分点时也会调整。' : 'The portfolio rebalances once a month, and whenever an asset drifts more than 5 points from its target weight.')
    : '';
  if (lang === 'zh') {
    const extra = [
      ...late.map((h) => `${h.zh}（${h.ticker}）从 ${date(h.includedFrom, 'zh')} 起才计入。`),
      ...missing.map((h) => `${h.zh}（${h.ticker}）的价格历史还不到 30 天，暂未计入。`),
    ].join('');
    return [
      `年化收益是模型数字，不是实际战绩。做法是：拿组合现在的目标权重，套用每个资产的历史每日收盘价（股票和 ETF 用复权价，加密资产用币安行情，XAUt 用金价），算出 ${date(f.start, 'zh')} 到 ${date(f.asOf, 'zh')} 的复利年化收益。`,
      `价格历史不到 30 天的资产先不计入，满 30 天后才从那天起加入，期间它的权重按比例分给其他成分。${extra}`,
      `${rule}过去的模型收益不代表未来，测试网上的余额也是按模拟价格变动。`,
    ];
  }
  const extra = [
    ...late.map((h) => `${h.en.replace(/ \(.*\)$/, '')} (${h.ticker}) joins the model on ${date(h.includedFrom, 'en')}.`),
    ...missing.map((h) => `${h.en.replace(/ \(.*\)$/, '')} (${h.ticker}) has less than 30 days of price history and isn’t in the model yet.`),
  ].join(' ');
  return [
    `The APY is a model figure, not a track record. CRE8 takes the portfolio’s current target weights and runs them through the daily closing prices of each asset (stocks and ETFs adjusted for dividends and splits, crypto from Binance market data, XAUt from the gold price). The result is compounded and annualized over ${date(f.start, 'en')} to ${date(f.asOf, 'en')}.`,
    `An asset with less than 30 days of price history is left out until it has 30 days, and its weight is shared among the others until then.${extra ? ' ' + extra : ''}`,
    `${rule ? rule + ' ' : ''}Past model returns don’t predict future results, and testnet balances move on simulated prices.`,
  ];
}

function riskText(f, lang) {
  const crypto = f.holdings.some((h) => CRYPTO.has(h.ticker));
  const zh = lang === 'zh';
  const items = [];
  if (f.category === 'leveraged') {
    items.push(zh
      ? `<strong>高风险。</strong>这个组合持有三倍杠杆 ETF 代币。杠杆每天重设，几周、几个月下来的结果可能跟“指数涨跌的三倍”差很远，震荡行情里亏损会越滚越大。模型里它过去 90 天的收益是 ${pct(f.rets.d90)}。只适合能承受亏掉大部分本金的人。`
      : `<strong>High risk.</strong> This portfolio holds a 3x leveraged ETF token. The leverage resets every day, so over weeks and months the result can be far from three times the index, and losses compound in choppy markets. In the model it returned ${pct(f.rets.d90)} over the last 90 days. Only put in money you can afford to lose most of.`);
    items.push(zh ? '杠杆组合只能一次买入，没有分批买入，也不提供加息。' : 'Leveraged portfolios are bought in one go, with no gradual buying and no extra yield.');
  }
  items.push(zh
    ? `价格会涨也会跌，你可能亏钱。这个组合只有 ${f.holdings.length} 个资产，集中度高${crypto ? '；其中有加密资产，波动通常比股票大得多' : ''}。`
    : `Prices go down as well as up, and you can lose money. This portfolio holds only ${f.holdings.length} asset${f.holdings.length > 1 ? 's' : ''}, so it’s concentrated${crypto ? ', and the crypto in it can swing far more than stocks' : ''}.`);
  if (f.category === 'person' && f.key !== 'musk') items.push(zh ? '申报有延迟，组合反映的是已经公开的持仓，不是对方今天手上的东西。' : 'Filings are delayed, so the portfolio reflects what has been disclosed, not what is held today.');
  items.push(zh
    ? '股票以 bStock 代币持有：它由发行方（币安关联公司）持有的股票支持，发行方每天公布储备证明，也有冻结代币的权限。这跟在券商名下持股不一样。'
    : 'Stocks are held as bStock tokens, backed by shares held by the issuer, a Binance affiliate, which publishes a daily proof of reserves and can freeze tokens. That isn’t the same as owning the shares at a broker.');
  items.push(zh ? '股票代币只在美股交易时段成交。部分资产的链上市场较浅，大额买卖会影响价格。' : 'Stock tokens only trade while the US market is open. Some on-chain markets are thin, so large orders move the price.');
  return items;
}

function fundPage(f, funds, lang) {
  const t = T[lang];
  const m = f.meta[lang];
  const zh = lang === 'zh';
  const path = '/portfolios/' + f.key;
  const c = crumbs(lang, [[t.home, '/'], [t.portfolios, '/portfolios'], [m.name, path]]);
  const enName = f.meta.en.name;
  const title = zh ? `${m.name}（${enName}）：持仓、权重与模型收益 | CRE8` : `${m.name}: holdings, weights and model APY | CRE8`;
  const description = zh
    ? `${m.desc} 用 USDT 一次买齐，最低 ${f.min} USDT，资产放在你自己的链上账户。模型年化 ${pct(f.apy)}（截至 ${date(f.asOf, 'zh')}，回测）。`
    : `${m.desc} Buy it with USDT from ${f.min} USDT and hold it in your own on-chain account. Model APY ${pct(f.apy)} (backtest, as of ${date(f.asOf, 'en')}).`;
  const product = {
    '@context': 'https://schema.org', '@type': 'FinancialProduct', name: m.name, alternateName: zh ? enName : f.meta.zh.name,
    description: m.desc, url: abs(P(lang, path)), image: `${SITE}/app/${f.meta.img}.jpg`,
    category: zh ? `${t.kinds[f.category]}组合` : `${t.kinds[f.category]} portfolio`, provider: ORG,
  };
  const related = funds.filter((x) => x.category === f.category && x.key !== f.key).slice(0, 4);
  const crown = f.category === 'leveraged' ? `<div class="note note--risk"><p>${riskText(f, lang)[0]}</p></div>` : '';
  const steps = zh
    ? [['打开测试网', `到 <a class="link" href="${APP}">tst.cre8.finance</a> 用邮箱登录。测试网期间登录需要邀请码。`], ['领测试 USDT', '在应用里免费领取测试 USDT。'], [`买入${m.name}`, `打开这个组合，输入金额（最低 ${f.min} USDT）并确认。一笔付款按目标权重买齐所有资产。`], ['持有或卖出', '在你的账户里查看持仓，美股开盘时可以随时卖回 USDT。']]
    : [['Open the testnet', `Go to <a class="link" href="${APP}">tst.cre8.finance</a> and sign in with email. During testnet you need an invite code.`], ['Get test USDT', 'Claim free test USDT in the app.'], [`Buy ${m.name}`, `Open the portfolio, enter an amount (${f.min} USDT minimum) and confirm. One payment buys every asset at its target weight.`], ['Hold or sell', 'Track it in your account and sell back to USDT whenever the US market is open.']];
  const retLabels = zh ? [['7 天', 'd7'], ['30 天', 'd30'], ['90 天', 'd90'], ['1 年', 'y1'], [`自 ${date(f.start, 'zh')}`, 'all']] : [['7 days', 'd7'], ['30 days', 'd30'], ['90 days', 'd90'], ['1 year', 'y1'], [`Since ${date(f.start, 'en')}`, 'all']];
  const risks = riskText(f, lang).slice(f.category === 'leveraged' ? 1 : 0);

  return head({ lang, path, title, description, schema: [product, c.schema] }) + `
<main class="wrap">
${c.html}
<section class="hero">
<div>
<div class="eyebrow">${esc(t.kinds[f.category])}${zh ? ` · ${esc(enName)}` : ''}</div>
<h1 style="margin-top:16px">${esc(m.name)}</h1>
<p class="lede">${esc(m.desc)}</p>
<div class="stats">
<div><b class="${cls(f.apy)}">${pct(f.apy)}</b><span>${t.apyLabel}${zh ? `，截至 ${date(f.asOf, 'zh')}` : `, as of ${date(f.asOf, 'en')}`}</span></div>
<div><b>${f.holdings.length}</b><span>${zh ? '个资产' : f.holdings.length > 1 ? 'assets' : 'asset'}</span></div>
<div><b>${f.min}</b><span>${t.min}</span></div>
</div>
<div class="actions"><a class="btn btn--gold" href="${APP}">${zh ? '在测试网买入' : 'Buy on testnet'} <span aria-hidden="true">↗︎</span></a><a class="btn btn--line" href="${P(lang, '/how-it-works')}">${t.how}</a></div>
${crown}
</div>
<div class="hero__art"><img src="/app/${f.meta.img}.jpg" alt="${esc(m.name)}" width="1200" height="900" fetchpriority="high"></div>
</section>

<section class="section" id="holdings">
<div class="section__head"><h2>${zh ? '持仓与权重' : 'Holdings and weights'}</h2><span class="tabs-note">${zh ? '目标权重' : 'Target weights'}</span></div>
<div class="hold">
${f.holdings.map((h) => `<div class="hold__row"><span class="hold__tk">${esc(h.ticker)}</span><span class="hold__nm">${esc(zh ? h.zh : h.en)}</span><span class="hold__bar" aria-hidden="true"><i style="width:${Math.min(100, h.weight)}%"></i></span><span class="hold__w">${wt(h.weight)}</span></div>`).join('\n')}
</div>
</section>

<section class="section prose" id="source">
<h2>${f.category === 'person' ? (zh ? '持仓从哪里来' : 'Where the list comes from') : (zh ? '怎么选的' : 'How it’s put together')}</h2>
${sourceText(f, lang).map((p) => `<p>${esc(p)}</p>`).join('\n')}
</section>

<section class="section" id="returns">
<div class="prose"><h2>${zh ? '收益怎么算' : 'How the return is calculated'}</h2>
${methodText(f, lang).map((p) => `<p>${esc(p)}</p>`).join('\n')}</div>
<div class="rets">${retLabels.map(([l, k]) => `<div><span>${esc(l)}</span><b class="${cls(f.rets[k])}">${pct(f.rets[k])}</b></div>`).join('')}</div>
<p class="small muted" style="margin-top:12px">${zh ? `模型收益，截至 ${date(f.asOf, 'zh')}。` : `Model returns as of ${date(f.asOf, 'en')}.`}</p>
</section>

<section class="section prose" id="risks">
<h2>${zh ? '风险' : 'Risks'}</h2>
<ul>${risks.map((r) => `<li>${r.startsWith('<strong>') ? r : esc(r)}</li>`).join('')}</ul>
</section>

<section class="section" id="buy">
<div class="section__head"><h2>${zh ? '怎么买' : 'How to buy'}</h2></div>
<ol class="steps">${steps.map(([b, p], i) => `<li><span>0${i + 1} / 0${steps.length}</span><b>${esc(b)}</b><p>${p}</p></li>`).join('')}</ol>
</section>

${related.length ? `<section class="section"><div class="section__head"><h2>${zh ? `其他${t.groups[f.category]}` : `More ${t.groups[f.category].toLowerCase()}`}</h2><a class="link" href="${P(lang, '/portfolios')}">${zh ? '全部组合' : 'All portfolios'} →</a></div><div class="fund-list">${related.map((x) => fundRow(x, lang)).join('')}</div></section>` : ''}

${ctaBand(lang)}
</main>
` + siteFoot(lang, funds);
}

// ---------------------------------------------------------------- 組合總表
function indexPage(funds, lang) {
  const t = T[lang];
  const zh = lang === 'zh';
  const path = '/portfolios';
  const c = crumbs(lang, [[t.home, '/'], [t.portfolios, path]]);
  const asOf = funds[0]?.asOf;
  const title = zh ? `全部 ${funds.length} 个组合：人物、主题与杠杆 | CRE8` : `All ${funds.length} portfolios: people, themes and leveraged | CRE8`;
  const description = zh
    ? `CRE8 的 ${funds.length} 个美股与加密组合：佩洛西、特朗普、马斯克、段永平，以及 AI 芯片、Mag7、BNB 生态等主题。用 USDT 一次买齐，最低 50 USDT。`
    : `All ${funds.length} CRE8 portfolios of US stock tokens and crypto: Pelosi, Trump, Musk and Duan Yongping, plus themes like AI Chips, Mag7 and BNB Ecosystem. Buy with USDT from 50 USDT.`;
  const itemList = { '@context': 'https://schema.org', '@type': 'ItemList', name: title, itemListElement: funds.map((f, i) => ({ '@type': 'ListItem', position: i + 1, url: abs(P(lang, '/portfolios/' + f.key)), name: f.meta[lang].name })) };
  const groups = ['person', 'theme', 'leveraged'].map((g) => [g, funds.filter((f) => f.category === g)]).filter(([, l]) => l.length);
  return head({ lang, path, title, description, schema: [itemList, c.schema] }) + `
<main class="wrap">
${c.html}
<h1>${zh ? '全部组合' : 'All portfolios'}</h1>
<p class="lede">${zh ? `${funds.length} 个组合，每个都是一篮子美股代币或加密资产，用 USDT 一次买齐。右边是模型年化收益（回测，截至 ${date(asOf, 'zh')}）。` : `${funds.length} portfolios, each a basket of US stock tokens or crypto you buy with USDT in one payment. The figure on the right is the model APY (backtest, as of ${date(asOf, 'en')}).`}</p>
<div class="section">
${groups.map(([g, l]) => `<div class="group" id="${{ person: 'people', theme: 'themes', leveraged: 'leveraged' }[g]}"><h2>${t.groups[g]}</h2><div class="fund-list">${l.map((f) => fundRow(f, lang, { sub: f.holdings.map((h) => h.ticker).join(' · ') })).join('')}</div></div>`).join('\n')}
</div>
<p class="small muted" style="margin-top:24px">${zh ? '模型年化收益用当前权重和历史价格回测，不是实际战绩，也不代表未来。' : 'Model APY is a backtest of the current weights on historical prices. It isn’t a track record and doesn’t predict future returns.'} <a class="link" href="${P(lang, '/how-it-works')}">${t.how}</a></p>
${ctaBand(lang)}
</main>
` + siteFoot(lang, funds);
}

// ---------------------------------------------------------------- FAQ（首頁兩種語言共用；schema 從同一份文字產生）
function faqs(lang) {
  const cmp = P(lang, '/compare');
  if (lang === 'zh') return [
    ['这是真钱吗？', '还不是。CRE8 现在在 BNB Chain 测试网上，测试 USDT 免费。主网还没有定日期。'],
    ['安全吗？', '目前 CRE8 上的一切都不涉及真钱。你的组合放在你自己在 BNB Chain 上的智能账户里；CRE8 的自动化只能在账户内交易，把钱转出账户需要你本人签名。合约会在上主网前做外部审计。'],
    ['谁保管我的股票？', '你自己。它们以代币形式放在只有你能控制的链上账户里，不跟别人的钱混在一起。'],
    ['怎么出金？', '把组合的一部分或全部卖回 USDT，再把 USDT 提到任何 BNB Chain 地址。股票代币在美股开盘时才能卖出。'],
    ['闲置的 USDT 怎么生息？', '按 Earn，把闲置 USDT 存进白名单 USDT 金库（Lista、Venus、Aave），收益按市场利率，随时可以领出。买组合时也可以打开“加息”，用组合里的股票多赚一点；价格急跌时系统会自动卖掉一点来保持安全。你的现金和组合的钱永远分开。'],
    ['跟自己在币安买 bStock 差在哪？', `在币安你一次买一只股票，放在交易所账户里。CRE8 一笔付款买齐一整篮，按目标权重自动再平衡，资产放在你自己的链上账户。币安的股票更多、流动性更深，详细见<a href="${cmp}">完整对比</a>。`],
    ['美股休市时怎么办？', '股票代币只在美股交易时段成交。休市时下的买单或卖单会在账户里等着，下一次开盘时成交。'],
    ['最低要投多少？', '每次 50 USDT。'],
    ['费用多少？', '测试网上免费，gas 也由 CRE8 支付。主网费用会在上线前公布。'],
    ['谁可以用？', '美国以外、当地规定允许的任何人。测试网期间登录需要邀请码。'],
  ];
  return [
    ['Is this real money?', 'Not yet. CRE8 is on BNB Chain testnet, and test USDT is free. There’s no mainnet date yet.'],
    ['Is CRE8 safe?', 'Nothing on CRE8 involves real money yet. Your portfolio sits in your own smart account on BNB Chain. CRE8’s automation can only trade inside it, and moving money out takes your signature. The contracts get an external audit before mainnet.'],
    ['Who holds my shares?', 'You do. They sit as tokens in an on-chain account only you control, never pooled with anyone else’s.'],
    ['How do I cash out?', 'Sell some or all of a portfolio back to USDT, then withdraw the USDT to any BNB Chain address. Stock tokens sell while the US market is open.'],
    ['How does idle USDT earn?', 'Press Earn to put idle USDT in an allowlisted USDT vault (Lista, Venus or Aave) at the market rate, and withdraw it whenever you like. When you buy a portfolio you can also turn on extra yield, which uses its shares to earn a bit more and automatically sells a little if prices fall fast. Your cash and your portfolios are always kept separate.'],
    ['How is this different from buying bStock on Binance?', `On Binance you buy one stock at a time and it sits in your exchange account. CRE8 buys a whole basket in one payment, rebalances it to its target weights, and keeps it in an account you own on-chain. Binance has more stocks and deeper liquidity. See the <a href="${cmp}">full comparison</a>.`],
    ['What happens when the US market is closed?', 'Stock tokens only trade during US market hours. A buy or sell placed while the market is closed waits in your account and goes through at the next open.'],
    ['What’s the minimum?', '50 USDT per purchase.'],
    ['What does it cost?', 'Nothing on testnet, and CRE8 pays the gas. Mainnet fees will be announced before launch.'],
    ['Who can use it?', 'Anyone outside the US, where local rules allow. During testnet you need an invite code to sign in.'],
  ];
}
const faqSchema = (lang) => ({ '@context': 'https://schema.org', '@type': 'FAQPage', inLanguage: T[lang].htmlLang, mainEntity: faqs(lang).map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: strip(a) } })) });

// ---------------------------------------------------------------- 怎麼運作
function howPage(funds, lang) {
  const t = T[lang];
  const zh = lang === 'zh';
  const path = '/how-it-works';
  const c = crumbs(lang, [[t.home, '/'], [t.how, path]]);
  const title = zh ? '怎么运作：买入、保管、费用、出金 | CRE8' : 'How CRE8 works: buying, custody, fees and withdrawals';
  const description = zh
    ? '用 USDT 买一篮子美股代币和加密资产：谁保管、费用多少、怎么卖出和出金、美股休市时怎么成交、闲置 USDT 怎么生息。CRE8 目前在测试网。'
    : 'How buying a CRE8 portfolio with USDT works: who holds the assets, what it costs, how to sell and withdraw, what happens when the US market is closed, and how idle USDT earns. CRE8 is on testnet.';
  const page = { '@context': 'https://schema.org', '@type': 'WebPage', name: title, description, url: abs(P(lang, path)), inLanguage: t.htmlLang, isPartOf: { '@type': 'WebSite', name: 'CRE8', url: SITE + '/' } };
  const body = zh ? `
<h1>怎么运作</h1>
<p class="lede">CRE8 让你用 USDT 买一篮子美股代币和加密资产，一笔付款买齐，资产放在你自己的链上账户里。还没投出去的现金，也可以先生息。</p>
<div class="section prose">
<h2>买入</h2>
<ol>
<li>用邮箱（或 Google）登录。CRE8 会在 BNB Chain 上为你开一个智能账户，所有者就是你登录用的钱包。</li>
<li>往账户里加 USDT。测试网上可以在应用里免费领测试 USDT。</li>
<li>选一个组合，输入金额，最低 50 USDT。确认之后，一笔付款按目标权重买齐组合里的每个资产。</li>
</ol>
<p>交易走白名单里的链上交易场所（PancakeSwap、KyberSwap、OpenOcean），每个资产有单笔上限，大单会拆成几笔。</p>
<p>每个组合买入后会自动维持比例：每月再平衡一次，任何资产偏离目标权重超过 5 个百分点时也会调整。你也可以自己挑股票和比例建一个组合，CRE8 一样帮你再平衡。</p>

<h2 style="margin-top:56px">谁保管</h2>
<p>你自己。每个用户在 BNB Chain 上有自己的智能账户，资产以代币形式放在里面，不跟别人的钱混在一起，在链上浏览器就能查到。CRE8 的自动化只能在你的账户里执行交易，把资产转出账户需要你本人签名。</p>
<p>美股以 bStock 持有。bStock 是币安在 BNB Chain 上发行的美股代币，由发行方（币安关联公司）持有的股票支持，发行方每天公布储备证明，也有冻结代币的权限。持有 bStock 跟在券商名下持股不同：没有投票权，股息和拆股体现在代币余额上，而不是发现金。</p>

<h2 style="margin-top:56px">费用</h2>
<ul>
<li><strong>测试网：</strong>不收费，gas 由 CRE8 支付。</li>
<li><strong>主网：</strong>费用会在上线前公布。交易场所本身的池子手续费和滑点另计。</li>
</ul>

<h2 style="margin-top:56px">卖出与出金</h2>
<p>你可以把组合的一部分或全部卖回 USDT，钱会回到你的账户。之后可以把 USDT 提到任何 BNB Chain 地址，包括交易所的充值地址。大额卖出会按每个资产的单笔上限分几笔完成。</p>

<h2 style="margin-top:56px">美股休市时</h2>
<p>股票代币只在美股交易时段成交，CRE8 不在休市时硬买硬卖。休市时下的单会在账户里等着，下一次开盘时成交；在那之前，你的 USDT 留在自己的账户里。</p>

<h2 style="margin-top:56px">闲置 USDT 怎么生息</h2>
<p>账户里的现金可以先放着，也可以按 <strong>Earn</strong>，存进 CRE8 白名单里的 USDT 金库（Lista、Venus、Aave）。你会看到每个金库的年化收益，按市场利率浮动，CRE8 不承诺利率。想领多少、什么时候领都可以，利息一起领回。你没按的话，CRE8 不会动你的现金。</p>
<h3>组合加息</h3>
<p>买组合时，可以顺便打开“加息”，默认是关的，要你自己打开。打开后，CRE8 会用这个组合里的股票再多赚一点：把股票存进借贷市场，以保守的比例借出一小笔 USDT，再存进 USDT 金库。价格急跌时，系统会自动卖掉一点来保持安全，事后在活动记录里告诉你卖了多少。随时可以关掉，股票会留在组合里。</p>
<p>CRE8 只借市场允许额度的一小部分，风险很低，但不能说完全没有。杠杆组合不提供加息。</p>
<p>你的现金和每个组合的钱永远是分开的：组合加息用到的 USDT 只属于那个组合，不会算成你的现金，也不会跟别的组合混在一起。</p>
<p>测试网上的金库和利率都是模拟的，数字只供参考。</p>

<h2 style="margin-top:56px">现在是测试网</h2>
<ul>
<li>CRE8 跑在 BNB Chain 测试网上，用的是测试版的代币和价格，不是真钱。</li>
<li>测试 USDT 免费，登录需要邀请码。</li>
<li>主网还没有定日期，上主网前合约会做外部审计。</li>
<li>美国以外、当地规定允许的人都可以用。</li>
</ul>
</div>` : `
<h1>How it works</h1>
<p class="lede">CRE8 lets you buy a basket of US stock tokens and crypto with USDT, in one payment, and keep it in an on-chain account that belongs to you. Cash you haven’t invested can earn in the meantime.</p>
<div class="section prose">
<h2>Buying</h2>
<ol>
<li>Sign in with email (or Google). CRE8 opens a smart account for you on BNB Chain, owned by the wallet you signed in with.</li>
<li>Add USDT. On testnet you can claim free test USDT in the app.</li>
<li>Pick a portfolio and enter an amount, 50 USDT minimum. One payment buys every asset in the basket at its target weight.</li>
</ol>
<p>Trades go through an allowlist of on-chain venues (PancakeSwap, KyberSwap and OpenOcean). Each asset has a per-trade cap, so large orders are split into several trades.</p>
<p>After that the portfolio keeps its shape: it rebalances once a month, and whenever an asset drifts more than 5 points from its target weight. You can also build your own basket of stocks and weights, and CRE8 rebalances that too.</p>

<h2 style="margin-top:56px">Who holds the assets</h2>
<p>You do. Every user has their own smart account on BNB Chain, and the tokens sit there, never pooled with anyone else’s, where any block explorer can show them. CRE8’s automation can only run trades inside your account. Moving anything out of it takes your signature.</p>
<p>US stocks are held as bStock, Binance’s tokenized US stocks on BNB Chain. Each bStock is backed by shares held by the issuer, a Binance affiliate, which publishes a daily proof of reserves and can freeze tokens. Holding bStock isn’t the same as owning shares at a broker: there are no voting rights, and dividends and splits show up in the token balance rather than as cash.</p>

<h2 style="margin-top:56px">Fees</h2>
<ul>
<li><strong>Testnet:</strong> no fees, and CRE8 pays the gas.</li>
<li><strong>Mainnet:</strong> fees will be announced before launch. Venue pool fees and slippage apply on top.</li>
</ul>

<h2 style="margin-top:56px">Selling and withdrawing</h2>
<p>Sell some or all of a portfolio back to USDT and the money lands in your account. From there you can withdraw USDT to any BNB Chain address, including an exchange deposit address. Large sales go through in a few trades because of the per-asset cap.</p>

<h2 style="margin-top:56px">When the US market is closed</h2>
<p>Stock tokens only trade during US market hours, and CRE8 doesn’t force trades outside them. An order placed while the market is closed waits in your account and goes through at the next open. Until then your USDT stays in your own account.</p>

<h2 style="margin-top:56px">Earning on idle USDT</h2>
<p>Cash in your account can just sit there, or you can press <strong>Earn</strong> to put it in one of CRE8’s allowlisted USDT vaults (Lista, Venus, Aave). Each vault shows its APY, which follows market rates; CRE8 doesn’t promise a rate. Withdraw any amount, interest included, whenever you like. CRE8 never moves your cash unless you ask it to.</p>
<h3>Extra yield on a portfolio</h3>
<p>When you buy a portfolio you can also turn on extra yield. It stays off unless you switch it on. CRE8 then uses the portfolio’s shares to earn a bit more: it deposits them in a lending market, takes out a small, conservative amount of USDT against them and puts that in a USDT vault. If prices fall fast, the system automatically sells a little to stay safe, and your activity log tells you afterwards what was sold. You can switch it off at any time and the shares stay in the portfolio.</p>
<p>CRE8 takes out only a small part of what the market would allow, which keeps the risk low but can’t remove it entirely. Leveraged portfolios don’t offer extra yield.</p>
<p>Your cash and each portfolio’s money are always kept apart. USDT a portfolio uses to earn extra belongs to that portfolio only: it never counts as your cash and never mixes with another portfolio.</p>
<p>On testnet the vaults and rates are simulated, so treat the numbers as illustrations.</p>

<h2 style="margin-top:56px">It’s a testnet</h2>
<ul>
<li>CRE8 runs on BNB Chain testnet with test versions of the tokens and simulated prices. No real money is involved.</li>
<li>Test USDT is free. Signing in needs an invite code.</li>
<li>There’s no mainnet date yet. The contracts get an external audit before mainnet.</li>
<li>Anyone outside the US can use it, where local rules allow.</li>
</ul>
</div>`;
  return head({ lang, path, title, description, schema: [page, c.schema] }) + `
<main class="wrap">
${c.html}${body}
<section class="section"><div class="section__head"><h2>${zh ? '从一个组合开始' : 'Start with a portfolio'}</h2><a class="link" href="${P(lang, '/portfolios')}">${zh ? '全部组合' : 'All portfolios'} →</a></div><div class="fund-list">${['pelosi', 'ai-chips', 'mag7', 'us-market'].map((k) => funds.find((f) => f.key === k)).filter(Boolean).map((f) => fundRow(f, lang)).join('')}</div></section>
${ctaBand(lang)}
</main>
` + siteFoot(lang, funds);
}

// ---------------------------------------------------------------- 對比
function comparePage(funds, lang) {
  const t = T[lang];
  const zh = lang === 'zh';
  const path = '/compare';
  const c = crumbs(lang, [[t.home, '/'], [t.compare, path]]);
  const title = zh ? 'CRE8 对比币安 bStock、xStocks／Ondo、Venzo 和美股券商 | CRE8' : 'CRE8 vs Binance bStock, xStocks/Ondo, Venzo and a US broker';
  const description = zh
    ? '想用 USDT 买美股，有哪几条路？比较在币安买 bStock、xStocks 与 Ondo 等代币化股票、Venzo、开美股券商账户，以及 CRE8，各自的取舍。'
    : 'Ways to buy US stocks with USDT, compared: buying bStock on Binance, tokenized stocks like xStocks and Ondo, Venzo, a US brokerage account, and CRE8. What each is good at and what it costs you.';
  const page = { '@context': 'https://schema.org', '@type': 'WebPage', name: title, description, url: abs(P(lang, path)), inLanguage: t.htmlLang, dateModified: BUILT, isPartOf: { '@type': 'WebSite', name: 'CRE8', url: SITE + '/' } };
  const cols = zh ? ['CRE8', '币安 bStock', 'xStocks／Ondo', 'Venzo', '美股券商'] : ['CRE8', 'Binance bStock', 'xStocks / Ondo', 'Venzo', 'US broker'];
  const rows = zh ? [
    ['买到的是什么', 'bStock 美股代币与加密资产', 'bStock 美股代币', '其他发行方的美股代币', 'bStock 或 Ondo 美股代币', '你名下的真实股票'],
    ['一次买一篮', '可以，21 个组合，也能自建', '不行，一次一只', '要自己逐只买；Ondo 有少量组合产品', '可以，Mag7、佩洛西等', '要自己逐只买'],
    ['自动再平衡', '有，每月加偏离 5 个百分点', '没有', '没有', '在路线图上', '一般没有'],
    ['资产放在哪', '你自己的链上智能账户', '币安交易所账户（可提到链上）', '你自己的钱包', '每人一个链上智能账户', '券商账户'],
    ['用什么付款', 'USDT', 'USDT 等', '稳定币', 'USDT', '法币，要先把 USDT 换成钱'],
    ['可选股票', '首发组合里的资产', '约 105 只 bStock', '各自的清单', '组合里的成分', '几乎全部美股'],
    ['闲置资金生息', '有：现金可存进 USDT 金库，组合可选加息（测试网为模拟利率）', '另有理财产品', '没有', '账户内没有', '视券商'],
    ['现在的状态', '测试网，不是真钱', '已上线', '已上线', '主网已上线', '已上线'],
  ] : [
    ['What you get', 'bStock tokens and crypto', 'bStock tokens', 'Tokens from other issuers', 'bStock or Ondo tokens', 'Real shares in your name'],
    ['Buy a basket at once', 'Yes, 21 portfolios or your own', 'No, one stock at a time', 'One at a time; Ondo has a few portfolio products', 'Yes, e.g. Mag7, Pelosi', 'One at a time'],
    ['Automatic rebalancing', 'Yes, monthly plus 5-point drift', 'No', 'No', 'On its roadmap', 'Usually not'],
    ['Where assets sit', 'Your own on-chain smart account', 'Your Binance account (can withdraw on-chain)', 'Your own wallet', 'A smart account per user', 'Your brokerage account'],
    ['Pay with', 'USDT', 'USDT and others', 'Stablecoins', 'USDT', 'Fiat; USDT must be cashed out first'],
    ['Stock choice', 'Assets in the launch portfolios', 'About 105 bStocks', 'Each issuer’s list', 'The portfolios’ holdings', 'Nearly every US stock'],
    ['Yield on idle cash', 'Yes: Earn on cash in USDT vaults, optional extra yield on portfolios (simulated rates on testnet)', 'Separate Earn products', 'No', 'Not inside the account', 'Depends on the broker'],
    ['Status today', 'Testnet, no real money', 'Live', 'Live', 'Live on mainnet', 'Live'],
  ];
  const cards = zh ? [
    ['在币安自己买 bStock', ['币安对美国以外的用户开放美股，bStock 是这些股票在 BNB Chain 上的代币版本，现在约 105 只。站内股票和 bStock 可以 1:1 免费互转。', '优点：流动性最深、选择最多，有定投，bStock 还能当保证金抵押。', '取舍：要有币安账户并通过认证，不是每个地区都能用（美国不行）；一次买一只，没有组合，也不会帮你维持比例；资产默认在交易所账户里。'], '如果你只想买一两只热门股，或单笔金额很大，直接在币安买更划算。想一次买一整个主题、自动维持比例、放在自己的链上账户，CRE8 比较省事。'],
    ['xStocks、Ondo 等代币化股票', ['除了 bStock，美股代币还有其他发行方，Ondo 和 xStocks 是规模最大的两家。代币直接放在你自己的钱包里。', '优点：自托管，可以在不同链和协议里使用。Ondo 在 BNB Chain 上也有少量组合产品。', '取舍：同一只股票常有好几个版本，要自己挑；在 BNB Chain 上，Ondo 和 xStocks 代币的链上池子很浅；链上也有冒充正牌代号的假币，要自己核对合约。'], 'CRE8 目前只用 bStock 和主流加密资产，每个资产都要确认买得到才会上架。'],
    ['Venzo', ['City Protocol 旗下的应用。在 BNB Chain 上有用 bStock 组成的 Mag7 组合，以及用 Ondo 代币组成的佩洛西组合（11 只、最低 30 USDT）。每个用户一个链上智能账户，每笔买卖收 0.1%。', '优点：已经在主网、用真钱运作，背后有知名机构投资。', '取舍：组合数量少；账户里的闲置资金没有生息；自动再平衡和主题组合还在路线图上。主要业务是其他链上的收益金库。'], '两者架构相近。CRE8 的组合更多（人物、主题、杠杆共 21 个），而且已经会自动再平衡；但 CRE8 还在测试网，Venzo 已经上线。'],
    ['开美股券商账户', ['在券商开户、入金，直接持有你名下的股票。', '优点：几乎所有美股都能买，股息发现金，有投票权，持有的是股票本身。', '取舍：要开户和认证，只有部分国家和地区的人能开；入金要走银行，USDT 得先换成法币；买卖只在交易时段。'], '如果你的钱本来就在银行、所在地区开户方便，券商是最直接的路。如果你的钱是 USDT、又不想出入金，链上代币省掉这一步。'],
  ] : [
    ['Buying bStock on Binance', ['Binance offers US stocks to users outside the US, and bStock is the on-chain version of those stocks on BNB Chain, about 105 of them today. Stocks and bStock convert 1:1 on Binance at no fee.', 'Good at: the deepest liquidity and the widest choice, recurring buys, and bStock can be used as margin collateral.', 'Trade-offs: you need a verified Binance account, and it isn’t available everywhere (not in the US). You buy one stock at a time, there are no baskets, nothing keeps your weights on target, and the assets sit in your exchange account by default.'], 'If you want one or two popular stocks, or you’re moving a large amount, buying directly on Binance is cheaper. If you want a whole theme in one payment, kept on target and held in your own on-chain account, CRE8 is less work.'],
    ['xStocks, Ondo and other tokenized stocks', ['Besides bStock, other issuers tokenize US stocks. Ondo and xStocks are the two biggest. The tokens sit in your own wallet.', 'Good at: self-custody, and the tokens work across chains and DeFi apps. Ondo also has a few portfolio products on BNB Chain.', 'Trade-offs: the same stock often comes in several versions and you pick one yourself. On BNB Chain, on-chain pools for Ondo and xStocks tokens are thin. Fake tokens copying real tickers exist too, so you have to check contracts.'], 'CRE8 uses bStock and major crypto only, and an asset goes into a portfolio only after it’s confirmed buyable.'],
    ['Venzo', ['An app from City Protocol. On BNB Chain it offers a Mag7 portfolio built from bStock and a Pelosi portfolio built from Ondo tokens (11 stocks, 30 USDT minimum). Each user gets an on-chain smart account, and there’s a 0.1% fee on each buy and sell.', 'Good at: it’s live on mainnet with real money, backed by well-known investors.', 'Trade-offs: a small number of portfolios, no yield on idle cash inside the account, and automatic rebalancing and theme portfolios are still on its roadmap. Its main business is yield vaults on other chains.'], 'The setups are similar. CRE8 has more portfolios (21 across people, themes and leverage) and already rebalances automatically. But CRE8 is still on testnet, and Venzo is live.'],
    ['Opening a US brokerage account', ['Open an account with a broker, fund it and hold shares in your own name.', 'Good at: almost every US stock, cash dividends, voting rights, and you own the shares themselves.', 'Trade-offs: account opening and verification, and only people in some countries can open one. Funding goes through a bank, so USDT has to be cashed out first, and trading follows market hours.'], 'If your money is already in a bank and opening an account is easy where you live, a broker is the most direct route. If your money is in USDT and you’d rather not cash out, on-chain stock tokens skip that step.'],
  ];
  const cre8 = zh
    ? ['CRE8 的取舍', '老实说：CRE8 还在测试网，不是真钱；可选的资产比币安少；链上市场比交易所浅，大额买卖会有滑点；股票部分只在美股开盘时成交；bStock 是代币，不是你名下的股票。']
    : ['CRE8’s own trade-offs', 'To be straight about it: CRE8 is still on testnet, with no real money. It offers fewer assets than Binance. On-chain markets are shallower than an exchange, so large orders pay more slippage. Stock legs only trade while the US market is open. And bStock is a token, not a share in your name.'];
  return head({ lang, path, title, description, schema: [page, c.schema] }) + `
<main class="wrap">
${c.html}
<h1>${zh ? '用 USDT 买美股，有哪几条路' : 'Ways to buy US stocks with USDT'}</h1>
<p class="lede">${zh ? '每条路都有它擅长的地方。下面照实写，资料截至 2026 年 11 月。' : 'Each route is good at something. Here’s an honest look, as of November 2026.'}</p>
<section class="section">
<div class="table-wrap"><table class="cmp">
<thead><tr><th scope="col"></th>${cols.map((x, i) => `<th scope="col"${i === 0 ? ' class="us"' : ''}>${esc(x)}</th>`).join('')}</tr></thead>
<tbody>${rows.map(([h, ...cells]) => `<tr><th scope="row">${esc(h)}</th>${cells.map((x, i) => `<td${i === 0 ? ' class="us"' : ''}>${esc(x)}</td>`).join('')}</tr>`).join('\n')}</tbody>
</table></div>
</section>
${cards.map(([h, ps, take]) => `<section class="section prose"><h2>${esc(h)}</h2>${ps.map((p) => `<p>${esc(p)}</p>`).join('')}<p><strong>${zh ? '跟 CRE8 比：' : 'Compared with CRE8: '}</strong>${esc(take)}</p></section>`).join('\n')}
<section class="section prose"><h2>${esc(cre8[0])}</h2><p>${esc(cre8[1])}</p><p><a class="link" href="${P(lang, '/how-it-works')}">${t.how}</a> · <a class="link" href="${P(lang, '/portfolios')}">${zh ? '全部组合' : 'All portfolios'}</a></p></section>
${ctaBand(lang)}
</main>
` + siteFoot(lang, funds);
}

// ---------------------------------------------------------------- 簡體首頁
const topLists = (funds) => {
  const top = (pred) => funds.filter((f) => pred(f) && f.apy !== null && f.apy > 0).sort((a, b) => b.apy - a.apy).slice(0, 4);
  return { people: top((f) => f.category === 'person'), themes: top((f) => f.category !== 'person') };
};

function zhHome(funds) {
  const lang = 'zh';
  const { people, themes } = topLists(funds);
  const title = 'CRE8 | 用 USDT 买美股与加密投资组合';
  const description = '用 USDT 一次买齐一篮子美股代币（bStock）和加密资产。跟踪佩洛西、特朗普、马斯克，或自建组合，资产放在你自己的链上账户。现在是测试网。';
  const site = { '@context': 'https://schema.org', '@type': 'WebSite', name: 'CRE8', url: SITE + '/zh', inLanguage: 'zh-Hans', description };
  const card = (h, sub, href) => `<a class="card card--dark" href="${href}"><h3>${h}</h3><p>${sub}</p></a>`;
  return head({ lang, path: '/', title, description, schema: [{ '@context': 'https://schema.org', ...ORG }, site, faqSchema('zh')] }) + `
<section class="home-hero wrap">
<h1>美股与加密，<br>一篮子买齐</h1>
<p class="lede">bStock 与加密资产组合，闲置资金也能生息。</p>
<div class="actions"><a class="btn btn--gold" href="${APP}">打开测试网 <span aria-hidden="true">↗︎</span></a><a class="btn btn--line" href="/zh/portfolios">全部组合</a></div>
</section>
<section class="dark-band wrap">
<h2 style="text-align:center;max-width:22em;margin:0 auto">美股代币。你自己的账户。一次买齐。</h2>
<div class="cards">
${card('人物组合', '佩洛西、特朗普、马斯克、段永平', '/zh/portfolios#people')}
${card('主题组合', 'AI 芯片、Mag7、比特币', '/zh/portfolios#themes')}
${card('收益', '闲置 USDT 一键生息，随时领出', '/zh/how-it-works')}
${card('自托管', '资产在你自己的链上账户', '/zh/how-it-works')}
</div>
</section>
<main class="wrap" style="padding-top:0">
<section class="section" id="how">
<h2>怎么运作</h2>
<ol class="steps" style="margin-top:32px">
<li><span>01 / 03</span><b>选一个想法</b><p>跟着佩洛西、特朗普或马斯克公开的东西走，押一个主题，或者自己建一篮。</p></li>
<li><span>02 / 03</span><b>50 USDT 起</b><p>一笔付款帮你买齐篮子里的每个资产。</p></li>
<li><span>03 / 03</span><b>持有</b><p>股票以 bStock 代币放在你自己的账户里，随时可以卖回 USDT。</p></li>
</ol>
<div class="stats"><div><b>${funds.filter((f) => f.category === 'person').length}</b><span>个人物组合</span></div><div><b>${funds.filter((f) => f.category !== 'person').length}</b><span>个主题与杠杆组合</span></div><div><b>50</b><span>USDT 起投</span></div><div><b>100%</b><span>属于你，不混在一起</span></div></div>
<p style="margin-top:28px"><a class="link" href="/zh/how-it-works">费用、出金、休市怎么办 →</a></p>
</section>
<section class="section" id="funds">
<div class="section__head"><h2>热门组合</h2><a class="link" href="/zh/portfolios">全部 ${funds.length} 个组合 →</a></div>
<div class="group"><h3 style="margin-bottom:12px">人物</h3><div class="fund-list">${people.map((f) => fundRow(f, lang)).join('')}</div></div>
<div class="group"><h3 style="margin-bottom:12px">主题</h3><div class="fund-list">${themes.map((f) => fundRow(f, lang)).join('')}</div></div>
<p class="small muted" style="margin-top:16px">模型年化收益：用当前权重和历史价格回测，截至 ${date(funds[0]?.asOf, 'zh')}，不是实际战绩。</p>
</section>
<section class="section" id="build">
<div class="cta" style="margin-top:0"><div class="eyebrow" style="color:#9AA7B4">自建组合</div><h2 style="margin-top:16px">你来选，我们来再平衡。</h2><p>挑股票和比例，CRE8 帮你维持在目标上。</p><div class="actions"><a class="btn btn--light" href="${APP}">建一个组合 <span aria-hidden="true">↗︎</span></a></div></div>
</section>
<section class="section faq" id="faq">
<h2>常见问题</h2>
<div class="faq__list">
${faqs('zh').map(([q, a]) => `<details><summary>${esc(q)}<span aria-hidden="true">+</span></summary><p>${a}</p></details>`).join('\n')}
</div>
</section>
${ctaBand(lang)}
</main>
` + siteFoot(lang, funds);
}

// ---------------------------------------------------------------- 英文首頁：就地改寫標記區塊
function replaceBlock(html, name, content) {
  const re = new RegExp(`(<!-- gen:${name} -->)[\\s\\S]*?(<!-- /gen:${name} -->)`);
  if (!re.test(html)) throw new Error(`index.html 找不到 <!-- gen:${name} --> 區塊`);
  return html.replace(re, `$1\n${content}\n$2`);
}

function homeRow(f) {
  return `<a href="/portfolios/${f.key}" style="display:flex;justify-content:space-between;align-items:center;gap:24px;padding:28px 0;border-top:1px solid rgba(11,15,20,.08)" style-hover="opacity:1;background:#F6F8FA"><span style="display:flex;align-items:center;gap:clamp(12px,2vw,20px);min-width:0"><span style="flex:none;width:clamp(52px,6vw,72px);height:clamp(52px,6vw,72px);border-radius:16px;overflow:hidden;background:#F1F3F5;box-shadow:inset 0 0 0 1px rgba(11,15,20,.06)"><span role="img" aria-label="${esc(f.meta.en.name)}" style="display:block;width:100%;height:100%;background:#F1F3F5 url(app/${f.meta.img}.jpg) 50% 22%/cover no-repeat"></span></span><span style="min-width:0;overflow-wrap:anywhere;font:500 clamp(24px,2.2vw,32px)/1.15 'Geist';letter-spacing:-.03em">${esc(f.meta.en.name)}</span></span><span style="flex:none;display:flex;align-items:center;gap:clamp(12px,2vw,28px)"><span style="font:400 clamp(24px,2.2vw,32px) 'Geist';letter-spacing:-.03em;white-space:nowrap;color:${f.apy >= 0 ? '#1E8A5C' : '#D23F2E'}">${pct(f.apy)}</span><span style="font:300 24px 'Geist'">↗︎</span></span></a>`;
}

function updateHome(html, funds) {
  const { people, themes } = topLists(funds);
  html = replaceBlock(html, 'top-people', people.map(homeRow).join('\n'));
  html = replaceBlock(html, 'top-themes', themes.map(homeRow).join('\n'));
  html = replaceBlock(html, 'faq', faqs('en').map(([q, a], i, all) => `<details style="border-top:1px solid rgba(11,15,20,.08)${i === all.length - 1 ? ';border-bottom:1px solid #D5DBE0' : ''}"><summary style="display:flex;justify-content:space-between;gap:20px;padding:28px 0;font:500 clamp(20px,1.7vw,24px)/1.2 'Geist';letter-spacing:-.02em">${esc(q)}<span class="pm" style="font:300 28px 'Geist';transition:transform .2s">+</span></summary><p style="font:400 16px/1.6 'Geist';color:#3A4652;margin:0;padding:0 0 28px;max-width:46ch">${a.replace(/<a /g, '<a style="color:#2F5B7C;text-decoration:underline" ')}</p></details>`).join('\n'));
  // How it works 面板上的 APY（data-apy="catalogKey"）
  html = html.replace(/(data-apy="([a-z0-9-]+)"[^>]*>)[^<]*(<)/g, (m0, open, key, close) => {
    const f = funds.find((x) => x.key === key);
    if (!f) throw new Error(`index.html data-apy 找不到基金 ${key}`);
    return `${open}${pct(f.apy)} APY${close}`;
  });
  const desc = 'Buy baskets of US stocks and crypto with USDT. Follow Pelosi, Trump and Musk, or build your own. Yield on idle capital, in your own wallet. Now on testnet.';
  const schema = [
    { '@context': 'https://schema.org', ...ORG },
    { '@context': 'https://schema.org', '@type': 'WebSite', name: 'CRE8', url: SITE + '/', description: desc },
    faqSchema('en'),
  ];
  html = html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, ld(schema));
  return html;
}

// ---------------------------------------------------------------- sitemap、llms.txt
function sitemap(paths) {
  const urls = paths.map((p) => {
    const en = abs(enPath(p)), zh = abs(zhPath(p));
    const alt = `<xhtml:link rel="alternate" hreflang="en" href="${en}"/><xhtml:link rel="alternate" hreflang="zh-Hans" href="${zh}"/><xhtml:link rel="alternate" hreflang="x-default" href="${en}"/>`;
    return `  <url><loc>${en}</loc><lastmod>${BUILT}</lastmod>${alt}</url>\n  <url><loc>${zh}</loc><lastmod>${BUILT}</lastmod>${alt}</url>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join('\n')}
</urlset>
`;
}

function llms(funds) {
  const g = (cat) => funds.filter((f) => f.category === cat).map((f) => `- [${f.meta.en.name}](${abs('/portfolios/' + f.key)}): ${f.holdings.map((h) => `${h.ticker} ${wt(h.weight)}`).join(', ')}. Model APY ${pct(f.apy)} (backtest as of ${f.asOf}).`).join('\n');
  return `# CRE8

> CRE8 lets you buy baskets of tokenized US stocks (bStock) and crypto with USDT, in one payment, and hold them in an on-chain smart account on BNB Chain that only you control. Portfolios rebalance automatically. CRE8 is on BNB Chain testnet: test USDT is free and signing in needs an invite code. 简体中文: ${SITE}/zh

## Key pages
- [How it works](${SITE}/how-it-works): buying, custody, fees, selling and withdrawing, US market hours, idle-cash yield, testnet status.
- [Compare](${SITE}/compare): CRE8 vs buying bStock on Binance, xStocks/Ondo tokens, Venzo, and a US brokerage account.
- [All portfolios](${SITE}/portfolios): ${funds.length} portfolios with holdings, weights and model APY.
- 中文：[首页](${SITE}/zh)、[怎么运作](${SITE}/zh/how-it-works)、[对比](${SITE}/zh/compare)、[全部组合](${SITE}/zh/portfolios)

## Key facts
- Pay with USDT. Minimum 50 USDT per purchase.
- Custody: each user has their own smart account on BNB Chain. CRE8's automation can only trade inside it; withdrawals need the owner's signature.
- Stocks are held as bStock, Binance's tokenized US stocks on BNB Chain. Stock tokens trade only during US market hours; orders placed while the market is closed wait for the next open.
- Rebalancing: monthly, plus whenever an asset drifts more than 5 points from its target weight.
- Fees: none on testnet (CRE8 pays gas). Mainnet fees will be announced before launch.
- Earn: idle USDT can go into allowlisted USDT vaults (Lista, Venus, Aave) at market rates and be withdrawn any time. When buying a portfolio, users can opt in to extra yield that uses the portfolio's shares; if prices fall fast the system sells a little automatically. Cash and each portfolio's money are always kept separate. Testnet rates are simulated.
- Model APY is a backtest of current weights on historical prices, not a track record.
- Status: testnet only, no real money. No mainnet date yet.
- Availability: anyone outside the US, where local rules allow.

## People portfolios
${g('person')}

## Theme portfolios
${g('theme')}

## Leveraged portfolios (high risk; daily-reset 3x ETFs)
${g('leveraged')}

## Links
- Website: ${SITE}/
- App (testnet): ${APP}
- X: ${X}
`;
}

// ---------------------------------------------------------------- main
async function out(rel, content) {
  const file = join(ROOT, rel);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, content);
}

const funds = await loadFunds();
await rm(join(ROOT, 'portfolios'), { recursive: true, force: true });
await rm(join(ROOT, 'zh'), { recursive: true, force: true });
const paths = ['/', '/portfolios', '/how-it-works', '/compare', ...funds.map((f) => '/portfolios/' + f.key)];
for (const lang of ['en', 'zh']) {
  const base = lang === 'zh' ? 'zh/' : '';
  await out(base + 'portfolios/index.html', indexPage(funds, lang));
  for (const f of funds) await out(`${base}portfolios/${f.key}/index.html`, fundPage(f, funds, lang));
  await out(base + 'how-it-works/index.html', howPage(funds, lang));
  await out(base + 'compare/index.html', comparePage(funds, lang));
}
await out('zh/index.html', zhHome(funds));
await out('sitemap.xml', sitemap(paths));
await out('llms.txt', llms(funds));
const indexFile = join(ROOT, 'index.html');
await writeFile(indexFile, updateHome(await readFile(indexFile, 'utf8'), funds));
console.log(`OK：${funds.length} 檔基金（asOf ${funds[0]?.asOf}），${paths.length * 2} 個網址寫進 sitemap。`);
