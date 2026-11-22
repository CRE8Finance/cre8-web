#!/usr/bin/env node
/**
 * 產生官網的靜態內容頁（給不跑 JS 的 AI 爬蟲與搜尋引擎看）。
 *
 *   node scripts/build-pages.mjs            # 從測試網 API 抓基金資料
 *   CRE8_API=https://... node scripts/build-pages.mjs
 *
 * 產出（全部是純 HTML，不靠 support.js）：
 *   portfolios/index.html、portfolios/<catalogKey>/index.html、how-it-works/index.html、compare/index.html
 *   zh/portfolios/...、zh/how-it-works/index.html、zh/compare/index.html
 *   zh/index.html、zh/waitlist/index.html：讀英文 index.html、waitlist.html 套 scripts/zh-*.json 翻譯表產生（版型一模一樣，只換字）
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
// 測試網要邀請碼（使用者 2026-11-23）：所有 CTA 改成 Join waitlist，連到 cre8.finance/waitlist。
const WAITLIST = 'https://cre8.finance/waitlist';
const WAITLIST_ZH = '/zh/waitlist'; // 簡體 waitlist（由 waitlist.html 產生）
const WL = (lang) => (lang === 'zh' ? WAITLIST_ZH : WAITLIST);
const X = 'https://x.com/CRE8Finance';
const BUILT = new Date().toISOString().slice(0, 10);

// ---------------------------------------------------------------- 基金的固定文案（依 catalogKey）
// img：app/ 底下的封面。en.desc 照 cre8-app fund-copy.ts；zh 由我們寫。
const FUND_META = {
  pelosi: { img: 'p-pelosi', en: { name: 'Pelosi Portfolio', desc: 'Built from the stock trades Nancy Pelosi’s household discloses to Congress. NVIDIA, Alphabet, Microsoft, Amazon and Intel make up the core, with a small position in Broadcom.' }, zh: { name: '佩洛西持仓', desc: '按佩洛西家族向美国国会申报的股票交易整理。核心是英伟达、谷歌、微软、亚马逊和英特尔，外加少量博通。' } },
  trump: { img: 'p-trump', en: { name: 'Trump Holdings', desc: 'Built from Donald Trump’s financial disclosures: NVIDIA, Apple, Microsoft, Amazon, Meta, Tesla, Alphabet and Netflix in equal weights.' }, zh: { name: '特朗普持仓', desc: '按特朗普公开的财务申报整理：英伟达、苹果、微软、亚马逊、Meta、特斯拉、谷歌和奈飞，等权配置。' } },
  duan: { img: 'p-duan', en: { name: 'Duan Yongping', desc: 'Built from the US stocks Duan Yongping reports in his public filings: Apple, PDD Holdings, NVIDIA and Tesla in equal weights.' }, zh: { name: '段永平持仓', desc: '按段永平公开披露的美股持仓整理：苹果、拼多多、英伟达和特斯拉，等权配置。' } },
  musk: { img: 'p-musk', en: { name: 'Musk Basket', desc: 'Elon Musk’s world. Tesla, SpaceX and bitcoin make up the core, with a small position in Dogecoin.' }, zh: { name: '马斯克宇宙', desc: '马斯克系：特斯拉、SpaceX 加比特币做核心，再配一点狗狗币。' } },
  mag7: { img: 'p-mag7', en: { name: 'Mag7', desc: 'Seven of the largest US technology companies in equal weights: Apple, Microsoft, Alphabet, Amazon, NVIDIA, Meta and Tesla.' }, zh: { name: '美股七巨头', desc: '美股市值最大的七家科技公司，等权配置：苹果、微软、谷歌、亚马逊、英伟达、Meta 和特斯拉。' } },
  everyday: { img: 'p-everyday', en: { name: 'Everyday Brands', desc: 'Companies people use every day. Apple, Amazon, Netflix, Alphabet, Meta and Microsoft make up the core in equal weights, with a small position in Reddit.' }, zh: { name: '天天在用', desc: '你每天都在用的公司：苹果、亚马逊、奈飞、谷歌、Meta、微软等权做核心，外加少量 Reddit。' } },
  'ai-chips': { img: 'p-ai', en: { name: 'AI Chips', desc: 'The chipmakers behind AI computing. NVIDIA, TSMC, Intel and SK hynix make up the core, with small positions in Broadcom, Marvell and Penguin Solutions.' }, zh: { name: 'AI 芯片', desc: 'AI 算力背后的芯片公司：英伟达、台积电、英特尔、SK 海力士做核心，外加少量博通、Marvell 和 Penguin Solutions。' } },
  'ai-memory': { img: 'p-aimem', en: { name: 'AI Memory', desc: 'The memory and storage makers that AI data centers depend on: SK hynix, Micron and SanDisk in equal weights.' }, zh: { name: 'AI 存储', desc: 'AI 数据中心离不开的存储芯片：SK 海力士、美光和闪迪，等权配置。' } },
  'ai-models': { img: 'p-aimodel', en: { name: 'AI Model Makers', desc: 'Companies behind the leading AI models: Anthropic, Amazon, Alphabet, Microsoft, SpaceX and Meta in equal weights.' }, zh: { name: 'AI 大模型', desc: '做出头部 AI 大模型的公司：Anthropic、亚马逊、谷歌、微软、SpaceX 和 Meta，等权配置。' } },
  'new-giants': { img: 'p-giants', en: { name: 'New Giants', desc: 'Two of the largest new names on the market, SpaceX and Anthropic, in equal weights.' }, zh: { name: '新晋巨头', desc: '刚上市的两家巨头：SpaceX 和 Anthropic，各占一半。' } },
  'korea-semiconductors': { img: 'p-korea', en: { name: 'Korea Semis', desc: 'Korea’s chip industry: SK hynix and a broad South Korea market fund (EWY) in equal weights.' }, zh: { name: '韩国半导体', desc: '押注韩国芯片：SK 海力士加一只韩国大盘 ETF（EWY），各占一半。' } },
  china: { img: 'p-china', en: { name: 'China Tech', desc: 'Chinese e-commerce leaders Alibaba and PDD Holdings in equal weights.' }, zh: { name: '中概电商', desc: '中国电商双雄：阿里巴巴和拼多多，各占一半。' } },
  'crypto-treasuries': { img: 'p-ctsy', en: { name: 'Crypto Treasuries', desc: 'Listed companies that hold crypto on their balance sheets. Strategy (MSTR), BitMine (BMNR) and BNC make up the core, with a small position in CYPH.' }, zh: { name: '囤币上市公司', desc: '把加密资产放进资产负债表的上市公司：微策略（MSTR）、BitMine（BMNR）和 BNC 做核心，外加少量 CYPH。' } },
  'bitcoin-plus': { img: 'p-btcplus', en: { name: 'Bitcoin Plus', desc: 'Bitcoin alongside two listed companies tied to it, Strategy (MSTR) and Coinbase, in equal weights.' }, zh: { name: '比特币加强版', desc: '比特币，加上两家和比特币深度绑定的上市公司微策略（MSTR）和 Coinbase，等权配置。' } },
  bnb: { img: 'p-bnb', en: { name: 'BNB Ecosystem', desc: 'The BNB Chain ecosystem: BNB itself and BNC, a listed company that holds BNB, in equal weights.' }, zh: { name: 'BNB 生态', desc: 'BNB Chain 生态：BNB 本身，加上囤 BNB 的上市公司 BNC，各占一半。' } },
  'crypto-infrastructure': { img: 'p-cinfra', en: { name: 'Crypto Infrastructure', desc: 'The companies that move money in crypto: Circle, Coinbase and Robinhood in equal weights.' }, zh: { name: '加密基建', desc: '加密世界的资金通道：Circle、Coinbase 和 Robinhood，等权配置。' } },
  meme: { img: 'p-meme', en: { name: 'Meme Stocks', desc: 'Retail favourites. GameStop and Dogecoin make up the core, with small positions in AMC and Trump Media (DJT).' }, zh: { name: '迷因股', desc: '散户最爱：GameStop 和狗狗币做核心，外加少量 AMC 和特朗普媒体（DJT）。' } },
  'gold-bitcoin': { img: 'p-goldbtc', en: { name: 'Gold + Bitcoin', desc: 'Two stores of value side by side: tokenized gold (XAUt) and bitcoin in equal weights.' }, zh: { name: '黄金+比特币', desc: '新旧两种避险资产各占一半：黄金代币 XAUt 和比特币。' } },
  'us-market': { img: 'p-us', en: { name: 'US Market', desc: 'The broad US market through two index funds, the Nasdaq-100 (QQQ) and the S&P 500 (SPY), in equal weights.' }, zh: { name: '美股大盘', desc: '用两只指数 ETF 一次买下整个美股大盘：纳斯达克 100（QQQ）和标普 500（SPY），各占一半。' } },
  soxl: { img: 'p-soxl', en: { name: '3x Semiconductors', desc: 'Three times the daily move of US semiconductor stocks, through a single 3x leveraged token (SOXL).' }, zh: { name: '3 倍半导体', desc: '一只 3 倍杠杆代币（SOXL），每天放大美国半导体股 3 倍涨跌。' } },
  tqqq: { img: 'p-tqqq', en: { name: '3x Nasdaq', desc: 'Three times the daily move of the Nasdaq-100, through a single 3x leveraged token (TQQQ).' }, zh: { name: '3 倍纳指', desc: '一只 3 倍杠杆代币（TQQQ），每天放大纳斯达克 100 的 3 倍涨跌。' } },
};

// 代號 → 顯示代號、英文名、中文名。新資產沒列在這裡會停下來，免得頁面出現看不懂的代號。
const ASSETS = {
  NVDAB: ['NVDA', 'NVIDIA', '英伟达'], GOOGLB: ['GOOGL', 'Alphabet (Google)', '谷歌（Alphabet）'], MSFTB: ['MSFT', 'Microsoft', '微软'],
  AMZNB: ['AMZN', 'Amazon', '亚马逊'], INTCB: ['INTC', 'Intel', '英特尔'], AVGOB: ['AVGO', 'Broadcom', '博通'], AAPLB: ['AAPL', 'Apple', '苹果'],
  METAB: ['META', 'Meta', 'Meta'], TSLAB: ['TSLA', 'Tesla', '特斯拉'], NFLXB: ['NFLX', 'Netflix', '奈飞'], RDDTB: ['RDDT', 'Reddit', 'Reddit'],
  TSMB: ['TSM', 'TSMC', '台积电'], SKHYB: ['SKHY', 'SK hynix', 'SK 海力士'], MRVLB: ['MRVL', 'Marvell', 'Marvell'], PENGB: ['PENG', 'Penguin Solutions', 'Penguin Solutions'],
  MUB: ['MU', 'Micron', '美光'], SNDKB: ['SNDK', 'SanDisk', '闪迪'], ANTB: ['ANT', 'Anthropic', 'Anthropic'], SPCXB: ['SPCX', 'SpaceX', 'SpaceX'],
  EWYB: ['EWY', 'iShares MSCI South Korea ETF', '韩国大盘 ETF（iShares）'], BABAB: ['BABA', 'Alibaba', '阿里巴巴'], PDDB: ['PDD', 'PDD Holdings', '拼多多'],
  MSTRB: ['MSTR', 'Strategy', '微策略（Strategy）'], BMNRB: ['BMNR', 'BitMine', 'BitMine'], BNCB: ['BNC', 'BNC (listed BNB holder)', 'BNC（持有 BNB 的上市公司）'],
  CYPHB: ['CYPH', 'Cypherpunk', 'Cypherpunk'], BTCB: ['BTC', 'Bitcoin', '比特币'], COINB: ['COIN', 'Coinbase', 'Coinbase'], WBNB: ['BNB', 'BNB', 'BNB'],
  CRCLB: ['CRCL', 'Circle', 'Circle'], HOODB: ['HOOD', 'Robinhood', 'Robinhood'], GMEB: ['GME', 'GameStop', 'GameStop（游戏驿站）'], DOGE: ['DOGE', 'Dogecoin', '狗狗币'],
  AMCB: ['AMC', 'AMC Entertainment', 'AMC 院线'], DJTB: ['DJT', 'Trump Media', '特朗普媒体'], XAUT: ['XAUt', 'Tether Gold (tokenized gold)', '黄金代币'],
  QQQB: ['QQQ', 'Invesco QQQ (Nasdaq-100)', '纳指 100 ETF'], SPYB: ['SPY', 'SPDR S&P 500 ETF', '标普 500 ETF'],
  SOXLB: ['SOXL', 'Direxion Daily Semiconductor Bull 3x', '3 倍做多半导体 ETF'], TQQQB: ['TQQQ', 'ProShares UltraPro QQQ (3x Nasdaq-100)', '3 倍做多纳指 ETF'],
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
    openApp: 'Join waitlist', other: '中文', otherLabel: '简体中文', openTestnet: 'Open the testnet', apyLabel: 'Model APY', min: 'USDT minimum',
    kinds: { person: 'People', theme: 'Theme', leveraged: 'Leveraged' },
    groups: { person: 'People portfolios', theme: 'Theme portfolios', leveraged: 'Leveraged portfolios' },
  },
  zh: {
    lang: 'zh', htmlLang: 'zh-Hans', locale: 'zh_CN', home: '首页', portfolios: '组合', how: '使用指南', compare: '横向对比', faq: '常见问题',
    openApp: '加入等候名单', other: 'EN', otherLabel: 'English', openTestnet: '进入测试网', apyLabel: '模型年化', min: 'USDT 起投',
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
<link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=switzer@300,400&display=swap">
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600&family=Geist+Mono:wght@400;500&display=swap" rel="stylesheet" media="print" onload="this.media='all'">
<link rel="stylesheet" href="/assets/pages.css?v=2">
${extraHead}<link rel="stylesheet" href="/assets/press.css?v=2">
<script src="/assets/press.js?v=2" defer></script>
</head>
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
<div class="site-head__right"><a class="site-head__lang" href="${other}" hreflang="${lang === 'zh' ? 'en' : 'zh-Hans'}" lang="${lang === 'zh' ? 'en' : 'zh-Hans'}">${t.other}</a><a class="btn btn--gold btn--sm" href="${WL(lang)}">${t.openApp} <span aria-hidden="true">→</span></a></div>
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
    ? `<section class="cta"><h2>50 USDT 就能上车</h2><p>目前在测试网，测试 USDT 免费领，登录需要邀请码。</p><div class="actions"><a class="btn btn--light" href="${WAITLIST_ZH}">加入等候名单 <span aria-hidden="true">→</span></a></div></section>`
    : `<section class="cta"><h2>Start with 50 USDT.</h2><p>CRE8 is on testnet. Test USDT is free, and signing in needs an invite code.</p><div class="actions"><a class="btn btn--light" href="${WAITLIST}">Join waitlist <span aria-hidden="true">→</span></a></div></section>`;

// ---------------------------------------------------------------- 基金頁
function sourceText(f, lang) {
  const names = (pred) => f.holdings.filter(pred).map((h) => (lang === 'zh' ? h.zh : h.en.replace(/ \(.*\)$/, '')));
  const core = names((h) => h.weight > 5);
  const sat = names((h) => h.weight <= 5);
  const coreW = f.holdings.find((h) => h.weight > 5)?.weight;
  const equal = f.holdings.every((h) => Math.abs(h.weight - f.holdings[0].weight) < 0.02);
  const about = (w) => (Math.round(w * 10) / 10).toString() + '%';
  const weightLine = lang === 'zh'
    ? (equal ? `${list(core, lang)}各占约 ${about(coreW)}。` : `核心是${list(core, lang)}，各占约 ${about(coreW)}${sat.length ? `；${list(sat, lang)}${sat.length > 1 ? '各' : ''}占 5%` : ''}。`)
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
      pelosi: [`佩洛西家族会通过“定期交易报告”（PTR）向美国众议院申报股票交易，一般在成交后 30–45 天公开。这个组合就是按这些申报整理的。`, `她很多笔交易买的是看涨期权，组合里直接持有对应的正股。申报只披露金额区间、没有具体数字，所以权重由 CRE8 设定：${weightLine}`],
      trump: [`按特朗普向美国政府道德办公室（OGE）提交的财务申报整理。申报只列持仓的金额区间、不写股数，而且比实际交易晚几周到几个月。`, `因为只有区间，组合对申报里出现的美股大盘股做等权配置，不纳入他本人持有或经营的公司（比如特朗普媒体）。${weightLine}`],
      duan: [`按 H&H International Investment 每季度提交给美国证监会（SEC）的 13F 报告整理，段永平的美股持仓就是通过这家机构申报的。13F 最晚在每季度结束后 45 天公开。`, `组合持有报告里能在链上买到的股票，等权配置。报告里仓位很重的伯克希尔·哈撒韦没有纳入，因为链上还没有足够深的池子能买。${weightLine}`],
      musk: [`这一个不是跟申报的。马斯克没有公开个人持股清单，所以组合放的是他掌舵的两家公司特斯拉和 SpaceX，加上两家公司账上都有的比特币，再配一点狗狗币。`, weightLine],
      theme: [`CRE8 挑选贴合主题、并且能在链上以足够流动性买到的标的。池子深的放核心仓位，池子浅的每只约占 5%。`, weightLine],
      leveraged: [`只持有一个代币 ${f.holdings[0].ticker}，对应${f.holdings[0].zh}，这只 ETF 每天追求指数 3 倍的涨跌。杠杆组合单独归类，不混进主题组合。`],
    },
  };
  const k = f.category === 'person' ? f.key : f.category;
  return S[lang][k] || S[lang].theme;
}

function methodText(f, lang) {
  const late = f.holdings.filter((h) => h.includedFrom && f.start && h.includedFrom > f.start);
  const missing = f.holdings.filter((h) => !h.includedFrom);
  const rule = f.rebalance === 'monthly_drift' && f.holdings.length > 1
    ? (lang === 'zh' ? '组合每月调仓一次；任何资产偏离目标权重超过 5 个百分点时也会触发调仓。' : 'The portfolio rebalances once a month, and whenever an asset drifts more than 5 points from its target weight.')
    : '';
  if (lang === 'zh') {
    const extra = [
      ...late.map((h) => `${h.zh}（${h.ticker}）从 ${date(h.includedFrom, 'zh')} 起才计入。`),
      ...missing.map((h) => `${h.zh}（${h.ticker}）价格历史不足 30 天，暂未计入。`),
    ].join('');
    return [
      `年化收益是模型回测数字，不是实盘战绩。算法：用组合当前的目标权重，套上各资产的历史每日收盘价（股票和 ETF 用复权价，加密资产用币安行情，XAUt 用金价），算出 ${date(f.start, 'zh')} 至 ${date(f.asOf, 'zh')} 的复利年化收益。`,
      `价格历史不足 30 天的资产先不计入，满 30 天后再从那天起加入，期间它的权重按比例分给其他成分。${extra}`,
      `${rule}历史模型收益不代表未来表现，测试网上的余额也是按模拟价格变动。`,
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
      ? `<strong>高风险。</strong>这个组合持有 3 倍杠杆 ETF 代币。杠杆每天重置，拉长到几周、几个月，结果可能和“指数涨跌的 3 倍”差很远，震荡行情里亏损会越滚越大。模型里它近 90 天的收益是 ${pct(f.rets.d90)}。只适合能承受亏掉大部分本金的人。`
      : `<strong>High risk.</strong> This portfolio holds a 3x leveraged ETF token. The leverage resets every day, so over weeks and months the result can be far from three times the index, and losses compound in choppy markets. In the model it returned ${pct(f.rets.d90)} over the last 90 days. Only put in money you can afford to lose most of.`);
    items.push(zh ? '杠杆组合只能一次性买入，不支持分批买入，也不提供加息。' : 'Leveraged portfolios are bought in one go, with no gradual buying and no extra yield.');
  }
  items.push(zh
    ? `价格有涨有跌，你可能亏钱。这个组合只有 ${f.holdings.length} 个资产，集中度高${crypto ? '；其中含加密资产，波动通常比股票大得多' : ''}。`
    : `Prices go down as well as up, and you can lose money. This portfolio holds only ${f.holdings.length} asset${f.holdings.length > 1 ? 's' : ''}, so it’s concentrated${crypto ? ', and the crypto in it can swing far more than stocks' : ''}.`);
  if (f.category === 'person' && f.key !== 'musk') items.push(zh ? '申报有延迟，组合反映的是已经公开的持仓，不是对方此刻手里的仓位。' : 'Filings are delayed, so the portfolio reflects what has been disclosed, not what is held today.');
  items.push(zh
    ? '股票以 bStock 代币形式持有：背后是发行方（币安关联公司）托管的正股，发行方每天公布储备证明，也有权冻结代币。这和在券商名下持股不是一回事。'
    : 'Stocks are held as bStock tokens, backed by shares held by the issuer, a Binance affiliate, which publishes a daily proof of reserves and can freeze tokens. That isn’t the same as owning the shares at a broker.');
  items.push(zh ? '股票代币只在美股交易时段成交。部分资产的链上池子较浅，大额买卖会有滑点。' : 'Stock tokens only trade while the US market is open. Some on-chain markets are thin, so large orders move the price.');
  return items;
}

function fundPage(f, funds, lang) {
  const t = T[lang];
  const m = f.meta[lang];
  const zh = lang === 'zh';
  const path = '/portfolios/' + f.key;
  const c = crumbs(lang, [[t.home, '/'], [t.portfolios, '/portfolios'], [m.name, path]]);
  const enName = f.meta.en.name;
  const title = zh ? `${m.name}（${enName}）持仓、权重与年化收益 | CRE8` : `${m.name}: holdings, weights and model APY | CRE8`;
  const description = zh
    ? `${m.desc}用 USDT 一键买入，${f.min} USDT 起投，资产放在你自己的链上账户。模型年化 ${pct(f.apy)}（回测，截至 ${date(f.asOf, 'zh')}）。`
    : `${m.desc} Buy it with USDT from ${f.min} USDT and hold it in your own on-chain account. Model APY ${pct(f.apy)} (backtest, as of ${date(f.asOf, 'en')}).`;
  const product = {
    '@context': 'https://schema.org', '@type': 'FinancialProduct', name: m.name, alternateName: zh ? enName : f.meta.zh.name,
    description: m.desc, url: abs(P(lang, path)), image: `${SITE}/app/${f.meta.img}.jpg`,
    category: zh ? `${t.kinds[f.category]}组合` : `${t.kinds[f.category]} portfolio`, provider: ORG,
  };
  const related = funds.filter((x) => x.category === f.category && x.key !== f.key).slice(0, 4);
  const crown = f.category === 'leveraged' ? `<div class="note note--risk"><p>${riskText(f, lang)[0]}</p></div>` : '';
  const steps = zh
    ? [['加入等候名单', `打开 <a class="link" href="${WAITLIST_ZH}">cre8.finance/zh/waitlist</a>，连接 X 排队。拿到邀请码后，到 tst.cre8.finance 登录。`], ['领测试 USDT', '在应用里免费领取测试 USDT。'], [`买入${m.name}`, `打开这个组合，输入金额（${f.min} USDT 起投）并确认，一笔付款按目标权重买齐所有资产。`], ['持有或卖出', '在账户里随时查看持仓，美股开盘时可以随时卖回 USDT。']]
    : [['Join the waitlist', `Go to <a class="link" href="${WAITLIST}">cre8.finance/waitlist</a> and connect X. With an invite code, sign in at tst.cre8.finance.`], ['Get test USDT', 'Claim free test USDT in the app.'], [`Buy ${m.name}`, `Open the portfolio, enter an amount (${f.min} USDT minimum) and confirm. One payment buys every asset at its target weight.`], ['Hold or sell', 'Track it in your account and sell back to USDT whenever the US market is open.']];
  const retLabels = zh ? [['近 7 天', 'd7'], ['近 30 天', 'd30'], ['近 90 天', 'd90'], ['近 1 年', 'y1'], [`${date(f.start, 'zh')}至今`, 'all']] : [['7 days', 'd7'], ['30 days', 'd30'], ['90 days', 'd90'], ['1 year', 'y1'], [`Since ${date(f.start, 'en')}`, 'all']];
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
<div class="actions"><a class="btn btn--gold" href="${WL(lang)}">${zh ? '加入等候名单' : 'Join waitlist'} <span aria-hidden="true">→</span></a><a class="btn btn--line" href="${P(lang, '/how-it-works')}">${t.how}</a></div>
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
<h2>${f.category === 'person' ? (zh ? '持仓从哪来' : 'Where the list comes from') : (zh ? '怎么选的' : 'How it’s put together')}</h2>
${sourceText(f, lang).map((p) => `<p>${esc(p)}</p>`).join('\n')}
</section>

<section class="section" id="returns">
<div class="prose"><h2>${zh ? '收益怎么算' : 'How the return is calculated'}</h2>
${methodText(f, lang).map((p) => `<p>${esc(p)}</p>`).join('\n')}</div>
<div class="rets">${retLabels.map(([l, k]) => `<div><span>${esc(l)}</span><b class="${cls(f.rets[k])}">${pct(f.rets[k])}</b></div>`).join('')}</div>
<p class="small muted" style="margin-top:12px">${zh ? `模型收益，截至 ${date(f.asOf, 'zh')}。` : `Model returns as of ${date(f.asOf, 'en')}.`}</p>
</section>

<section class="section prose" id="risks">
<h2>${zh ? '风险提示' : 'Risks'}</h2>
<ul>${risks.map((r) => `<li>${r.startsWith('<strong>') ? r : esc(r)}</li>`).join('')}</ul>
</section>

<section class="section" id="buy">
<div class="section__head"><h2>${zh ? '怎么买' : 'How to buy'}</h2></div>
<ol class="steps">${steps.map(([b, p], i) => `<li><span>0${i + 1} / 0${steps.length}</span><b>${esc(b)}</b><p>${p}</p></li>`).join('')}</ol>
</section>

${related.length ? `<section class="section"><div class="section__head"><h2>${zh ? `更多${t.groups[f.category]}` : `More ${t.groups[f.category].toLowerCase()}`}</h2><a class="link" href="${P(lang, '/portfolios')}">${zh ? '查看全部组合' : 'All portfolios'} →</a></div><div class="fund-list">${related.map((x) => fundRow(x, lang)).join('')}</div></section>` : ''}

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
  const title = zh ? `全部 ${funds.length} 个组合：人物、主题、杠杆 | CRE8` : `All ${funds.length} portfolios: people, themes and leveraged | CRE8`;
  const description = zh
    ? `CRE8 全部 ${funds.length} 个美股和加密组合：跟投佩洛西、特朗普、马斯克、段永平，或押注 AI 芯片、美股七巨头、BNB 生态等赛道。用 USDT 一键买入，50 USDT 起投。`
    : `All ${funds.length} CRE8 portfolios of US stock tokens and crypto: Pelosi, Trump, Musk and Duan Yongping, plus themes like AI Chips, Mag7 and BNB Ecosystem. Buy with USDT from 50 USDT.`;
  const itemList = { '@context': 'https://schema.org', '@type': 'ItemList', name: title, itemListElement: funds.map((f, i) => ({ '@type': 'ListItem', position: i + 1, url: abs(P(lang, '/portfolios/' + f.key)), name: f.meta[lang].name })) };
  const groups = ['person', 'theme', 'leveraged'].map((g) => [g, funds.filter((f) => f.category === g)]).filter(([, l]) => l.length);
  return head({ lang, path, title, description, schema: [itemList, c.schema] }) + `
<main class="wrap">
${c.html}
<h1>${zh ? '全部组合' : 'All portfolios'}</h1>
<p class="lede">${zh ? `${funds.length} 个组合，每个都是一篮美股代币或加密资产，用 USDT 一笔买齐。右侧是模型年化收益（回测，截至 ${date(asOf, 'zh')}）。` : `${funds.length} portfolios, each a basket of US stock tokens or crypto you buy with USDT in one payment. The figure on the right is the model APY (backtest, as of ${date(asOf, 'en')}).`}</p>
<div class="section">
${groups.map(([g, l]) => `<div class="group" id="${{ person: 'people', theme: 'themes', leveraged: 'leveraged' }[g]}"><h2>${t.groups[g]}</h2><div class="fund-list">${l.map((f) => fundRow(f, lang)).join('')}</div></div>`).join('\n')}
</div>
<p class="small muted" style="margin-top:24px">${zh ? '模型年化是用当前权重套历史价格回测出来的，不是实盘战绩，也不代表未来表现。' : 'Model APY is a backtest of the current weights on historical prices. It isn’t a track record and doesn’t predict future returns.'} <a class="link" href="${P(lang, '/how-it-works')}">${t.how}</a></p>
${ctaBand(lang)}
</main>
` + siteFoot(lang, funds);
}

// ---------------------------------------------------------------- FAQ（首頁兩種語言共用；schema 從同一份文字產生）
function faqs(lang) {
  const cmp = P(lang, '/compare');
  if (lang === 'zh') return [
    ['现在用的是真钱吗？', '还不是。CRE8 目前在 BNB Chain 测试网，测试 USDT 免费领，主网上线时间还没定。'],
    ['安全吗？', '目前 CRE8 上的一切都不涉及真钱。你的组合放在你自己的 BNB Chain 智能账户里，CRE8 的自动化只能在账户内交易，资产要转出必须你本人签名。上主网前，合约会经过第三方审计。'],
    ['股票由谁托管？', '你自己。股票以代币形式放在只有你能控制的链上账户里，不和任何人的资产混在一起。'],
    ['怎么提现？', '把组合部分或全部卖回 USDT，再提到任意 BNB Chain 地址就行。股票代币要在美股开盘时才能卖。'],
    ['闲置 USDT 怎么生息？', '点 Earn，把闲置 USDT 存进白名单里的 USDT 金库（Lista、Venus、Aave），按市场利率计息，随存随取。买组合时还可以打开“加息”，用组合里的股票多赚一点；价格急跌时系统会自动卖出一小部分，保证安全。你的现金和组合资金始终分开。'],
    ['和在交易所买美股代币有什么区别？', `在交易所只能一只一只买，股票放在交易所账户里。CRE8 一笔钱买齐一整篮，自动调仓回目标比例，资产放在你自己的链上账户，闲置的 USDT 还能生息。详见<a href="${cmp}">对比</a>。`],
    ['美股休市时能买卖吗？', '股票代币只在美股交易时段成交。休市期间下的买单或卖单会在账户里排队，下次开盘时成交。'],
    ['最低投多少？', '每笔 50 USDT 起投。'],
    ['收费吗？', '测试网全免费，gas 也由 CRE8 承担。主网费率会在上线前公布。'],
    ['谁可以用？', '美国以外、当地法规允许的用户都可以。测试网期间需要邀请码才能登录。'],
  ];
  return [
    ['Is this real money?', 'Not yet. CRE8 is on BNB Chain testnet, and test USDT is free. There’s no mainnet date yet.'],
    ['Is CRE8 safe?', 'Nothing on CRE8 involves real money yet. Your portfolio sits in your own smart account on BNB Chain. CRE8’s automation can only trade inside it, and moving money out takes your signature. The contracts get an external audit before mainnet.'],
    ['Who holds my shares?', 'You do. They sit as tokens in an on-chain account only you control, never pooled with anyone else’s.'],
    ['How do I cash out?', 'Sell some or all of a portfolio back to USDT, then withdraw the USDT to any BNB Chain address. Stock tokens sell while the US market is open.'],
    ['How does idle USDT earn?', 'Press Earn to put idle USDT in an allowlisted USDT vault (Lista, Venus or Aave) at the market rate, and withdraw it whenever you like. When you buy a portfolio you can also turn on extra yield, which uses its shares to earn a bit more and automatically sells a little if prices fall fast. Your cash and your portfolios are always kept separate.'],
    ['How is this different from buying stock tokens on an exchange?', `On an exchange you buy one stock at a time and it sits in your exchange account. CRE8 buys a whole basket in one payment, rebalances it to its target weights, keeps it in an account you own on-chain, and lets idle USDT earn. See the <a href="${cmp}">comparison</a>.`],
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
  const title = zh ? '使用指南：买入、托管、费用、提现 | CRE8' : 'How CRE8 works: buying, custody, fees and withdrawals';
  const description = zh
    ? '用 USDT 买一篮美股代币和加密资产：资产谁来托管、费用多少、怎么卖出提现、美股休市怎么成交、闲置 USDT 怎么生息，这里一次讲清楚。CRE8 目前在测试网。'
    : 'How buying a CRE8 portfolio with USDT works: who holds the assets, what it costs, how to sell and withdraw, what happens when the US market is closed, and how idle USDT earns. CRE8 is on testnet.';
  const page = { '@context': 'https://schema.org', '@type': 'WebPage', name: title, description, url: abs(P(lang, path)), inLanguage: t.htmlLang, isPartOf: { '@type': 'WebSite', name: 'CRE8', url: SITE + '/' } };
  const body = zh ? `
<h1>使用指南</h1>
<p class="lede">用 USDT 一笔买入一篮美股代币和加密资产，资产放在你自己的链上账户里。还没投出去的 USDT，也可以先拿去生息。</p>
<div class="section prose">
<h2>怎么买</h2>
<ol>
<li>用邮箱或 Google 登录。CRE8 会在 BNB Chain 上为你开一个智能账户，所有人就是你登录用的钱包。</li>
<li>往账户里充 USDT。测试网上可以在应用里免费领测试 USDT。</li>
<li>选一个组合，输入金额，50 USDT 起投。确认后，一笔付款按目标权重买齐组合里的每个资产。</li>
</ol>
<p>交易只走白名单里的链上 DEX（PancakeSwap、KyberSwap、OpenOcean），每个资产有单笔上限，大单会自动拆成几笔。</p>
<p>买入后组合会自动维持比例：每月调仓一次，任何资产偏离目标权重超过 5 个百分点时也会调仓。你也可以自己挑股票、定比例，CRE8 一样帮你调仓。</p>

<h2 style="margin-top:56px">资产谁来托管</h2>
<p>你自己。每个用户在 BNB Chain 上都有自己的智能账户，资产以代币形式放在里面，不和别人的资产混在一起，用区块浏览器就能查到。CRE8 的自动化只能在你的账户里交易，资产要转出账户必须你本人签名。</p>
<p>美股以 bStock 形式持有。bStock 是币安在 BNB Chain 上发行的美股代币，背后是发行方（币安关联公司）托管的正股，发行方每天公布储备证明，也有权冻结代币。持有 bStock 和在券商名下持股不同：没有投票权，分红和拆股体现在代币余额上，不发现金。</p>

<h2 style="margin-top:56px">费用</h2>
<ul>
<li><strong>测试网：</strong>全免费，gas 由 CRE8 承担。</li>
<li><strong>主网：</strong>费率会在上线前公布。DEX 本身的池子手续费和滑点另计。</li>
</ul>

<h2 style="margin-top:56px">卖出与提现</h2>
<p>组合可以部分或全部卖回 USDT，钱回到你的账户。之后可以把 USDT 提到任意 BNB Chain 地址，包括交易所充值地址。大额卖出会按每个资产的单笔上限分几笔成交。</p>

<h2 style="margin-top:56px">美股休市时</h2>
<p>股票代币只在美股交易时段成交，CRE8 不会在休市时硬买硬卖。休市期间下的单会在账户里排队，下次开盘时成交；在此之前，你的 USDT 一直留在自己的账户里。</p>

<h2 style="margin-top:56px">闲置 USDT 怎么生息</h2>
<p>账户里的 USDT 可以放着不动，也可以点 <strong>Earn</strong>，存进 CRE8 白名单里的 USDT 金库（Lista、Venus、Aave）。每个金库都会显示年化，随市场利率浮动，CRE8 不承诺收益率。随存随取，利息一起到账。你不点，CRE8 不会动你的现金。</p>
<h3>组合加息</h3>
<p>买组合时可以顺手打开“加息”。它默认关闭，要你自己开。打开后，CRE8 会用这个组合里的股票再多赚一点：把股票存进借贷市场做抵押，按保守比例借出一小笔 USDT，再存进 USDT 金库。价格急跌时，系统会自动卖出一小部分保证安全，事后在活动记录里告诉你卖了多少。随时可以关，股票会留在组合里。</p>
<p>CRE8 只借市场允许额度的一小部分，风险很低，但不是零。杠杆组合不提供加息。</p>
<p>你的现金和每个组合的资金永远分开：组合加息用到的 USDT 只属于这个组合，不算你的现金，也不会和别的组合混在一起。</p>
<p>测试网上的金库和利率都是模拟的，数字仅供参考。</p>

<h2 style="margin-top:56px">目前是测试网</h2>
<ul>
<li>CRE8 跑在 BNB Chain 测试网上，代币和价格都是测试版，不涉及真钱。</li>
<li>测试 USDT 免费领，登录需要邀请码。</li>
<li>主网上线时间还没定，上主网前合约会经过第三方审计。</li>
<li>美国以外、当地法规允许的用户都可以使用。</li>
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
<section class="section"><div class="section__head"><h2>${zh ? '从一个组合开始' : 'Start with a portfolio'}</h2><a class="link" href="${P(lang, '/portfolios')}">${zh ? '查看全部组合' : 'All portfolios'} →</a></div><div class="fund-list">${['pelosi', 'ai-chips', 'mag7', 'us-market'].map((k) => funds.find((f) => f.key === k)).filter(Boolean).map((f) => fundRow(f, lang)).join('')}</div></section>
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
  const title = zh ? '用 USDT 买美股：交易所、链上代币、美股券商和 CRE8 对比 | CRE8' : 'Buying US stocks with USDT: exchanges, stock tokens, brokers and CRE8 compared';
  const description = zh
    ? '想用 USDT 买美股，有哪几种方式？交易所、自己买链上美股代币、开美股券商账户和 CRE8，各适合什么人。'
    : 'Ways to buy US stocks with USDT, compared: an exchange, buying stock tokens yourself, a US brokerage account, and CRE8. Who each one suits.';
  const page = { '@context': 'https://schema.org', '@type': 'WebPage', name: title, description, url: abs(P(lang, path)), inLanguage: t.htmlLang, dateModified: BUILT, isPartOf: { '@type': 'WebSite', name: 'CRE8', url: SITE + '/' } };
  const cols = zh ? ['CRE8', '交易所', '自己买链上代币', '美股券商'] : ['CRE8', 'Exchange', 'Stock tokens, DIY', 'US broker'];
  const rows = zh ? [
    ['一次买一篮', '可以，21 个组合，也能自己配', '一只一只买', '一只一只买', '一只一只买'],
    ['自动调仓', '有', '没有', '没有', '一般没有'],
    ['资产放在哪', '你自己的链上账户', '交易所账户', '你自己的钱包', '券商账户'],
    ['用什么付款', 'USDT', 'USDT 等', '稳定币', '法币'],
    ['闲置资金生息', '有，随时领出', '另买理财产品', '没有', '看券商'],
    ['要不要开户', '不用，钱包登录', '要 KYC', '不用', '要开户和 KYC'],
  ] : [
    ['Buy a basket at once', 'Yes, 21 portfolios or your own', 'One at a time', 'One at a time', 'One at a time'],
    ['Automatic rebalancing', 'Yes', 'No', 'No', 'Usually not'],
    ['Where assets sit', 'Your own on-chain account', 'Your exchange account', 'Your own wallet', 'Your brokerage account'],
    ['Pay with', 'USDT', 'USDT and others', 'Stablecoins', 'Fiat'],
    ['Yield on idle cash', 'Yes, withdraw any time', 'Separate products', 'No', 'Depends on the broker'],
    ['Account opening', 'No, sign in with a wallet', 'KYC required', 'No', 'Account and KYC'],
  ];
  const cards = zh ? [
    ['在交易所买美股代币', '适合只买一两只热门股、或单笔金额很大的人。', '想一次买下一整个赛道、自动调仓、资产放在自己链上账户，用 CRE8 更省心。'],
    ['自己在链上买美股代币', '适合熟悉钱包、会自己核对合约地址的人。', 'CRE8 帮你挑好资产、一笔买齐，闲置的 USDT 还能生息。'],
    ['开美股券商账户', '适合钱本来就在银行、当地开户方便的人。', '钱都是 USDT、不想出入金的话，CRE8 能省掉换汇和开户这一步。'],
  ] : [
    ['Buying stock tokens on an exchange', 'Suits people who want one or two popular stocks, or who move large amounts.', 'If you want a whole theme in one payment, kept on target and held in your own on-chain account, CRE8 is less work.'],
    ['Buying stock tokens yourself', 'Suits people who are at home with wallets and check contract addresses themselves.', 'CRE8 picks the assets, buys them in one payment, and lets idle USDT earn.'],
    ['Opening a US brokerage account', 'Suits people whose money is already in a bank and who can open an account easily where they live.', 'If your money is in USDT and you’d rather not cash out, CRE8 skips the cash-out and account opening.'],
  ];
  return head({ lang, path, title, description, schema: [page, c.schema] }) + `
<main class="wrap">
${c.html}
<h1>${zh ? '用 USDT 买美股，有哪几种方式' : 'Ways to buy US stocks with USDT'}</h1>
<section class="section">
<div class="table-wrap"><table class="cmp">
<thead><tr><th scope="col"></th>${cols.map((x, i) => `<th scope="col"${i === 0 ? ' class="us"' : ''}>${esc(x)}</th>`).join('')}</tr></thead>
<tbody>${rows.map(([h, ...cells]) => `<tr><th scope="row">${esc(h)}</th>${cells.map((x, i) => `<td${i === 0 ? ' class="us"' : ''}>${esc(x)}</td>`).join('')}</tr>`).join('\n')}</tbody>
</table></div>
</section>
${cards.map(([h, who, us]) => `<section class="section prose"><h2>${esc(h)}</h2><p>${esc(who)}</p><p>${esc(us)}</p></section>`).join('\n')}
<section class="section prose"><p><a class="link" href="${P(lang, '/how-it-works')}">${t.how}</a> · <a class="link" href="${P(lang, '/portfolios')}">${zh ? '查看全部组合' : 'All portfolios'}</a></p></section>
${ctaBand(lang)}
</main>
` + siteFoot(lang, funds);
}

// ---------------------------------------------------------------- 簡體首頁
const topLists = (funds) => {
  const top = (pred) => funds.filter((f) => pred(f) && f.apy !== null && f.apy > 0).sort((a, b) => b.apy - a.apy).slice(0, 4);
  return { people: top((f) => f.category === 'person'), themes: top((f) => f.category !== 'person') };
};

// 簡體版的首頁與 waitlist 不另外寫：讀英文頁，套 scripts/zh-*.json 的翻譯表，版型、圖、動畫、模板全部同一份。
const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const CJK_SANS = "'PingFang SC','Hiragino Sans GB','Microsoft YaHei'";
function translate(html, table, name) {
  for (const [en, zh] of Object.entries(table.raw || {})) {
    if (!html.includes(en)) throw new Error(`${name}：翻譯表 raw 的「${en}」在英文頁找不到（英文改了？）`);
    html = html.split(en).join(zh);
  }
  // text：整段文字，前面是 > 或引號、後面是 < 或引號（中間可有空白），免得短字串誤換到別的句子裡。長的先換。
  const missing = [];
  for (const [en, zh] of Object.entries(table.text).sort((a, b) => b[0].length - a[0].length)) {
    let n = 0;
    html = html.replace(new RegExp(`([>"'])(\\s*)${reEsc(en)}(\\s*)(?=[<"'])`, 'g'), (m, a, b, c) => (n++, a + b + zh + c));
    if (!n) missing.push(en);
  }
  if (missing.length) throw new Error(`${name}：翻譯表有 ${missing.length} 句在英文頁找不到（英文改了？）：\n  ${missing.join('\n  ')}`);
  return html;
}
// 翻完還留著的英文：畫面文字與 alt／aria-label／placeholder／title。品牌、代號（全大寫）與 allow 清單除外。
function leftoverEnglish(html, allow) {
  const ok = new Set(allow);
  const body = html.slice(html.indexOf('<body')).replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/\{\{[^}]*\}\}/g, '');
  const bits = [...body.matchAll(/>([^<]+)</g)].map((m) => m[1]);
  for (const m of body.matchAll(/\s(?:alt|aria-label|placeholder|title)="([^"]*)"/g)) bits.push(m[1]);
  const bad = new Set();
  for (const t of bits) for (const w of t.replace(/https?:\/\/\S+/g, '').match(/[@A-Za-z0-9][\w@’'-]*/g) || []) if (/[A-Za-z]{2}/.test(w) && !/^@|\d/.test(w) && !ok.has(w) && !/^[A-Z]+$/.test(w)) bad.add(w);
  return [...bad];
}
const mustReplace = (html, from, to, name) => {
  if (!html.includes(from)) throw new Error(`${name}：找不到「${from}」`);
  return html.split(from).join(to);
};
// 中文頁共用：lang、canonical、og:url、og:locale；中文字型（內文用系統黑體，標題配思源黑體 Light，只載標題用到的字）。
function zhHead(html, enPathname, name) {
  const zhUrl = abs(zhPath(enPathname));
  html = mustReplace(html, '<html lang="en">', '<html lang="zh-Hans">', name);
  html = html.replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${zhUrl}">`);
  html = html.replace(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${zhUrl}">`);
  html = html.replace(/<meta property="og:locale" content="[^"]*">\n?/, '');
  html = mustReplace(html, '<meta property="og:site_name" content="CRE8">', '<meta property="og:site_name" content="CRE8">\n<meta property="og:locale" content="zh_CN">', name);
  html = html.replace(/'Geist Mono'/g, `'Geist Mono',${CJK_SANS}`).replace(/'Geist'/g, `'Geist',${CJK_SANS}`);
  html = html.replace(/'Switzer','Geist'/g, "'Switzer','Noto Sans SC','Geist'");
  return html;
}
// 標題用的 Noto Sans SC（Light）：只要 h1–h3 與用 Switzer 的段落裡的字（Google Fonts text= 子集，一個小檔）。
function serifSubset(html) {
  const chars = new Set();
  for (const m of html.matchAll(/<(h1|h2|h3|p)\b([^>]*)>([\s\S]*?)<\/\1>/g)) {
    if (m[1] === 'p' && !m[2].includes('Switzer')) continue;
    for (const ch of m[3].replace(/<[^>]+>/g, '')) if (/[^\x00-\x7F]/.test(ch)) chars.add(ch);
  }
  return [...chars].sort().join('');
}
function withZhSerif(html) {
  const text = serifSubset(html);
  if (!text) return html;
  const link = `<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300&display=swap&text=${encodeURIComponent(text)}" rel="stylesheet">\n`;
  return html.replace('</head>', link + '</head>');
}
const loadTable = async (file) => JSON.parse(await readFile(join(ROOT, 'scripts', file), 'utf8'));

async function zhHome(enHtml, funds) {
  const tb = await loadTable('zh-home.json');
  const name = 'zh/index.html';
  let html = enHtml;
  // 資料區塊（Top portfolios、FAQ）用中文重產；FAQPage schema 跟畫面同一份文字。
  const { people, themes } = topLists(funds);
  html = replaceBlock(html, 'top-people', people.map((f) => homeRow(f, 'zh')).join('\n'));
  html = replaceBlock(html, 'top-themes', themes.map((f) => homeRow(f, 'zh')).join('\n'));
  html = replaceBlock(html, 'faq', faqBlock('zh'));
  html = html.replace(/(data-apy="([a-z0-9-]+)"[^>]*>)[^<]*(<)/g, (m0, open, key, close) => `${open}年化 ${pct(funds.find((x) => x.key === key).apy)}${close}`);
  const site = { '@context': 'https://schema.org', '@type': 'WebSite', name: 'CRE8', url: SITE + '/zh', inLanguage: 'zh-Hans', description: tb.description };
  html = html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, ld([{ '@context': 'https://schema.org', ...ORG }, site, faqSchema('zh')]));
  // 首頁用相對路徑；/zh 底下要改成從根目錄起算。
  html = html.replace(/(src|href)="(assets|app)\//g, '$1="/$2/').replace(/url\((assets|app)\//g, 'url(/$1/').replace(/"\.\/(support|image-slot)\.js"/g, '"/$1.js"').replace(/":"assets\/vendor\//g, '":"/assets/vendor/');
  // 連到中文版對應頁；語言切換改成 EN → 英文首頁。
  html = html.replace(/href="\/(portfolios|how-it-works|compare)/g, 'href="/zh/$1');
  html = mustReplace(html, `href="${WAITLIST}"`, `href="${WAITLIST_ZH}"`, name);
  html = mustReplace(html, 'href="/zh" lang="zh-Hans" hreflang="zh-Hans" aria-label="简体中文"', 'href="/" lang="en" hreflang="en" aria-label="English"', name);
  html = mustReplace(html, '>中文</a>', '>EN</a>', name);
  html = mustReplace(html, 'href="/zh" lang="zh-Hans"', 'href="/" lang="en"', name);
  html = mustReplace(html, '>简体中文</a>', '>English</a>', name);
  // 畫面上的基金名稱（How it works 面板）照 FUND_META，跟基金頁同名。
  const text = { ...tb.text };
  for (const f of Object.values(FUND_META)) { text[f.en.name + ' cover'] = f.zh.name + '封面'; }
  const used = (en) => new RegExp(`[>"']\\s*${reEsc(en)}\\s*[<"']`).test(html);
  for (const f of Object.values(FUND_META)) if (used(f.en.name)) text[f.en.name] = f.zh.name;
  for (const k of Object.keys(text)) if (k.endsWith(' cover') && !used(k)) delete text[k];
  html = translate(html, { raw: tb.raw, text }, name);
  html = zhHead(html, '/', name);
  html = mustReplace(html, '</style>\n<link rel="preload" as="image"', `${ZH_HOME_CSS}</style>\n<link rel="preload" as="image"`, name);
  html = withZhSerif(html);
  const left = leftoverEnglish(html, tb.allow);
  if (left.length) throw new Error(`${name}：還有沒翻到的英文：${left.join(', ')}（加進 scripts/zh-home.json）`);
  return html;
}
// 中文標題：字面比英文大，字級略小、行高略大、不要負字距。英文頁的樣式寫在 style 屬性裡，這裡用屬性選擇器蓋過去。
const ZH_HOME_CSS = [
  '.door-copy h1{font-size:clamp(42px,5.2vw,76px);line-height:1.18;letter-spacing:0}',
  '[style*="Switzer"]{letter-spacing:0!important}',
  'h2[style*="clamp(34px,3.6vw,52px)"],p[style*="clamp(34px,3.6vw,52px)"]{font-size:clamp(30px,3.2vw,46px)!important;line-height:1.28!important}',
  'h3[style*="clamp(28px,2.6vw,38px)"]{font-size:clamp(26px,2.4vw,34px)!important;line-height:1.28!important}',
  'h2[style*="clamp(46px,5.8vw,84px)"]{font-size:clamp(38px,5vw,72px)!important;line-height:1.18!important}',
  '[style*="Switzer"]{text-wrap:balance}p{text-wrap:pretty}',
  // 深色帶那句：中文比英文長，放寬一點寬度，桌面才排得成一行。
  'p[style*="max-width:15em"]{max-width:19em!important}',
].join('');

async function zhWaitlist() {
  const tb = await loadTable('zh-waitlist.json');
  const name = 'zh/waitlist/index.html';
  let html = await readFile(join(ROOT, 'waitlist.html'), 'utf8');
  html = mustReplace(html, 'const OPT_LABEL = {};', `const OPT_LABEL = ${JSON.stringify(tb.optLabel)};`, name);
  html = html.replace(/const POST_TEXT = '[^']*';/, () => `const POST_TEXT = ${JSON.stringify(tb.postText)};`);
  html = html.replace(/(https:\/\/x\.com\/intent\/post\?text=)[^"]*/, (m, a) => a + encodeURIComponent(tb.postText));
  html = translate(html, tb, name);
  html = zhHead(html, '/waitlist', name);
  const left = leftoverEnglish(html, tb.allow);
  if (left.length) throw new Error(`${name}：還有沒翻到的英文：${left.join(', ')}（加進 scripts/zh-waitlist.json）`);
  return html;
}

// ---------------------------------------------------------------- 英文首頁：就地改寫標記區塊
function replaceBlock(html, name, content) {
  const re = new RegExp(`(<!-- gen:${name} -->)[\\s\\S]*?(<!-- /gen:${name} -->)`);
  if (!re.test(html)) throw new Error(`index.html 找不到 <!-- gen:${name} --> 區塊`);
  return html.replace(re, `$1\n${content}\n$2`);
}

function homeRow(f, lang = 'en') {
  const name = esc(f.meta[lang].name);
  return `<a href="${P(lang, '/portfolios/' + f.key)}" style="display:flex;justify-content:space-between;align-items:center;gap:24px;padding:28px 0;border-top:1px solid rgba(11,15,20,.08)" style-hover="opacity:1;background:#F6F8FA"><span style="display:flex;align-items:center;gap:clamp(12px,2vw,20px);min-width:0"><span style="flex:none;width:clamp(52px,6vw,72px);height:clamp(52px,6vw,72px);border-radius:16px;overflow:hidden;background:#F1F3F5;box-shadow:inset 0 0 0 1px rgba(11,15,20,.06)"><span role="img" aria-label="${name}" style="display:block;width:100%;height:100%;background:#F1F3F5 url(app/${f.meta.img}.jpg) 50% 22%/cover no-repeat"></span></span><span style="min-width:0;overflow-wrap:anywhere;font:500 clamp(24px,2.2vw,32px)/1.15 'Geist';letter-spacing:-.03em">${name}</span></span><span style="flex:none;display:flex;align-items:center;gap:clamp(12px,2vw,28px)"><span style="font:400 clamp(24px,2.2vw,32px) 'Geist';letter-spacing:-.03em;white-space:nowrap;color:${f.apy >= 0 ? '#1E8A5C' : '#D23F2E'}">${pct(f.apy)}</span><span style="font:300 24px 'Geist'">↗︎</span></span></a>`;
}

const faqBlock = (lang) => faqs(lang).map(([q, a], i, all) => `<details style="border-top:1px solid rgba(11,15,20,.08)${i === all.length - 1 ? ';border-bottom:1px solid #D5DBE0' : ''}"><summary style="display:flex;justify-content:space-between;gap:20px;padding:28px 0;font:500 clamp(20px,1.7vw,24px)/1.2 'Geist';letter-spacing:-.02em">${esc(q)}<span class="pm" style="font:300 28px 'Geist';transition:transform .2s">+</span></summary><p style="font:400 16px/1.6 'Geist';color:#3A4652;margin:0;padding:0 0 28px;max-width:46ch">${a.replace(/<a /g, '<a style="color:#2F5B7C;text-decoration:underline" ')}</p></details>`).join('\n');

function updateHome(html, funds) {
  const { people, themes } = topLists(funds);
  html = replaceBlock(html, 'top-people', people.map((f) => homeRow(f)).join('\n'));
  html = replaceBlock(html, 'top-themes', themes.map((f) => homeRow(f)).join('\n'));
  html = replaceBlock(html, 'faq', faqBlock('en'));
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
  // waitlist：英文是手寫的 waitlist.html，簡體由它產生（/zh/waitlist）。
  const wl = `<xhtml:link rel="alternate" hreflang="en" href="${WAITLIST}"/><xhtml:link rel="alternate" hreflang="zh-Hans" href="${SITE}${WAITLIST_ZH}"/><xhtml:link rel="alternate" hreflang="x-default" href="${WAITLIST}"/>`;
  urls.push(`  <url><loc>${WAITLIST}</loc><lastmod>${BUILT}</lastmod>${wl}</url>\n  <url><loc>${SITE}${WAITLIST_ZH}</loc><lastmod>${BUILT}</lastmod>${wl}</url>`);
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
- [Compare](${SITE}/compare): ways to buy US stocks with USDT: an exchange, stock tokens bought yourself, a US broker, and CRE8.
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
- Waitlist: ${WAITLIST}
- App (testnet, invite only): ${APP}
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
  const page = (html) => (lang === 'zh' ? withZhSerif(html) : html);
  await out(base + 'portfolios/index.html', page(indexPage(funds, lang)));
  for (const f of funds) await out(`${base}portfolios/${f.key}/index.html`, page(fundPage(f, funds, lang)));
  await out(base + 'how-it-works/index.html', page(howPage(funds, lang)));
  await out(base + 'compare/index.html', page(comparePage(funds, lang)));
}
const indexFile = join(ROOT, 'index.html');
const home = updateHome(await readFile(indexFile, 'utf8'), funds);
await writeFile(indexFile, home);
await out('zh/index.html', await zhHome(home, funds));
await out('zh/waitlist/index.html', await zhWaitlist());
await out('sitemap.xml', sitemap(paths));
await out('llms.txt', llms(funds));
console.log(`OK：${funds.length} 檔基金（asOf ${funds[0]?.asOf}），${paths.length * 2} 個網址寫進 sitemap。`);
