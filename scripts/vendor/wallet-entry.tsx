/**
 * cre8-web app.html 的錢包／登入／交易程式（打包成 assets/vendor/cre8-wallet.js，掛在 window.CRE8W）。
 *
 * 這支檔案在打包時被複製到 cre8-app 原始碼旁邊（`scripts/build-vendor.ts`），所以 `./lib/...`、`./store/...`
 * 指的是 cre8-app 的 src。登入、換 session、簽 UserOp、首次加入、水龍頭、賣出、My mix 都直接用 cre8-app 已上線的程式，
 * 這裡只負責把它們串成 app.html 用得到的幾個動作，並把狀態推給 app.html（它用 React 18.3.1 UMD，沒有 build step）。
 *
 * React：用頁面上的 window.React／window.ReactDOM（18.3.1），Privy 只畫在一個獨立的隱藏節點上，跟 app.html 的畫面不共用元件。
 */
import { createRoot } from 'react-dom/client';
import PrivyRoot from './features/auth/PrivyRoot';
import { usePrivyAuth } from './store/privy';
import { sessionIsLive, useSession } from './store/session';
import { useWallet } from './store/wallet';
import {
  ApiError,
  apiRequest,
  closePosition,
  confirmEnrollment,
  continueRedeem,
  getPortfolioActivity,
  getPortfolioStatus,
  getPortfolios,
  getStrategy,
  getRenewalParams,
  postBuyFunding,
  postFaucetUsdt,
  postFundingLot,
  postGasFaucet,
  postRebalance,
  postRenewalResult,
  postWaitlistJoin,
  postWaitlistRedeem,
  prepareEnrollment,
  redeemPortfolio,
} from './lib/api';
import type { PortfolioStatus, RedeemResult, StrategyDetail } from './lib/api';
import { SponsorshipError, retryMixBusy } from './lib/paymaster';
import { CHAIN, approveCalldata, assertRpcChain, bsc as appChain, publicClientFor, readOnlyClient, sendSudoCalls as kernelSendSudoCalls, sendWithdraw as kernelSendWithdraw, transferCalldata } from './lib/kernel';
import { sendUsdtToMix as mixSendUsdt } from './features/mix/mix-chain';
import type { RenewalWallet } from './lib/kernel';
import { assertShownVersion, waitForAccountCode, waitForPreparation } from './lib/first-enroll';
import { firstEnrollCalls } from './lib/atp-contracts';
import { ensureOwnerGas } from './lib/testnet-wallet-buy';
import { retryWhileBusy } from './lib/portfolio-busy';
import { APPROVALS_PER_USEROP, sendInBatches } from './lib/approval-batches';
import { faucetFailure, faucetSuccess, needsDailyFaucet } from './lib/faucet';
import { MAX_SELL_BATCHES, afterSellRun, runSellBatches, SellBatchError } from './lib/sell-batches';
import { cashUsdOf, sellTargetUsd, totalUsdOf } from './lib/withdraw-plan';
import { withdrawAmountWei } from './lib/format';
import { explainTradeFailure } from './lib/trade-failure';
import { isWaitlistPending, signalWaitlistApproved } from './lib/waitlist-signal';
import { normalizeInviteCode, parseWaitlist } from './lib/waitlist';
import { freshCreationPayload, fundMix, readWalletUsdt, signMix } from './features/mix/mix-chain';
import { createElement } from 'react';
import { createWalletClient, custom, encodeFunctionData, erc20Abi, formatUnits, isAddress, parseUnits } from 'viem';
import type { Address, Hex } from 'viem';

type Step = (text: string) => void;
// 這次動作送出的交易（給結果畫面放 BscScan 連結）：app.html 動作開始前 txReset()，結束後 txs() 拿最後一筆。
const TXS: string[] = [];
const noteTx = (h: unknown): void => { if (typeof h === 'string' && /^0x[0-9a-fA-F]{64}$/.test(h)) TXS.push(h); };
export const txReset = (): void => { TXS.length = 0; };
export const txs = (): string[] => [...TXS];
const sendSudoCalls = async (...a: Parameters<typeof kernelSendSudoCalls>) => { const r = await kernelSendSudoCalls(...a); noteTx(r.txHash); return r; };
const sendWithdraw = async (...a: Parameters<typeof kernelSendWithdraw>) => { const r = await kernelSendWithdraw(...a); noteTx(r.txHash); return r; };
const sendUsdtToMix = async (...a: Parameters<typeof mixSendUsdt>) => { const h = await mixSendUsdt(...a); noteTx(h); return h; };
const USDT = (CHAIN.contracts?.usdt ?? '') as Address;
const INVITE_KEY = 'cre8.waitlist.invite';

// ---- 語言：跟著頁面的 <html lang>（app.html 的「中文／EN」切換會改它）。zh 開頭就回簡體中文。 --------------------------
// 這支檔案自己的句子用 L(英, 中)；從 cre8-app 程式丟出來的英文訊息用 zhMessage 對照翻成中文，認不出來給一句通用的，原文記在 console。
const isZh = (): boolean => typeof document !== 'undefined' && /^zh/i.test(document.documentElement.lang || '');
const L = (en: string, zh: string): string => (isZh() ? zh : en);
const HAS_CJK = /[一-鿿]/;
// explainTradeFailure 的每一類（cre8-app src/lib/trade-failure.ts、a10.ts）→ 中文的「發生了什麼」。
const ZH_TRADE: Record<string, string> = {
  unconfirmed: '交易已提交，但结果还没确认。先别重试，等一分钟后看看余额。',
  'in-flight': '这个组合上一笔交易还在确认，这次没有发出新交易。',
  'settled-earlier': '这个组合上一笔交易刚结算完，这次没有发出新交易。',
  'data-unavailable': '暂时读不到链上数据，为了安全没有交易，资金没动。',
  'price-source': '有资产的价格源过期或跟市场对不上，暂停交易。没有发出交易，资金没动。',
  'quote-refresh': '发出前没能再确认一次价格，交易没有发出，资金没动。',
  'price-moved': '成交前价格变了，交易已取消，持仓没变。',
  approval: '组合还没拿到某个资产的交易授权，没有发出交易。',
  'balance-changed': '准备交易时账户余额变了，没有发出交易。',
  permission: '组合的交易权限缺失或已失效，没有发出交易，资金没动。',
  'asset-disabled': '有资产暂停交易，没有发出交易，资金没动。',
  'trade-limit': '超出单笔交易上限，没有发出交易，资金没动。',
  'no-route': '现在没有能给出安全价格的交易路由，没有发出交易，资金没动。',
  'over-total': '金额超过组合现值，没有发出交易。',
  'too-small': '金额太小，没法交易。',
  'nothing-to-sell': '这个组合已经没有可卖的持仓。',
  busy: '组合正在处理别的操作，这次没有发出交易。',
  'already-done': '这笔交易已经完成，没有重复发出。',
  reverted: '交易上链后被回滚，持仓没变（只花了 gas）。',
  'nothing-to-do': '这次不需要交易。',
  'not-sent': '交易没有发出，资金没动。',
  'platform-paused': '平台暂停交易。资金还在你自己的账户里，随时可以用钱包直接提走。',
  'buy-limit': '今天的买入额度用完了，卖出和提现不受影响。',
  'account-paused': '这个账户暂停交易。',
};
const tradeNote = (f: { kind: string; summary: string }): string => (isZh() ? ZH_TRADE[f.kind] ?? '交易没有完成，资金没动。' : f.summary);
// cre8-app 丟出的英文（開頭比對）→ 中文。
const ZH_MESSAGES: [RegExp, string][] = [
  [/^Your fund account is still being set up/, '组合账户还在创建，没有发出交易。一分钟后再试。'],
  [/^The fund account came back incomplete/, '组合账户信息不完整，没有签名也没有发出。稍后再试。'],
  [/^This fund's settings just changed to version (\d+)/, '这个组合刚更新到第 $1 版。看过新设置后再买一次，刚才没有签名也没有发出。'],
  [/^Couldn’t get the network fee/, '没拿到这笔转账的 gas，没有转出。一分钟后再试。'],
  [/^You have already claimed today’s/, '今天的 1,000 测试 USDT 已经领过，或今天的总量发完了。明天（UTC 00:00 后）再来。'],
  [/^Test USDT (is not available|could not be claimed) right now/, '测试 USDT 暂时领不了，稍后再试。'],
  [/^Sign in again to claim test USDT/, '重新登录后再领测试 USDT。'],
  [/^This fund’s account has received as much test USDT/, '这个组合账户 24 小时内领的测试 USDT 已到上限，稍后再试。'],
  [/^Test USDT can only go to a fund account/, '测试 USDT 只能发到你加入的组合账户。刷新页面后再试。'],
  [/^Test USDT is not set up on this network/, '这个网络还没配测试 USDT，请联系团队。'],
  [/^The test network is busy/, '测试网繁忙，等一分钟再试。'],
  [/^The test USDT transfer did not go through/, '测试 USDT 转账没成功，再试一次。'],
  [/^Too many requests/, '请求太多，等一分钟再试。'],
  [/^The network has not confirmed the test USDT/, '链上还没确认测试 USDT。等一分钟再点一次，已到账的会直接投入。'],
  [/^Cannot reach the backend/, '连不上服务器，检查网络后再试。'],
  [/^This wallet does not control the fund/, '这个钱包控制不了这个组合账户。'],
  [/^Could not check the transaction/, '暂时查不到交易状态，稍后再试。'],
  [/reverted/i, '交易上链后被回滚，再试一次。'],
  [/^(\d+) assets? (is|are) approved; (\d+) still need approval/, '已授权 $1 个资产，还有 $3 个要授权。再点一次按钮完成。'],
  [/no USDT on this chain/, '这条链上没有 USDT。'],
  [/user (rejected|denied|cancel)|rejected the request|denied/i, '你在钱包里取消了。'],
  // 只有真的連不上／逾時才說網路問題。代付等後端拒絕用錯誤碼對照（ZH_CODES），不靠字面（英文句子裡有 “network fee”）。
  [/^(Failed to fetch|Load failed|NetworkError when attempting to fetch|fetch failed)|\btimed out\b|\btimeout\b|took too long to respond/i, '网络出问题了，再试一次。'],
  [/^NO_WALLET$/, '钱包还在创建，稍后再试。'],
  // My mix 簽名前核對（cre8-app mix-chain.ts 的 MixPayloadError）：說清楚是哪一類，沒簽名、錢沒動。
  [/^signing payload: (approve\.to|enroll\.strategy assets)/, '组合里有暂时不支持的资产，没有签名，钱没动。换一个资产再试。'],
  [/^signing payload: enroll\.strategy unreadable/, '链上还没读到你的组合，等几秒再试一次。'],
  [/^signing payload: enroll\.strategy picks/, '链上的比例和你选的不一样，没有签名。刷新页面后再建一次。'],
  [/^signing payload/, '组合资料核对没通过，没有签名，钱没动。再试一次。'],
  [/^Account was not deployed|account code/i, '组合账户还在创建，等几秒再试一次。'],
];
// 英文時 cre8-app 的核對錯誤也換成一句白話（原文記在 console）。
const EN_MESSAGES: [RegExp, string][] = [
  [/^signing payload: (approve\.to|enroll\.strategy assets)/, 'Your basket has an asset we can’t sign for yet. Nothing was signed or moved. Try a different asset.'],
  [/^signing payload: enroll\.strategy unreadable/, 'Your basket isn’t on chain yet. Wait a few seconds and try again.'],
  [/^signing payload: enroll\.strategy picks/, 'The weights on chain don’t match your picks. Nothing was signed. Refresh and build it again.'],
  [/^signing payload/, 'Your basket didn’t pass our checks. Nothing was signed or moved. Try again.'],
];
// 後端／代付的錯誤碼 → 一句白話（後端原文是繁中、偏工程用語，不上畫面）。SponsorshipError 與 ApiError 都帶 code。
const ZH_CODES: Record<string, string> = {
  MIX_BUSY: '组合正在处理上一笔交易，等几秒再试一次。钱没动。',
  PORTFOLIO_BUSY: '组合正在处理别的操作，等一下再试。钱没动。',
  PAYMASTER_CALL_FORBIDDEN: '这个操作暂时不能由平台代付手续费，没有发出，钱没动。',
  PAYMASTER_QUOTA_EXCEEDED: '今天的免费手续费额度用完了，明天再试。钱没动。',
  GAS_BUDGET_EXCEEDED: '今天的免费手续费额度用完了，明天再试。钱没动。',
  PAYMASTER_DEPOSIT_INSUFFICIENT: '平台的手续费余额不够了，我们会尽快补上。没有发出，钱没动。',
  PAYMASTER_ACCOUNT_UNDEPLOYED: '组合账户还在创建，等几秒再试一次。',
  PAYMASTER_SENDER_FORBIDDEN: '这个账户不属于现在登录的钱包，没有发出，钱没动。',
  PAYMASTER_EXPIRED: '手续费授权过期了，没有发出。再试一次。',
  PAYMASTER_RETRY_TOO_SOON: '上一笔还在处理，等一分钟再试。钱没动。',
  PAYMASTER_WITHDRAW_RESERVED: '这部分 USDT 留给还在进行的买入，现在不能领回。钱没动。',
  NETWORK: '网络出问题了，再试一次。',
};
const EN_CODES: Record<string, string> = {
  MIX_BUSY: 'This basket is finishing another transaction. Nothing was sent. Wait a few seconds, then try again.',
  PORTFOLIO_BUSY: 'This portfolio is busy with another step. Nothing was sent. Try again in a moment.',
  PAYMASTER_WITHDRAW_RESERVED: 'That USDT is set aside for a buy that is still in progress, so it can’t come out yet. Nothing was sent.',
};
const errorCode = (cause: unknown): string | null => (cause instanceof SponsorshipError || cause instanceof ApiError ? cause.code : null);
function zhForCode(code: string | null): string | null {
  if (code === null) return null;
  if (ZH_CODES[code]) return ZH_CODES[code];
  if (/^PAYMASTER_(ACCOUNT_|FACTORY_)/.test(code)) return '这个账户还不能由平台代付手续费，没有发出，钱没动。';
  if (/^(PAYMASTER|GAS_BUDGET)_/.test(code)) return '平台这次没能代付手续费，没有发出，钱没动。稍后再试。';
  return null;
}
function zhMessage(message: string, fallback = '没有完成，再试一次。'): string {
  if (HAS_CJK.test(message)) return message;
  for (const [re, zh] of ZH_MESSAGES) {
    const m = message.match(re);
    if (m) return zh.replace(/\$(\d)/g, (_, i: string) => m[Number(i)] ?? '');
  }
  console.warn('[cre8-wallet] untranslated message:', message);
  return fallback;
}
/** 對外的動作：中文時把丟出來的錯誤換成中文（英文時原樣）。 */
function localized<A extends unknown[], R>(fn: (...args: A) => Promise<R>, fallback?: string): (...args: A) => Promise<R> {
  return async (...args: A) => {
    try { return await fn(...args); } catch (cause) {
      const msg = cause instanceof Error ? cause.message : String(cause), code = errorCode(cause);
      // 原文一律記在 console（畫面上只給白話）。
      console.warn('[cre8-wallet]', code ?? '', msg);
      if (!isZh()) {
        const en = EN_MESSAGES.find(([re]) => re.test(msg));
        if (en) throw new Error(en[1]);
        if (code && EN_CODES[code]) throw new Error(EN_CODES[code]);
        // 後端原文是中文：英文介面不能出現中文。
        if (cause instanceof ApiError && HAS_CJK.test(msg)) throw new Error((code && EN_CODES[code]) ?? 'That didn’t finish. Try again.');
        throw cause;
      }
      const byCode = zhForCode(code);
      if (byCode) throw new Error(byCode);
      // 認不出的後端錯誤碼：原文是繁中，不上畫面。
      if (cause instanceof ApiError && HAS_CJK.test(msg)) throw new Error(fallback ?? '没有完成，再试一次。');
      throw new Error(zhMessage(msg, fallback));
    }
  };
}
const zhAuth = (m: string | null): string | null => (m === null || !isZh() ? m : /code/i.test(m) && /invalid|incorrect|wrong/i.test(m) ? '验证码不对，重新输入。' : /exit|cancel|closed/i.test(m) ? '登录已取消。' : /rate|too many/i.test(m) ? '尝试太多次，稍后再试。' : zhMessage(m, '登录没完成，再试一次。'));

// ---- 狀態：Privy＋CRE8 session＋錢包 → 一個給 app.html 的快照 ---------------------------------------
type Waitlist = { state: 'idle' | 'checking' | 'waiting' | 'approved' | 'error'; message: string | null };
let waitlist: Waitlist = { state: 'idle', message: null };
const listeners = new Set<(s: Snapshot) => void>();

export type Snapshot = ReturnType<typeof snapshot>;
function snapshot() {
  const p = usePrivyAuth.getState();
  const s = useSession.getState();
  const live = s.via === 'privy' && sessionIsLive(s);
  const err = p.error as { message?: string; code?: string } | null;
  return {
    phase: p.phase, // loading | signed-out | creating-wallet | exchanging | signed-in | error | unavailable
    signedIn: live,
    address: live ? s.address : null,
    token: live ? s.token : null,
    signer: p.signer, // 錢包能不能簽（checking | ready | missing）
    profile: p.profile, // { name, handle, avatarUrl }
    methods: p.methods, // [{ kind: email|google|x|wallet, detail }]
    ownerEmbedded: p.ownerEmbedded,
    emailStep: p.emailStep,
    emailError: zhAuth(p.emailError ? String((p.emailError as Error).message ?? p.emailError) : null),
    error: p.phase === 'error' && err ? (err.code ?? null) : null,
    errorText: zhAuth(p.phase === 'error' && err ? String(err.message ?? err) : null),
    oauthError: zhAuth(p.oauthError ? String((p.oauthError as Error).message ?? p.oauthError) : null),
    linkError: p.linkError && isZh() ? (/already|linked|another|exists/i.test(String(p.linkError)) ? '这个账号已经绑定在别的用户上。' : zhMessage(String(p.linkError), '绑定没成功，再试一次。')) : p.linkError,
    hasX: p.methods.some((m) => m.kind === 'x'),
    /** 登入了 Privy，但還沒放行（後端 403 WAITLIST_PENDING）：入口頁顯示邀請碼輸入框。 */
    pending: p.phase === 'error' && isWaitlistPending(p.error),
    identityReady: p.identityToken !== null,
    waitlist,
  };
}
let last: Snapshot | null = null;
function emit(): void {
  last = snapshot();
  listeners.forEach((fn) => { try { fn(last as Snapshot); } catch { /* 畫面那邊的錯誤不影響這裡 */ } });
}

// 後端回 403 WAITLIST_PENDING：有邀請碼就用碼放行（/waitlist/redeem），沒有就排隊（/waitlist/join）。放行後讓 PrivyRoot 重換 session。
let waitlistFor: string | null = null;
/** waitlist 頁自己控制「追蹤後才加入」：manual 時不自動 join／redeem。 */
let manualWaitlist = false;
async function handleWaitlist(): Promise<void> {
  if (manualWaitlist) return;
  const p = usePrivyAuth.getState();
  if (p.phase !== 'error' || !isWaitlistPending(p.error) || p.identityToken === null) return;
  if (waitlistFor === p.identityToken) return;
  waitlistFor = p.identityToken;
  waitlist = { state: 'checking', message: null }; emit();
  let code: string | null = null;
  try { code = sessionStorage.getItem(INVITE_KEY); } catch { /* 無痕 */ }
  try {
    let body: unknown;
    if (code !== null) {
      try {
        body = await postWaitlistRedeem(p.identityToken, code);
        try { sessionStorage.removeItem(INVITE_KEY); } catch { /* */ }
      } catch (cause) {
        try { sessionStorage.removeItem(INVITE_KEY); } catch { /* */ }
        if (!(cause instanceof ApiError)) throw cause;
        if (cause.code === 'X_REQUIRED') { waitlist = { state: 'error', message: L('Right now invite codes only work with X. Sign out and continue with X.', '邀请码目前只能配合 X 登录。退出后用 X 登录。') }; emit(); return; }
        // 碼不能用（錯、用過、過期）：照一般排隊，並說明。
        body = await postWaitlistJoin(p.identityToken);
        const r = parseWaitlist(body);
        waitlist = { state: r?.status === 'approved' ? 'approved' : 'waiting', message: cause.code === 'ALREADY_APPROVED' ? null : L('That invite code didn’t work, so you joined the waitlist instead.', '邀请码用不了，已帮你加入等候名单。') };
        if (r?.status === 'approved') signalWaitlistApproved();
        emit(); return;
      }
    } else {
      body = await postWaitlistJoin(p.identityToken);
    }
    const record = parseWaitlist(body);
    waitlist = { state: record?.status === 'approved' ? 'approved' : 'waiting', message: null };
    if (record?.status === 'approved') signalWaitlistApproved();
  } catch (cause) {
    const code409 = cause instanceof ApiError ? cause.code : '';
    waitlist = { state: 'error', message: code409 === 'X_REQUIRED' ? L('CRE8 is invite-only. Sign in with X and enter your invite code.', 'CRE8 凭邀请码进入。用 X 登录并输入邀请码。') : isZh() ? zhMessage((cause as Error).message) : (cause as Error).message };
  }
  emit();
}

let mounted = false;
export function mount(options: { waitlist?: 'auto' | 'manual' } = {}): void {
  manualWaitlist = options.waitlist === 'manual';
  if (mounted) return;
  mounted = true;
  const host = document.createElement('div');
  host.id = 'cre8-privy';
  document.body.appendChild(host);
  createRoot(host).render(createElement(PrivyRoot));
  usePrivyAuth.subscribe(() => { emit(); void handleWaitlist(); });
  useSession.subscribe(emit);
  useWallet.subscribe(emit);
  closeWalletReceipts();
  emit();
}

// Privy 錢包送出交易後會多一頁「Transaction complete! … All Done」：app.html 自己會顯示結果，這頁一出現就幫用戶關掉，
// 不用多按一次（錢包的確認頁照常顯示）。Privy 沒有只關掉成功頁的設定，所以從畫面上找那顆按鈕。
function closeWalletReceipts(): void {
  const check = () => {
    const box = document.getElementById('privy-modal-content');
    if (box === null) return;
    for (const b of box.querySelectorAll('button')) if (b.textContent?.trim() === 'All Done') { b.click(); return; }
  };
  new MutationObserver(check).observe(document.body, { childList: true, subtree: true });
}

export function subscribe(fn: (s: Snapshot) => void): () => void {
  listeners.add(fn);
  fn(last ?? snapshot());
  return () => listeners.delete(fn);
}
export const get = (): Snapshot => last ?? snapshot();

// ---- 登入與帳號 ----------------------------------------------------------------------------
const actions = () => {
  const a = usePrivyAuth.getState().actions;
  if (a === null) throw new Error(L('Sign-in is still loading. Try again in a moment.', '登录组件还在加载，稍后再试。'));
  return a;
};
/** 先記下邀請碼（連 X 會整頁轉走再回來），格式不對回 false。空字串＝清掉。 */
export function setInvite(text: string): boolean {
  if (text.trim() === '') { try { sessionStorage.removeItem(INVITE_KEY); } catch { /* */ } return true; }
  const code = normalizeInviteCode(text);
  if (code === null) return false;
  try { sessionStorage.setItem(INVITE_KEY, code); } catch { /* */ }
  return true;
}
export const signInWith = (provider: 'twitter' | 'google') => actions().loginWithOAuth(provider);
export const sendEmailCode = (email: string) => actions().sendEmailCode(email);
export const submitEmailCode = (code: string) => actions().submitEmailCode(code);
export const signInWallet = () => actions().loginWithWallet();
export const retry = () => { waitlistFor = null; waitlist = { state: 'idle', message: null }; actions().retry(); };
export const logout = async () => { waitlistFor = null; waitlist = { state: 'idle', message: null }; await actions().logout(); };
export const link = (kind: 'email' | 'google' | 'x') => actions().link(kind);
export const exportWallet = () => actions().exportWallet();

function need(): { token: string; wallet: RenewalWallet; owner: Address } {
  const s = get();
  if (!s.signedIn || s.token === null || s.address === null) throw new Error(L('Sign in first.', '请先登录。'));
  const w = useWallet.getState();
  if (w.kind !== 'injected' || w.provider === null || w.address === null || w.address.toLowerCase() !== s.address.toLowerCase()) {
    throw new Error(L('Your wallet is still connecting. Try again in a moment.', '钱包还在连接，稍后再试。'));
  }
  return { token: s.token, wallet: { kind: 'injected', address: w.address as Address, provider: w.provider }, owner: w.address as Address };
}

// ---- Waitlist 頁（cre8.finance/waitlist）：用 Privy identity token，不需要 CRE8 session --------------------
const identityToken = () => usePrivyAuth.getState().identityToken;
/** 自己的排隊紀錄（`GET /waitlist/me`）；還沒加入回 null。 */
export async function waitlistMe() {
  const t = identityToken();
  if (t === null) return null;
  try {
    return parseWaitlist(await apiRequest<unknown>('/waitlist/me', { headers: { authorization: `Bearer ${t}` } }));
  } catch (cause) {
    if (cause instanceof ApiError && cause.status === 404) return null;
    throw cause;
  }
}
/**
 * 登入後用邀請碼放行（`POST /waitlist/redeem`）。成功（或本來就放行）就讓 PrivyRoot 重換 session，入口頁自己會進 app。
 * 失敗丟一句白話（碼錯、用過、過期、要 X）。
 */
export async function redeemInvite(text: string) {
  const code = normalizeInviteCode(text);
  if (code === null) throw new Error(L('That code isn’t valid.', '邀请码无效。'));
  const t = identityToken();
  if (t === null) throw new Error(L('Sign in first.', '请先登录。'));
  try {
    const record = parseWaitlist(await postWaitlistRedeem(t, code));
    if (record?.status === 'approved') signalWaitlistApproved();
    return record;
  } catch (cause) {
    if (!(cause instanceof ApiError)) throw cause;
    if (cause.code === 'ALREADY_APPROVED') { signalWaitlistApproved(); return { status: 'approved' as const, xHandle: null, joinedAt: null }; }
    const msg: Record<string, string> = { INVITE_INVALID: L('That code isn’t valid.', '邀请码无效。'), INVITE_USED: L('That code was already used.', '邀请码已被用过。'), INVITE_EXPIRED: L('That code has expired.', '邀请码已过期。'), X_REQUIRED: L('Invite codes only work with X for now.', '邀请码目前只能配合 X 登录。') };
    throw new Error(msg[cause.code] ?? (cause.status === 429 ? L('Too many tries. Wait a minute.', '试太多次了，等一分钟。') : L('Couldn’t check the code. Try again.', '暂时验证不了邀请码，再试一次。')));
  }
}
/** 加入（`POST /waitlist/join`，冪等）。已放行就讓 PrivyRoot 重換 session。 */
export async function joinWaitlist() {
  const t = identityToken();
  if (t === null) throw new Error(L('Connect X first.', '先连接 X。'));
  const record = parseWaitlist(await postWaitlistJoin(t));
  if (record?.status === 'approved') signalWaitlistApproved();
  return record;
}

/**
 * 等候名單加分任務（`GET /waitlist/tasks`、`POST /waitlist/tasks/:id`，用 Privy identity token）。
 * 後端還沒上這組端點時 GET 回 404 → 傳回 null，頁面就把任務按鈕停用，不假裝完成。
 */
export async function waitlistTasks() {
  const t = identityToken();
  if (t === null) return null;
  try {
    return await apiRequest<unknown>('/waitlist/tasks', { headers: { authorization: `Bearer ${t}` } });
  } catch (cause) {
    if (cause instanceof ApiError && cause.status === 404) return null;
    throw cause;
  }
}
export async function completeWaitlistTask(id: 'post' | 'gmail' | 'quiz' | 'tg', body: Record<string, unknown> = {}) {
  const t = identityToken();
  if (t === null) throw new Error(L('Connect X first.', '先连接 X。'));
  try {
    return await apiRequest<unknown>(`/waitlist/tasks/${id}`, { method: 'POST', headers: { authorization: `Bearer ${t}`, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  } catch (cause) {
    if (!(cause instanceof ApiError)) throw cause;
    const msg: Record<string, string> = { TASK_INVALID_URL: L('That isn’t a post from your X account.', '这不是你 X 账号发的帖子。'), TASK_NOT_LINKED: L('Connect Google first.', '先连接 Google。'), NOT_JOINED: L('Join the waitlist first.', '先加入等候名单。') };
    throw new Error(msg[cause.code] ?? (cause.status === 429 ? L('Too many tries. Wait a minute.', '试太多次了，等一分钟。') : L('Couldn’t save that. Try again.', '没保存上，再试一次。')));
  }
}

// ---- 讀資料 ----------------------------------------------------------------------------------
const token = () => { const t = get().token; if (t === null) throw new Error(L('Sign in first.', '请先登录。')); return t; };
export const portfolios = () => getPortfolios(token());
export const status = (id: number) => getPortfolioStatus(token(), id);
export const activity = (id: number) => getPortfolioActivity(token(), id);
/** 錢包 USDT（wei 字串）；讀不到回 null（畫面顯示 —，不顯示 0）。 */
export async function walletUsdt(owner?: string): Promise<string | null> {
  const a = owner ?? get().address;
  if (!a) return null;
  const v = await readWalletUsdt(a);
  return v === null ? null : v.toString();
}

// ---- 買 --------------------------------------------------------------------------------------
async function sendUsdt(wallet: RenewalWallet, to: Address, value: bigint): Promise<Hex> {
  await assertRpcChain();
  if (wallet.kind !== 'injected') throw new Error('wallet');
  const data = encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [to, value] });
  const hash = await createWalletClient({ account: wallet.address, chain: appChain, transport: custom(wallet.provider as never) }).sendTransaction({ to: USDT, data, chain: appChain });
  noteTx(hash); return hash;
}

/** 第一次買：後端先部署帳戶 → owner 簽 enroll＋approve → 後端確認建投組（cre8-app FundPage `deposit`）。 */
type Holding = Awaited<ReturnType<typeof getPortfolios>>[number];
async function ensurePortfolio(args: { token: string; wallet: RenewalWallet; strategyId: number; onchainId: number; shown: { version: number; configHash: string } | null; step: Step }): Promise<{ portfolio: Holding; approved: readonly Address[] }> {
  const list = await getPortfolios(args.token);
  const existing = list.find((p) => p.strategyId === args.strategyId && p.smartAccounts[0]?.address);
  if (existing) return { portfolio: existing, approved: [] };
  args.step(L('Setting up your account', '正在开通账户'));
  const registry = CHAIN.contracts?.registry as Address, executor = CHAIN.contracts?.executor as Address;
  // 同時讀這檔的資產（買入提速）：加入那一筆順便授權，不用加入後再簽一次。讀不到就照舊，加入後由 allocate 授權。
  const strategy = getStrategy(args.token, args.strategyId).catch(() => null);
  const prepared = await waitForPreparation(() => apiPrepare(args.token, args.strategyId));
  if (args.shown !== null) assertShownVersion(args.shown, prepared);
  await waitForAccountCode((address) => readOnlyClient().getCode({ address }), prepared.account, { attempts: 40, delayMs: 500 });
  const calls = await firstEnrollCalls(readOnlyClient(), { registry, executor, usdt: USDT, account: prepared.account, id: BigInt(args.onchainId), expectedVersion: prepared.expectedVersion, configHash: prepared.configHash });
  let approved: readonly Address[] = [];
  if (calls !== null) {
    args.step(L('Approve in your wallet to join this portfolio', '在钱包里确认，加入这个组合'));
    const assets = enrollApprovals(await Promise.race([strategy, sleep(3_000).then(() => null)]), prepared.expectedVersion, calls.length);
    const join = (more: readonly Address[]) => sendSudoCalls({ wallet: args.wallet, token: args.token, accountAddress: prepared.account, strategyId: args.strategyId,
      calls: [...calls, ...more.map((asset) => ({ to: asset, data: approveCalldata(executor), value: 0n }))] });
    let joined: Awaited<ReturnType<typeof join>>;
    try {
      joined = await join(assets);
      approved = assets;
    } catch (cause) {
      // 代付不收合併的那一筆（後端還沒上線 backend#221）：在簽名前就被拒，退回原本只送 enroll＋USDT 授權。
      if (assets.length === 0 || !(cause instanceof SponsorshipError)) throw cause;
      joined = await join([]);
    }
    if (!joined.success) throw new Error(L(`Joining landed on-chain but reverted (${joined.txHash}). Nothing was transferred.`, `加入组合的交易上链后被回滚（${joined.txHash}），资金没有转出。`));
  }
  return { portfolio: await confirmEnrollment(args.token, args.strategyId), approved };
}
const apiPrepare = (t: string, strategyId: number) => prepareEnrollment(t, strategyId);

/** 加入那一筆要順便授權的資產：這一版的配置（不含 USDT，它在 enroll calls 裡），每個一次，整筆不超過一個 UserOp 的上限。 */
function enrollApprovals(strategy: StrategyDetail | null, version: number, used: number): Address[] {
  const out: Address[] = [];
  for (const row of strategy?.versions?.find((v) => v.version === version)?.allocation?.assets ?? []) {
    const address = row?.address;
    if (typeof address !== 'string' || !isAddress(address) || address.toLowerCase() === USDT.toLowerCase() || out.some((a) => a.toLowerCase() === address.toLowerCase())) continue;
    out.push(address as Address);
  }
  return out.slice(0, Math.max(0, APPROVALS_PER_USEROP - used));
}

/** allocate 要的：executor、這檔的資產、還沒授權給 executor 的資產。讀不到狀態回 null。 */
type ApprovalState = { executor: Address | null; universe: Address[]; missing: Address[] };
async function readApprovalState(token: string, portfolioId: number, account: Address): Promise<ApprovalState | null> {
  const fresh = await getPortfolioStatus(token, portfolioId).catch(() => null);
  if (fresh === null) return null;
  const executor = (fresh.executorAddress ?? null) as Address | null;
  const universe = (fresh.drift?.assets ?? []).map((row) => row.asset as Address);
  if (!executor || universe.length === 0) return { executor, universe, missing: [] };
  const missing = (await Promise.all(universe.map(async (asset) => {
    const allowance = await readOnlyClient().readContract({ address: asset, abi: erc20Abi, functionName: 'allowance', args: [account, executor] }).catch(() => 0n);
    return allowance > 0n ? null : asset;
  }))).filter((asset) => asset !== null);
  return { executor, universe, missing };
}

/** 投入後：沒授權過的資產一次 approve 給 executor（owner 簽），然後請後端跑一輪配置。美股收盤時不會成交，排程會在開盤後買。 */
type SudoCall = { to: Address; data: Hex; value: bigint };
/**
 * 這一輪被擋只是因為排程器正在處理別的基金（共用市場 [DEX_QUEUED]）或這一檔（[PORTFOLIO_LOCK_BUSY]）：
 * 什麼都沒送，等幾秒用同一個請求再問（2026-11-23 實測第一次買入、賣出都撞到）。其他結果照原樣回。
 */
const SCHEDULER_BUSY = /^\[(DEX_QUEUED|PORTFOLIO_LOCK_BUSY)\]/;
/**
 * 多檔股票的賣出一輪（等通道＋報價＋送出＋收據）可能超過前面代理的 30 秒，前端拿到 504，後端其實已經賣了
 * （2026-11-23 Mag7 賣出 0xa980629f…）。這時看這一檔的交易紀錄：開始之後有新的一輪成交就照成交繼續（領回 USDT）。
 */
async function roundOrLanded(t: string, portfolioId: number, run: () => Promise<RedeemResult>): Promise<RedeemResult> {
  const started = Date.now() - 5_000;
  try { return await run(); }
  catch (cause) {
    if (!(cause instanceof ApiError) || cause.status !== 504) throw cause;
    for (let i = 0; i < 12; i++) {
      await sleep(5_000);
      const rows = (await getPortfolioActivity(t, portfolioId).catch(() => ({ activity: [] }))).activity;
      const landed = rows.find((a) => Date.parse(a.createdAt) >= started && a.state === 'confirmed');
      if (landed) return { portfolioId, outcome: 'executed', reason: '', txHash: landed.txHash, steps: [], redeemedUsdE8: '0', remainingUsdE8: '0' };
    }
    throw cause;
  }
}
/**
 * 開著加息策略時賣出：那一輪先替被抵押的股票還款、取回（backend#204 [STRATEGY_EARN_UNWINDING]，已上鏈），股票下一輪才賣。
 * 2026-11-24 live：第一次按賣出畫面寫「没送出」，其實還款取回已完成，要再按一次。這裡在同一次點擊裡接著再跑那一輪（最多 3 次），
 * 畫面顯示「正在结清加息策略，然后卖出」，直到真的賣出或遇到別的原因。
 */
const UNWOUND = /^\[STRATEGY_EARN_UNWINDING\] 賣出前已還款取回/;
async function sellAfterUnwind(run: () => Promise<RedeemResult>, step: Step): Promise<RedeemResult> {
  for (let i = 0; ; i++) {
    const r = await run();
    if (r.outcome !== 'blocked' || !UNWOUND.test(r.reason) || i >= 3) return r;
    step(L('Settling the yield strategy, then selling', '正在结清加息策略，然后卖出'));
    await sleep(3_000);
  }
}
// 後端讓使用者的那一輪優先等通道（backend#244），沒等到就很快再問一次，讓排程器在下一個投組前看到我們在等。
async function retryBusyRound<T extends { outcome: string; reason: string }>(run: () => Promise<T>, delaysMs: readonly number[] = [1_000, 1_000, 2_000, 2_000, 3_000, 3_000]): Promise<T> {
  for (let i = 0; ; i++) {
    const r = await run();
    const delay = delaysMs[i];
    if (r.outcome !== 'blocked' || !SCHEDULER_BUSY.test(r.reason) || delay === undefined) return r;
    await sleep(delay);
  }
}
async function allocate(args: { token: string; wallet: RenewalWallet; account: Address; strategyId: number; portfolioId: number; step: Step; extra?: SudoCall[];
  /** 買入提速：轉帳／領 USDT 的同時先讀好的授權狀態；讀不到或還沒有資產清單就在這裡重讀。 */
  prefetched?: Promise<ApprovalState | null>;
  /** 剛在加入那一筆授權過的資產（RPC 可能還沒看到，不再要一次）。 */
  approved?: readonly Address[] }) {
  let state = args.prefetched === undefined ? null : await args.prefetched;
  if (state === null || !state.executor || state.universe.length === 0) state = await readApprovalState(args.token, args.portfolioId, args.account);
  const executor = state?.executor ?? null;
  const justApproved = new Set((args.approved ?? []).map((a) => a.toLowerCase()));
  // 策略加息的同意 calls（`extra`）接在授權後面，同一個 UserOp 一起簽；超過代付上限（32 個 call）才分開送。
  let extra = args.extra ?? [], earnSent = false;
  const send = (calls: SudoCall[]) => sendSudoCalls({ wallet: args.wallet, token: args.token, accountAddress: args.account, strategyId: args.strategyId, calls });
  if (executor && state !== null && state.universe.length > 0) {
    const missing = state.missing.filter((asset) => !justApproved.has(asset.toLowerCase()));
    if (missing.length > 0) {
      args.step(L('Approve in your wallet so we can buy the assets', '在钱包里授权，才能买入资产'));
      const approvals = missing.map((asset) => ({ to: asset, data: approveCalldata(executor), value: 0n }));
      let together = false;
      if (extra.length > 0 && approvals.length + extra.length <= APPROVALS_PER_USEROP) {
        // 合在一起失敗（例如加息那段被拒）時，不讓買入卡住：退回只送授權，加息這次不開。
        try { together = (await send([...approvals, ...extra])).success; } catch { together = false; }
        if (together) { earnSent = true; extra = []; } else extra = [];
      }
      if (!together) {
        await sendInBatches(missing, (batch) => send(batch.map((asset) => ({ to: asset, data: approveCalldata(executor), value: 0n }))));
      }
    }
  }
  if (extra.length > 0) {
    args.step(L('Approve in your wallet to turn on Earn extra', '在钱包里确认，开启加息'));
    try { earnSent = (await send(extra)).success; } catch { earnSent = false; }
  }
  args.step(L('Placing your order', '正在下单'));
  try {
    const round = await retryBusyRound(() => postRebalance(args.token, args.portfolioId)).catch((cause) => {
      // 下單那一輪超過代理的 30 秒：錢已進組合，後端或排程器會買完，當成排隊中。
      if (cause instanceof ApiError && cause.status === 504) return { outcome: 'blocked', reason: '[DEX_QUEUED] upstream timeout', txHash: null } as Awaited<ReturnType<typeof postRebalance>>;
      throw cause;
    });
    if (round.outcome === 'executed') { noteTx(round.txHash); return { filled: true, note: null, txHash: round.txHash, earnSent }; }
    // 排程器還在處理別的基金（重問後仍在排隊）：錢已進組合，排程器幾分鐘內會自己買，不是「沒送出」。
    if (round.outcome === 'blocked' && SCHEDULER_BUSY.test(round.reason)) {
      return { filled: false, note: L('Your USDT is in this portfolio. The buy is queued and will go through on its own in a few minutes.', '钱已经进了组合，买入在排队，几分钟内会自动完成。'), txHash: null, earnSent };
    }
    const f = explainTradeFailure(round);
    return { filled: false, note: f.kind === 'nothing-to-do' ? null : tradeNote(f), txHash: null, earnSent };
  } catch (cause) {
    return { filled: false, note: isZh() ? zhMessage((cause as Error).message, '下单没成功，资金已在你的组合账户里，稍后会自动买入。') : (cause as Error).message, txHash: null, earnSent };
  }
}

/**
 * 買一檔基金。`pay`：'wallet'＝從錢包轉 USDT（金額 `amount`）；'faucet'＝測試網免費 USDT（第一次 10,000，之後每天 1,000，直接進這檔）。
 * 回 `{ filled }`：true＝這一輪就成交；false＝錢已進帳戶、等排程成交（美股開盤時段）。`pending`＝測試 USDT 還在路上。
 */
export const buy = localized(buyRaw, '买入没完成，再试一次。');
async function buyRaw(args: { strategyId: number; onchainId: number; shown?: { version: number; configHash: string } | null; amount?: string; pay: 'wallet' | 'faucet'; earnExtra?: boolean; onStep?: Step }) {
  const step = args.onStep ?? (() => {});
  const { token: t, wallet, owner } = need();
  const busy = { onBusy: () => step(L('Setting up your account', '正在开通账户')) };
  // 買入提速：錢包付款要的 gas 跟開帳戶互不相干，同時跑（失敗一樣在轉帳前丟出）。
  const reader = publicClientFor(wallet);
  const walletAmount = args.pay === 'wallet' ? (() => { try { return parseUnits(args.amount ?? '0', 18); } catch { return 0n; } })() : 0n;
  const gas = walletAmount > 0n ? ensureOwnerGas({
    readBalance: () => reader.getBalance({ address: owner }),
    requestGas: () => postGasFaucet(t),
    waitForTx: async (h) => { await reader.waitForTransactionReceipt({ hash: h as Hex, confirmations: 1, timeout: 30_000 }); },
  }) : null;
  gas?.catch(() => undefined);
  const { portfolio, approved } = await ensurePortfolio({ token: t, wallet, strategyId: args.strategyId, onchainId: args.onchainId, shown: args.shown ?? null, step });
  const account = portfolio.smartAccounts[0]?.address as Address | undefined;
  if (!account) throw new Error(L('The server returned no account for this portfolio.', '服务器没有返回这个组合的账户。'));
  // 買入提速：授權狀態（投組狀態＋每個資產的 allowance）跟入金無關，入金的同時先讀。
  const prefetched = readApprovalState(t, portfolio.id, account).catch(() => null);
  let amountWei = 0n;
  if (args.pay === 'wallet') {
    amountWei = parseUnits(args.amount ?? '0', 18);
    if (amountWei <= 0n) throw new Error(L('Enter an amount.', '请输入金额。'));
    step(L('Getting the network fee', '正在准备 gas'));
    await gas;
    step(L('Approve the USDT transfer in your wallet', '在钱包里确认 USDT 转账'));
    const hash = await sendUsdt(wallet, account, amountWei);
    step(L('Waiting for the network', '等待链上确认'));
    const receipt = await reader.waitForTransactionReceipt({ hash, confirmations: 2, timeout: 60_000 });
    if (receipt.status !== 'success') throw new Error(L(`The transfer was rejected by the network (${hash}).`, `转账被链上拒绝（${hash}）。`));
    await retryWhileBusy(() => postFundingLot(t, portfolio.id, { kind: 'wallet_transfer', txHash: hash }), busy);
  } else {
    step(L('Getting your test USDT', '正在领取测试 USDT'));
    let welcome = null as Awaited<ReturnType<typeof postBuyFunding>> | null;
    try {
      welcome = await retryWhileBusy(() => postBuyFunding(t, portfolio.id), busy);
    } catch (cause) {
      if (!needsDailyFaucet(cause)) throw cause;
    }
    if (welcome?.state === 'pending') return { filled: false, pending: true, portfolioId: portfolio.id, amountUsdt: '10000', note: L('Your 10,000 test USDT is on its way. Press Buy again in a minute to finish.', '10,000 测试 USDT 正在路上，一分钟后再点一次“买入”就好。') };
    if (welcome !== null && welcome.funding === 'welcome_grant') {
      amountWei = parseUnits('10000', 18);
    } else {
      let body;
      try { body = await postFaucetUsdt(t, account); } catch (cause) { throw new Error(faucetFailure(cause).message); }
      const claimed = faucetSuccess(body);
      if (claimed.txHash) await readOnlyClient().waitForTransactionReceipt({ hash: claimed.txHash as Hex, confirmations: 2, timeout: 60_000 }).catch(() => undefined);
      if (typeof body.claimId !== 'string') throw new Error(faucetFailure(null).message);
      const claimId = body.claimId;
      await retryWhileBusy(() => postFundingLot(t, portfolio.id, { kind: 'faucet_claim', claimId }), busy);
      amountWei = BigInt(body.amountWei ?? parseUnits('1000', 18));
    }
  }
  // 確認卡打開了加息（backend#204）：拿這次投入的同意 calls，接在買入的 UserOp 後一起簽；session key 還沒有加息權限就連 renewal 一起裝。
  // 美股還沒成交也沒關係：同意之後由排程在成交後自動抵押、借款。拿不到 calls 不擋買入，只回 earnExtra: 'unavailable'。
  let extra: SudoCall[] = [], renewal: Awaited<ReturnType<typeof getRenewalParams>> | null = null, earnExtra: 'on' | 'unavailable' | null = null;
  if (args.earnExtra) {
    try {
      const a = await earnApi<{ status: string; authorization?: string; calls?: EarnCall[] }>(`/portfolios/${portfolio.id}/strategy-earn/auto`, { method: 'POST', body: { budgetRaw: amountWei.toString() } });
      if (a.status === 'ready' && a.calls?.length) {
        if (a.authorization === 'renewal_required') renewal = await getRenewalParams(t, portfolio.id);
        extra = [...(renewal ? renewal.initConfig.map((data) => ({ to: account, data: data as Hex, value: 0n })) : []), ...a.calls.map((c) => ({ to: c.to, data: c.data, value: BigInt(c.value || '0') }))];
      } else earnExtra = 'unavailable';
    } catch { earnExtra = 'unavailable'; }
  }
  const result = await allocate({ token: t, wallet, account, strategyId: portfolio.strategyId, portfolioId: portfolio.id, step, extra, prefetched, approved });
  if (extra.length > 0 && !result.earnSent) earnExtra = 'unavailable';
  if (result.earnSent) {
    earnExtra = 'on';
    if (renewal) await recordRenewal(t, portfolio.id, renewal);
  }
  return { ...result, pending: false, portfolioId: portfolio.id, amountUsdt: formatUnits(amountWei, 18), earnExtra };
}

// ---- 賣 --------------------------------------------------------------------------------------
/**
 * 賣出 `usd`（美元）：後端分批賣成 USDT（`/redeem`），再由 owner 簽一筆把 USDT 從帳戶轉回錢包（cre8-app FundPage `withdraw`）。
 * 美股收盤時股票賣不動：回 `{ sentUsd, note }`，note 說明原因。
 */
export const sell = localized(sellRaw, '卖出没完成，再试一次。');
/**
 * 這一檔帳戶現在能領回錢包的 USDT（backend#238 `/portfolios/:id/execution` 的 cash.withdrawableRaw）：
 * 進行中的買入預留的現金不能領（領走會讓組合卡住）。讀不到回 null（照舊用帳戶餘額，代付那邊仍會擋）。
 */
async function freeCash(t: string, portfolioId: number): Promise<{ free: bigint; reserved: bigint } | null> {
  try {
    const e = await apiRequest<{ cash?: { withdrawableRaw?: unknown; reservedRaw?: unknown } }>(`/portfolios/${portfolioId}/execution`, { token: t });
    const f = e.cash?.withdrawableRaw, r = e.cash?.reservedRaw;
    return typeof f === 'string' && /^\d+$/.test(f) && typeof r === 'string' && /^\d+$/.test(r) ? { free: BigInt(f), reserved: BigInt(r) } : null;
  } catch { return null; }
}
/** 給賣出畫面：預留給進行中買入的 USDT（不能部分領出；全部賣出時後端會先取消那筆買入）。 */
export async function withdrawable(portfolioId: number): Promise<{ freeUsdt: string; reservedUsdt: string } | null> {
  const c = await freeCash(token(), portfolioId);
  return c === null ? null : { freeUsdt: formatUnits(c.free, 18), reservedUsdt: formatUnits(c.reserved, 18) };
}
async function sellRaw(args: { portfolioId: number; usd: number; all?: boolean; onStep?: Step }) {
  const step = args.onStep ?? (() => {});
  const { token: t, wallet, owner } = need();
  const list = await getPortfolios(t);
  const holding = list.find((p) => p.id === args.portfolioId);
  const account = holding?.smartAccounts[0]?.address as Address | undefined;
  if (!holding || !account) throw new Error(L('Portfolio not found.', '找不到这个组合。'));
  step(L('Checking your portfolio', '正在检查持仓'));
  let latest: PortfolioStatus = await getPortfolioStatus(t, holding.id);
  // 進行中的買入預留的現金不算可賣出／可領回（全部賣出時後端先取消那筆買入，預留就放出來）。
  const cash0 = args.all ? null : await freeCash(t, holding.id);
  const reservedUsd = cash0 === null ? 0 : Number(formatUnits(cash0.reserved, 18));
  const ceiling = Math.max(0, totalUsdOf(latest.totalUsdE8) - reservedUsd);
  const wanted = Math.min(args.all ? totalUsdOf(latest.totalUsdE8) : args.usd, args.all ? totalUsdOf(latest.totalUsdE8) : ceiling);
  let note: string | null = null;
  const cashUsd = cashUsdOf(latest.holdings ?? [], 'USDT');
  const target = sellTargetUsd(wanted, cash0 === null ? cashUsd : Math.min(cashUsd, Number(formatUnits(cash0.free, 18))));
  if (target !== null) {
    step(L('Selling', '正在卖出'));
    try {
      const first = () => sellAfterUnwind(() => roundOrLanded(t, holding.id, () => retryBusyRound(() => (args.all ? closePosition(t, holding.id) : redeemPortfolio(t, holding.id, target)) as Promise<RedeemResult>)), step);
      const run = await runSellBatches({ first, next: (rest) => continueRedeem(t, holding.id, rest), maxBatches: MAX_SELL_BATCHES, onContinue: ({ batch }) => step(L(`Selling (batch ${batch})`, `正在卖出（第 ${batch} 批）`)) });
      if (afterSellRun(run) !== 'proceed' || run.status === 'stalled') note = tradeNote(explainTradeFailure({ outcome: run.lastOutcome, reason: run.lastReason }));
    } catch (cause) {
      if (!(cause instanceof SellBatchError)) throw cause;
      note = tradeNote(explainTradeFailure({ outcome: cause.outcome, reason: cause.message }));
    }
    latest = await getPortfolioStatus(t, holding.id);
  }
  const balance = await readOnlyClient().readContract({ address: USDT, abi: erc20Abi, functionName: 'balanceOf', args: [account] }).catch(() => 0n);
  const cash1 = await freeCash(t, holding.id);
  const cap = cash1 === null || cash1.free >= balance ? balance : cash1.free;
  const value = withdrawAmountWei(args.all ? formatUnits(cap, 18) : wanted.toFixed(8), cap, 18);
  // 只有真的少領（全部賣出卻有預留、或部分領回不到要的金額）才說原因。
  if (cap < balance && note === null && (args.all || value < withdrawAmountWei(wanted.toFixed(8), balance, 18))) {
    const held = usdtText((balance - cap).toString());
    note = L(`${held} USDT is set aside for a buy that is still in progress, so it stays in this portfolio for now.`, `有 ${held} USDT 留给还在进行的买入，暂时留在组合里。`);
  }
  if (value === 0n) return { sentUsdt: '0', note: note ?? L('Nothing could be sold right now.', '现在没有能卖出的部分。'), txHash: null };
  step(L('Approve in your wallet to receive your USDT', '在钱包里确认，领回 USDT'));
  const receipt = await sendWithdraw({ wallet, token: t, accountAddress: account, strategyId: holding.strategyId, asset: USDT, recipient: owner, amountWei: value });
  if (!receipt.success) throw new Error(L(`The transfer landed but reverted (${receipt.txHash}).`, `转账上链后被回滚（${receipt.txHash}）。`));
  // emptied：全部賣完、USDT 全數領回（My mix 賣完後問要不要刪掉組合）。
  return { sentUsdt: formatUnits(value, 18), note, txHash: receipt.txHash, emptied: !!args.all && note === null };
}

// ---- My mix（自建籃子） ---------------------------------------------------------------------
const mixApi = {
  list: (t: string) => apiRequest<{ mixes: unknown[] }>('/me/mixes', { token: t }),
  get: (t: string, id: number) => apiRequest<unknown>(`/me/mixes/${id}`, { token: t }),
  create: (t: string, input: unknown, key: string) => apiRequest<unknown>('/me/mixes', { method: 'POST', token: t, body: input, headers: { 'Idempotency-Key': key } }),
  patch: (t: string, id: number, body: unknown) => apiRequest<unknown>(`/me/mixes/${id}`, { method: 'PATCH', token: t, body }),
  remove: (t: string, id: number) => apiRequest<{ mixId: number; status: 'deleted' | 'deleting' }>(`/me/mixes/${id}/delete`, { method: 'POST', token: t }),
};
export const mixes = () => mixApi.list(token());
/**
 * 刪除 My mix：有持倉先全部賣成 USDT 並領回錢包（同 `sell` all），再 `POST /me/mixes/:id/delete`。
 * 回 `deleted`（已刪）或 `deleting`（美股收盤賣不完：後端開盤時賣完，之後在「我的」領回 USDT 即刪除，也是呼叫這支）。
 * 組合帳戶的 session key 只能呼叫 executor、不能把 USDT 轉回錢包，所以領回一律由 owner 簽。
 */
export const deleteMix = localized(deleteMixRaw, '没删掉，再试一次。');
async function deleteMixRaw(args: { mixId: number; portfolioId: number | null; onStep?: Step }) {
  const step = args.onStep ?? (() => {});
  const { token: t } = need();
  const sold = args.portfolioId == null ? null : await sellRaw({ portfolioId: args.portfolioId, usd: 0, all: true, onStep: step });
  step(L('Deleting', '正在删除'));
  // 剛領回的 USDT 可能還沒反映在後端讀到的區塊（MIX_HAS_CASH）：稍等再試幾次。
  for (let attempt = 0; ; attempt++) {
    try {
      const r = await mixApi.remove(t, args.mixId);
      return { status: r.status, sentUsdt: sold ? sold.sentUsdt : '0' };
    } catch (cause) {
      if (!(cause instanceof ApiError) || cause.code !== 'MIX_HAS_CASH' || attempt >= 3) throw cause;
      await sleep(3000);
    }
  }
}
export const mix = (id: number) => mixApi.get(token(), id);

type MixInput = { name: string; assets: { assetId: Address; weightBps: number }[]; rebalance: { frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly'; startDate: string } };
/** 建立：後端建私人策略＋帳戶 → owner 簽一次（enroll）→ 後端確認。`key`：同一次建立重試要用同一把 Idempotency-Key。 */
export const createMix = localized(createMixRaw, '组合没建好，再试一次。');
async function createMixRaw(args: { input: MixInput; key: string; onStep?: Step }) {
  const step = args.onStep ?? (() => {});
  const { token: t, wallet } = need();
  step(L('Creating your basket', '正在创建组合'));
  const created = await mixApi.create(t, args.input, args.key) as Parameters<typeof freshCreationPayload>[1];
  const payload = await freshCreationPayload(t, created);
  if (payload === null) return { mixId: created.mixId, account: created.account, portfolioId: null };
  step(L('Approve in your wallet to start your basket', '在钱包里确认，启动组合'));
  return signMix({ wallet, token: t, payload, picks: args.input.assets, onStage: (s) => s === 'confirm' && step(L('Confirming', '正在确认')) });
}
/**
 * 放錢進組合：錢包轉帳（amount）或測試網每日 1,000 免費 USDT。
 * `earnExtra`：買入確認卡打開了加息策略（跟基金一樣）。My mix 的入金是錢包直接轉帳、不經帳戶的 UserOp，所以錢到帳後
 * 由帳戶 owner 再簽一次同意（`/strategy-earn/auto`，額度＝帳戶裡等著買的 USDT），成交後排程自動抵押、借款。
 * 拿不到同意不擋入金，只回 earnExtra: 'unavailable'。
 */
export const fundMixBasket = localized(fundMixBasketRaw, '充值没完成，再试一次。');
async function fundMixBasketRaw(args: { mixId: number; portfolioId: number; account: Address; pay: 'wallet' | 'faucet'; amount?: string; earnExtra?: boolean; onStep?: Step }) {
  const step = args.onStep ?? (() => {});
  const { token: t, wallet } = need();
  step(args.pay === 'wallet' ? L('Approve the USDT transfer in your wallet', '在钱包里确认 USDT 转账') : L('Getting your test USDT', '正在领取测试 USDT'));
  const amount = args.pay === 'wallet' ? parseUnits(args.amount ?? '0', 18) : 0n;
  const r = await fundMix({ wallet, token: t, account: args.account, mixId: args.mixId, portfolioId: args.portfolioId, with: args.pay === 'wallet' ? { kind: 'wallet', amount } : { kind: 'test-usdt' } });
  if (!args.earnExtra) return { ...r, earnExtra: null };
  // 測試 USDT 每天 1,000 直接進組合帳戶。
  try { await strategyAutoOn(t, wallet, args.portfolioId, step, args.pay === 'wallet' ? amount : parseUnits('1000', 18)); return { ...r, earnExtra: 'on' as const }; }
  catch { return { ...r, earnExtra: 'unavailable' as const }; }
}
/** 改名、頻率（不用簽）或成分（要簽一次，立刻生效）。 */
export const patchMix = localized(patchMixRaw, '没保存上，再试一次。');
async function patchMixRaw(args: { id: number; patch: Partial<MixInput>; onStep?: Step }) {
  const step = args.onStep ?? (() => {});
  const { token: t, wallet } = need();
  const result = await mixApi.patch(t, args.id, args.patch) as Record<string, unknown>;
  if (!('intentId' in result)) return { signed: false, mix: result };
  step(L('Approve in your wallet to apply the new weights', '在钱包里确认，应用新比例'));
  await signMix({ wallet, token: t, payload: result, picks: args.patch.assets, onStage: (s) => s === 'confirm' && step(L('Confirming', '正在确认')) });
  return { signed: true, mix: null };
}

// ---- Earn（docs/EARN_UX.zh-TW.md）---------------------------------------------------------------
// 三種錢分開：現金生息（A）在 owner 錢包自己存進白名單 vault（EOA 交易，後端只給 calldata、事後確認記帳）；
// 策略加息（B）在每一檔投組自己的帳戶裡（Kernel UserOp），借出來的 USDT 只在那個帳戶裡，從不到錢包。
type EarnCall = { to: Address; data: Hex; value: string; gas?: string };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const temporarily = () => L('Temporarily unavailable. Try again later.', '暂时无法使用，稍后再试。');
const usdtText = (raw: string) => Number(formatUnits(BigInt(raw), 18)).toLocaleString('en-US', { maximumFractionDigits: 2 });
/** 後端的錯誤碼 → 一句白話（後端訊息是繁中，畫面要英文／簡中）。 */
function earnError(cause: unknown): Error {
  if (!(cause instanceof ApiError)) return cause instanceof Error ? cause : new Error(String(cause));
  const m: Record<string, string> = {
    INSUFFICIENT_BALANCE: L('Not enough USDT in your wallet.', '钱包里的 USDT 不够。'),
    AMOUNT_TOO_SMALL: L('The minimum is 1 USDT.', '最少 1 USDT。'),
    AMOUNT_EXCEEDS_BALANCE: L('That’s more than you have earning.', '超过了生息中的金额。'),
    NOTHING_TO_WITHDRAW: L('Nothing to take out.', '没有可取出的金额。'),
    TX_FAILED: L('The transaction didn’t go through. Nothing was moved.', '交易没成功，资金没动。'),
    INSUFFICIENT_HOLDING: L('This portfolio doesn’t hold enough of it yet.', '组合里的持仓还不够。'),
    MIX_EXITING: L('This basket is selling everything right now, so the yield strategy can’t be turned on.', '组合正在全部卖出，暂时不能开启加息策略。'),
  };
  return new Error(m[cause.code] ?? (cause.status === 503 || cause.status === 404 ? temporarily() : cause.status === 429 ? L('Too many tries. Wait a minute.', '试太多次了，等一分钟。') : L('That didn’t finish. Try again.', '没有完成，再试一次。')));
}
async function earnApi<T>(path: string, init: { method?: 'GET' | 'POST'; body?: unknown } = {}): Promise<T> {
  try { return await apiRequest<T>(path, { ...init, token: token() }); } catch (cause) { throw earnError(cause); }
}

/** 現金生息：錢包可用 USDT 與各 vault 部位（`GET /me/earn`）。讀不到回 `status: 'unavailable'`（不是錯誤）。 */
export const earn = () => earnApi<unknown>('/me/earn');

/** owner 錢包依序送出後端給的 calls（approve → deposit／withdraw），每筆等上鏈；回最後一筆的 hash。 */
async function sendOwnerCalls(wallet: RenewalWallet, owner: Address, t: string, calls: EarnCall[], step: Step): Promise<Hex> {
  await assertRpcChain();
  if (wallet.kind !== 'injected') throw new Error('wallet');
  const reader = publicClientFor(wallet);
  step(L('Getting the network fee', '正在准备 gas'));
  await ensureOwnerGas({
    readBalance: () => reader.getBalance({ address: owner }),
    requestGas: () => postGasFaucet(t),
    waitForTx: async (h) => { await reader.waitForTransactionReceipt({ hash: h as Hex, confirmations: 1, timeout: 30_000 }); },
  });
  const client = createWalletClient({ account: wallet.address, chain: appChain, transport: custom(wallet.provider as never) });
  let last: Hex | null = null;
  for (const [i, c] of calls.entries()) {
    step(calls.length > 1 ? L(`Approve in your wallet (${i + 1} of ${calls.length})`, `在钱包里确认（${i + 1}/${calls.length}）`) : L('Approve in your wallet', '在钱包里确认'));
    const hash = await client.sendTransaction({ to: c.to, data: c.data, value: BigInt(c.value || '0'), ...(c.gas ? { gas: BigInt(c.gas) } : {}), chain: appChain });
    step(L('Waiting for the network', '等待链上确认'));
    const receipt = await reader.waitForTransactionReceipt({ hash, confirmations: 1, timeout: 60_000 });
    if (receipt.status !== 'success') throw new Error(L('The transaction didn’t go through. Nothing was moved.', '交易没成功，资金没动。'));
    last = hash; noteTx(hash);
  }
  if (last === null) throw new Error(temporarily());
  return last;
}
/** 記帳（`POST /me/earn/confirm`，冪等）：鏈上還沒定案回 pending，等一下再問。記不上不影響錢，只是收益統計晚一點。 */
async function confirmEarn(txHash: Hex): Promise<boolean> {
  for (let i = 0; i < 12; i++) {
    const r = await earnApi<{ status: string }>('/me/earn/confirm', { method: 'POST', body: { txHash } }).catch(() => ({ status: 'pending' }));
    if (r.status === 'confirmed') return true;
    await sleep(2500);
  }
  return false;
}
type EarnPrepared = { status: 'ready' | 'limited' | 'unavailable'; amountRaw?: string; calls?: EarnCall[]; message?: string | null; maxDepositRaw?: string; maxWithdrawRaw?: string; partial?: { amountRaw: string; calls: EarnCall[] } };

/** 存入一個白名單 vault（金額是 USDT 字串）。一次確認：沒授權過會多一筆 approve。 */
export const earnDeposit = localized(earnDepositRaw, '存入没完成，再试一次。');
async function earnDepositRaw(args: { vaultId: string; amount: string; onStep?: Step }) {
  const step = args.onStep ?? (() => {});
  const { token: t, wallet, owner } = need();
  step(L('Checking the vault', '正在检查'));
  const p = await earnApi<EarnPrepared>('/me/earn/deposit', { method: 'POST', body: { vaultId: args.vaultId, amountRaw: parseUnits(args.amount, 18).toString() } });
  if (p.status === 'limited') throw new Error(L(`This vault can take up to ${usdtText(p.maxDepositRaw ?? '0')} USDT right now.`, `这个 vault 现在最多还能存 ${usdtText(p.maxDepositRaw ?? '0')} USDT。`));
  if (p.status !== 'ready' || !p.calls?.length) throw new Error(temporarily());
  const hash = await sendOwnerCalls(wallet, owner, t, p.calls, step);
  step(L('Confirming', '正在确认'));
  const recorded = await confirmEarn(hash);
  return { amountUsdt: formatUnits(BigInt(p.amountRaw ?? '0'), 18), txHash: hash, recorded };
}

/**
 * 提現：把錢包裡的 USDT 轉到使用者貼上的外部地址（BNB Chain）。`amount` 是 USDT 字串或 'max'（整個錢包餘額）。
 * 跟錢包付款買入一樣：gas 不夠先由水龍頭補，再由 owner 錢包送一筆 USDT transfer，等上鏈。
 */
export const withdrawUsdt = localized(withdrawUsdtRaw, '提现没完成，再试一次。');
async function withdrawUsdtRaw(args: { to: string; amount: string | 'max'; onStep?: Step }) {
  const step = args.onStep ?? (() => {});
  const { token: t, wallet, owner } = need();
  const to = args.to.trim();
  if (!isAddress(to, { strict: false })) throw new Error(L('That address doesn’t look right. Check it and try again.', '地址格式不对，请检查后再试。'));
  if (to.toLowerCase() === owner.toLowerCase()) throw new Error(L('That’s your own wallet address.', '这是你自己的钱包地址。'));
  if (to.toLowerCase() === USDT.toLowerCase()) throw new Error(L('That’s the USDT contract, not a wallet. Nothing was sent.', '这是 USDT 合约地址，不是钱包，没有转出。'));
  step(L('Checking your balance', '正在检查余额'));
  const balance = await readWalletUsdt(owner);
  if (balance === null) throw new Error(temporarily());
  const value = args.amount === 'max' ? balance : parseUnits(args.amount, 18);
  if (value <= 0n) throw new Error(L('Enter an amount.', '请输入金额。'));
  if (value > balance) throw new Error(L(`You have ${formatUnits(balance, 18)} USDT in your wallet.`, `钱包里只有 ${formatUnits(balance, 18)} USDT。`));
  const reader = publicClientFor(wallet);
  step(L('Getting the network fee', '正在准备 gas'));
  await ensureOwnerGas({
    readBalance: () => reader.getBalance({ address: owner }),
    requestGas: () => postGasFaucet(t),
    waitForTx: async (h) => { await reader.waitForTransactionReceipt({ hash: h as Hex, confirmations: 1, timeout: 30_000 }); },
  });
  step(L('Approve the USDT transfer in your wallet', '在钱包里确认 USDT 转账'));
  const hash = await sendUsdt(wallet, to as Address, value);
  step(L('Waiting for the network', '等待链上确认'));
  const receipt = await reader.waitForTransactionReceipt({ hash, confirmations: 1, timeout: 60_000 });
  if (receipt.status !== 'success') throw new Error(L('The transfer didn’t go through. Nothing was sent.', '转账没成功，资金没动。'));
  return { amountUsdt: formatUnits(value, 18), txHash: hash };
}

/**
 * 領回到錢包（含利息）：`amount` 是 USDT 字串或 'max'。有好幾個 vault 部位時從大的開始領；
 * vault 當下流動性不夠時丟一句「現在最多可領 X」，不報錯碼（max 則先領能領的部分）。
 */
export const earnWithdraw = localized(earnWithdrawRaw, '取出没完成，再试一次。');
async function earnWithdrawRaw(args: { amount: string | 'max'; onStep?: Step }) {
  const step = args.onStep ?? (() => {});
  const { token: t, wallet, owner } = need();
  step(L('Checking your balance', '正在检查余额'));
  const acct = await earnApi<{ status: string; cashEarn: { positions: { vaultId: string; valueRaw: string | null; maxWithdrawRaw: string | null }[] } }>('/me/earn');
  if (acct.status !== 'ok') throw new Error(temporarily());
  const positions = acct.cashEarn.positions.filter((p) => p.valueRaw !== null && BigInt(p.valueRaw) > 0n).sort((a, b) => (BigInt(b.valueRaw!) > BigInt(a.valueRaw!) ? 1 : -1));
  if (positions.length === 0) throw new Error(L('Nothing to take out.', '没有可取出的金额。'));
  const all = args.amount === 'max';
  let left = all ? 0n : parseUnits(args.amount, 18);
  const plans: { vaultId: string; amountRaw: string | 'max' }[] = [];
  for (const p of positions) {
    if (all) { plans.push({ vaultId: p.vaultId, amountRaw: 'max' }); continue; }
    if (left <= 0n) break;
    const value = BigInt(p.valueRaw!), take = left < value ? left : value;
    plans.push({ vaultId: p.vaultId, amountRaw: take === value ? 'max' : take.toString() });
    left -= take;
  }
  if (!all && left > 0n) throw new Error(L('That’s more than you have earning.', '超过了生息中的金额。'));
  let got = 0n, note: string | null = null;
  for (const plan of plans) {
    const p = await earnApi<EarnPrepared>('/me/earn/withdraw', { method: 'POST', body: { vaultId: plan.vaultId, amountRaw: plan.amountRaw } });
    let calls = p.status === 'ready' ? p.calls : undefined, amountRaw = p.amountRaw;
    if (p.status === 'limited') {
      const max = usdtText(p.maxWithdrawRaw ?? '0');
      if (!p.partial) throw new Error(L(`You can take out up to ${max} USDT right now.`, `现在最多可取 ${max} USDT。`));
      calls = p.partial.calls; amountRaw = p.partial.amountRaw;
      note = L(`Only ${max} USDT could come out right now. Try the rest later.`, `现在只能取 ${max} USDT，其余稍后再取。`);
    }
    if (!calls?.length) throw new Error(temporarily());
    const hash = await sendOwnerCalls(wallet, owner, t, calls, step);
    step(L('Confirming', '正在确认'));
    await confirmEarn(hash);
    got += BigInt(amountRaw ?? '0');
  }
  return { amountUsdt: formatUnits(got, 18), note };
}

type StrategyPosition = { asset: string; status: 'on' | 'off' | 'unavailable' };
/** 策略加息：這一檔的部位（`GET /portfolios/:id/strategy-earn`）；淨值＝抵押＋vault－負債，跟現金分開。 */
export const strategyEarn = (portfolioId: number) => earnApi<unknown>(`/portfolios/${portfolioId}/strategy-earn`);

/** 加息的活動紀錄（`GET /portfolios/:id/strategy-earn/activity`，新到舊）：減倉、收掉、領獎、開啟、還款。 */
export const strategyActivity = (portfolioId: number) => earnApi<unknown>(`/portfolios/${portfolioId}/strategy-earn/activity`);

/** 一檔投組的帳戶：`GET /portfolios` 找出 Kernel 帳戶與策略 id（簽 UserOp 用）。 */
async function portfolioAccount(t: string, portfolioId: number) {
  const holding = (await getPortfolios(t)).find((p) => p.id === portfolioId);
  const account = holding?.smartAccounts[0]?.address as Address | undefined;
  if (!holding || !account) throw new Error(L('Portfolio not found.', '找不到这个组合。'));
  return { account, strategyId: holding.strategyId };
}
async function sendStrategyCalls(t: string, wallet: RenewalWallet, portfolioId: number, calls: EarnCall[]) {
  const { account, strategyId } = await portfolioAccount(t, portfolioId);
  const receipt = await sendSudoCalls({ wallet, token: t, accountAddress: account, strategyId, calls: calls.map((c) => ({ to: c.to, data: c.data, value: BigInt(c.value || '0') })) });
  if (!receipt.success) throw new Error(L('The transaction didn’t go through. Nothing was moved.', '交易没成功，资金没动。'));
  void recordStrategyTx(t, portfolioId, receipt.txHash);
  return receipt.txHash;
}
/** 加息活動紀錄（backend#255）：owner 自己簽的開啟／關閉也從收據記進帳本。背景做、失敗不影響（下次重送同一筆也不會重複記）。 */
async function recordStrategyTx(t: string, portfolioId: number, txHash: string): Promise<void> {
  for (let i = 0; i < 6; i++) {
    try {
      const r = await apiRequest<{ status: string }>(`/portfolios/${portfolioId}/strategy-earn/confirm`, { method: 'POST', token: t, body: { txHash } });
      if (r.status !== 'pending') return;
    } catch { return; }
    await sleep(2_000);
  }
}

/**
 * 開啟加息：這一檔帳戶裡持有的、有開放市場的資產（`assets`，後端代號如 NVDAB），全部數量拿去開；
 * 後端每個資產回一組 calls，合成一筆 UserOp（owner 確認一次）。還沒成交、帳戶裡沒有那些資產時回 `{ opened: [] }`。
 */
export const strategyOpen = localized(strategyOpenRaw, '加息没开启，再试一次。');
async function strategyOpenRaw(args: { portfolioId: number; assets: string[]; onStep?: Step }) {
  const step = args.onStep ?? (() => {});
  const { token: t, wallet } = need();
  step(L('Checking your portfolio', '正在检查持仓'));
  const st = await getPortfolioStatus(t, args.portfolioId);
  const held = (st.holdings ?? []).filter((h) => args.assets.includes(h.symbol) && BigInt(h.amountWei) > 0n);
  if (held.length === 0) return strategyAutoOn(t, wallet, args.portfolioId, step);
  // Venus 的借款是整個帳戶共用（同一個 comptroller）：同一筆 UserOp 裡開第二檔時，後端算的 maxDebt 沒算到第一檔剛借的，
  // 合約回 DebtAboveConsent（2026-11-23 實測 TSLAB＋SPCXB）。所以一檔一筆、依序送，每次都讀上一筆之後的鏈上狀態。
  const opened: string[] = [];
  let lastError: unknown = null;
  for (const [i, h] of held.entries()) {
    const quote = () => earnApi<{ status: string; calls?: EarnCall[] }>(`/portfolios/${args.portfolioId}/strategy-earn/open`, { method: 'POST', body: { asset: h.symbol, collateralRaw: h.amountWei } });
    step(held.length > 1 ? L(`Approve in your wallet to turn on Earn extra (${i + 1} of ${held.length})`, `在钱包里确认，开启加息（${i + 1}/${held.length}）`) : L('Approve in your wallet to turn on Earn extra', '在钱包里确认，开启加息'));
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const r = await quote();
        if (r.status !== 'ready' || !r.calls?.length) break;
        await sendStrategyCalls(t, wallet, args.portfolioId, r.calls);
        opened.push(h.symbol); lastError = null;
        break;
      } catch (cause) {
        lastError = cause;
        // 讀到的還是上一筆之前的狀態（節點落後）：等幾秒重新報價一次。
        if (attempt === 0 && /0x4a9b9d93|DebtAboveConsent/.test(cause instanceof Error ? cause.message : String(cause))) { await sleep(4_000); continue; }
        break;
      }
    }
    if (i < held.length - 1 && opened.includes(h.symbol)) await sleep(3_000);
  }
  if (opened.length === 0) { if (lastError) throw lastError; throw new Error(temporarily()); }
  return { opened };
}

/**
 * 還沒成交（帳戶裡只有 USDT、還沒有股票）時開加息：跟買入確認畫面一樣先簽同意（`/strategy-earn/auto`，額度＝帳戶裡等著買的 USDT），
 * 成交後由排程自動抵押、借款。回 `{ opened: [], auto: true }`，畫面顯示「已開啟・成交後自動開始」，不再叫用戶成交後回來重開。
 */
async function strategyAutoOn(t: string, wallet: RenewalWallet, portfolioId: number, step: Step, atLeast = 0n) {
  const { account, strategyId } = await portfolioAccount(t, portfolioId);
  // 剛轉進來的錢節點可能還沒讀到：至少用這次的金額（My mix 買入時）。
  const read = await readOnlyClient().readContract({ address: USDT, abi: erc20Abi, functionName: 'balanceOf', args: [account] }).catch(() => 0n);
  const budget = read > atLeast ? read : atLeast;
  if (budget <= 0n) throw new Error(L('Buy into this portfolio first, then turn this on.', '先买入这个组合，再开启加息。'));
  const a = await earnApi<{ status: string; authorization?: string; calls?: EarnCall[] }>(`/portfolios/${portfolioId}/strategy-earn/auto`, { method: 'POST', body: { budgetRaw: budget.toString() } });
  if (a.status !== 'ready' || !a.calls?.length) throw new Error(temporarily());
  const renewal = a.authorization === 'renewal_required' ? await getRenewalParams(t, portfolioId) : null;
  const calls = [...(renewal ? renewal.initConfig.map((data) => ({ to: account, data: data as Hex, value: 0n })) : []), ...a.calls.map((c) => ({ to: c.to, data: c.data, value: BigInt(c.value || '0') }))];
  step(L('Approve in your wallet to turn on Earn extra', '在钱包里确认，开启加息'));
  const receipt = await sendSudoCalls({ wallet, token: t, accountAddress: account, strategyId, calls });
  if (!receipt.success) throw new Error(L('The transaction didn’t go through. Nothing was moved.', '交易没成功，资金没动。'));
  if (renewal) await recordRenewal(t, portfolioId, renewal);
  return { opened: [] as string[], auto: true };
}

/** 關閉加息（關掉、或賣出前）：開著的資產一次交給後端規劃（先還款再取回抵押），合成一筆 UserOp。沒有開著的就什麼都不送。 */
export const strategyClose = localized(strategyCloseRaw, '加息没结清，再试一次。');
async function strategyCloseRaw(args: { portfolioId: number; onStep?: Step }) {
  const step = args.onStep ?? (() => {});
  const { token: t, wallet } = need();
  const pos = await earnApi<{ status: string; positions: StrategyPosition[] }>(`/portfolios/${args.portfolioId}/strategy-earn`);
  if (pos.status !== 'ok') throw new Error(temporarily());
  const on = pos.positions.filter((p) => p.status === 'on');
  if (on.length === 0) return { closed: [] as string[] };
  // 一次問全部（backend#252）：Venus 整個帳戶只有一筆借款，要一起規劃還款，一檔一檔各問會讓第一檔想還全部而失敗。
  const r = await earnApi<{ status: string; calls?: EarnCall[] }>(`/portfolios/${args.portfolioId}/strategy-earn/close`, { method: 'POST', body: { assets: on.map((p) => p.asset) } });
  if (r.status !== 'ready' || !r.calls?.length) throw new Error(temporarily());
  const calls: EarnCall[] = r.calls;
  step(L('Approve in your wallet to settle Earn extra', '在钱包里确认，结清加息'));
  await sendStrategyCalls(t, wallet, args.portfolioId, calls);
  return { closed: on.map((p) => p.asset) };
}

// ---- 定投（DCA，backend docs/dca.zh-TW.md）--------------------------------------------------------
// 總額先進這一檔自己的帳戶（同買入的錢包轉帳，但不記成 funding lot），帳戶再整筆存進白名單 vault 生息；
// 每期由系統領出一期、照權重買。還沒買的錢屬於這一檔，不跟現金、現金生息、加息策略混在一起。
type DcaFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly';
type DcaPrepared = { status: 'ready' | 'unavailable'; planId?: string; authorization?: string; vaultId?: string; vaultName?: string; apyBps?: number | null;
  trancheRaw?: string; startAt?: string; calls?: EarnCall[]; reason?: string; message?: string };
function dcaError(cause: unknown): Error {
  if (cause instanceof ApiError) {
    const m: Record<string, string> = {
      DCA_PERIOD_TOO_SMALL: L('Each period needs at least 10 USDT.', '每期至少 10 USDT。'),
      DCA_ALREADY_ACTIVE: L('This portfolio already has DCA on.', '这个组合已经开启 DCA 了。'),
      INVALID_START: L('Pick a start date from today to a year ahead.', '开始日期要在今天到一年内。'),
      INVALID_PERIODS: L('Pick 2 to 365 periods.', '期数要在 2 到 365 之间。'),
      DCA_BUSY: L('This period is buying right now. Try again in a minute.', '这一期正在买入，稍等一分钟再试。'),
      DCA_NOT_FOUND: L('DCA isn’t on for this portfolio.', '这个组合没有开启 DCA。'),
      // 前端已經自動把總額轉進帳戶、重問過還是不夠：帳戶裡的現金有一部分還在等之前的買入。
      DCA_FUNDS_NOT_IN_ACCOUNT: L('Your USDT is in this portfolio’s account, but part of the account’s cash is still set aside for an earlier buy, so DCA can’t start yet. Try again in a few minutes.',
        'USDT 已经在这个组合账户里，但账户里有一部分钱还在等之前的买入，DCA 暂时开不了。几分钟后再试。'),
      DCA_DEPOSIT_MISMATCH: L('The amount that went into the vault doesn’t match your DCA total. Your USDT is in this portfolio’s account; contact us.',
        '存进 vault 的金额和 DCA 总额对不上。USDT 在这个组合账户里，请联系我们。'),
      NO_DCA_DEPOSIT: L('That transaction didn’t put USDT into the DCA vault. Try again.', '这笔交易没有把 USDT 存进 DCA 的 vault，再试一次。'),
      NO_DCA_RETURN: L('That transaction didn’t bring the DCA balance back to your wallet. Try again.', '这笔交易没有把 DCA 余额领回钱包，再试一次。'),
      DCA_CHAIN_UNAVAILABLE: L('DCA is only on the testnet for now.', 'DCA 目前只在测试网开放。'),
      DCA_UNAVAILABLE: temporarily(),
      INVALID_AMOUNT: L('Enter a valid amount.', '请输入有效的金额。'),
      INVALID_FREQUENCY: L('Pick daily, weekly, every two weeks or monthly.', '请选每天、每周、每两周或每月。'),
      INVALID_VAULT: L('Pick a vault.', '请选一个 vault。'),
      INVALID_DCA_REQUEST: L('Something in the request was off. Refresh and try again.', '请求有误，刷新页面后再试。'),
      INVALID_TX_HASH: L('Something in the request was off. Refresh and try again.', '请求有误，刷新页面后再试。'),
      FORBIDDEN: L('This portfolio belongs to another wallet.', '这个组合属于别的钱包。'),
    };
    if (m[cause.code]) return new Error(m[cause.code]);
  }
  return earnError(cause);
}
async function dcaApi<T>(t: string, path: string, init: { method?: 'GET' | 'POST'; body?: unknown } = {}): Promise<T> {
  try { return await apiRequest<T>(path, { ...init, token: t }); } catch (cause) { throw dcaError(cause); }
}
/** 定投狀態（`GET /portfolios/:id/dca`）：plan、還沒買的部分、已賺、下一期、生息利率（offer）。 */
export const dcaGet = (portfolioId: number) => dcaApi<unknown>(token(), `/portfolios/${portfolioId}/dca`);
/** 新的 session 權限已上鏈：記到後端（定投每期、加息都要用這把 key）。My mix 正在處理別的交易時回 409 MIX_BUSY，等一下再記。 */
async function recordRenewal(t: string, portfolioId: number, r: Awaited<ReturnType<typeof getRenewalParams>>): Promise<void> {
  await retryMixBusy(() => postRenewalResult(t, portfolioId, { keyRef: r.keyRef, permissionId: r.permissionId, validUntil: r.validUntil, policySnapshot: r.policySnapshot }),
    { delaysMs: [1_000, 2_000, 3_000, 4_000, 5_000, 5_000, 5_000, 5_000] }).catch((e) => { console.warn('[cre8-wallet] renewal-result not recorded', errorCode(e) ?? '', e instanceof Error ? e.message : e); });
}
/** 記帳（`/dca/confirm`，冪等）：鏈上還沒定案回 pending，等一下再問。 */
async function confirmDca(t: string, portfolioId: number, txHash: Hex): Promise<{ state: string; returnedRaw?: string } | null> {
  for (let i = 0; i < 12; i++) {
    const r = await dcaApi<{ status: string; state: string; returnedRaw?: string }>(t, `/portfolios/${portfolioId}/dca/confirm`, { method: 'POST', body: { txHash } }).catch(() => ({ status: 'pending', state: '' }));
    if (r.status === 'confirmed') return r;
    await sleep(2500);
  }
  return null;
}

/**
 * 開始定投：（第一次買這檔就先開帳戶）→ 總額從錢包轉進這檔的帳戶 → 帳戶 owner 簽一次存進 vault（需要時連 session 權限一起裝）→ 記帳。
 * 帳戶裡已經有上次轉進來、還沒存進 vault 的總額時，不再轉一次（失敗重試不會重複扣款）。
 */
export const dcaStart = localized(dcaStartRaw, 'DCA 没有开启，再试一次。');
async function dcaStartRaw(args: { strategyId?: number; onchainId?: number; shown?: { version: number; configHash: string } | null; mixPortfolioId?: number;
  total: string; periods: number; frequency: DcaFrequency; startAt: string; onStep?: Step }) {
  const step = args.onStep ?? (() => {});
  const { token: t, wallet } = need();
  let portfolioId: number, account: Address, strategyId: number, approved: readonly Address[] = [];
  if (args.mixPortfolioId != null) {
    portfolioId = args.mixPortfolioId;
    ({ account, strategyId } = await portfolioAccount(t, portfolioId));
  } else {
    if (args.strategyId == null || args.onchainId == null) throw new Error(temporarily());
    const r = await ensurePortfolio({ token: t, wallet, strategyId: args.strategyId, onchainId: args.onchainId, shown: args.shown ?? null, step });
    const a = r.portfolio.smartAccounts[0]?.address as Address | undefined;
    if (!a) throw new Error(L('The server returned no account for this portfolio.', '服务器没有返回这个组合的账户。'));
    portfolioId = r.portfolio.id; account = a; strategyId = r.portfolio.strategyId; approved = r.approved;
  }
  const totalWei = parseUnits(args.total, 18);
  if (totalWei <= 0n) throw new Error(L('Enter an amount.', '请输入金额。'));
  const body = { totalRaw: totalWei.toString(), periods: args.periods, frequency: args.frequency, startAt: args.startAt };
  const prepare = () => apiRequest<DcaPrepared>(`/portfolios/${portfolioId}/dca`, { method: 'POST', body, token: t });
  const fundsMissing = (cause: unknown) => cause instanceof ApiError && cause.code === 'DCA_FUNDS_NOT_IN_ACCOUNT';
  // 買入提速：授權狀態跟轉帳無關，先讀（基金同買入：還沒授權給 executor 的資產跟這一筆一起簽）。
  const approvals = args.mixPortfolioId == null ? readApprovalState(t, portfolioId, account).catch(() => null) : Promise.resolve(null);
  step(L('Checking', '正在检查'));
  let p: DcaPrepared;
  try { p = await prepare(); }
  catch (cause) {
    if (!fundsMissing(cause)) throw dcaError(cause);
    step(L('Approve the USDT transfer in your wallet', '在钱包里确认 USDT 转账'));
    const hash = await sendUsdtToMix({ wallet, token: t, account, amount: totalWei });
    step(L('Waiting for the network', '等待链上确认'));
    const receipt = await publicClientFor(wallet).waitForTransactionReceipt({ hash, confirmations: 2, timeout: 60_000 });
    if (receipt.status !== 'success') throw new Error(L(`The transfer was rejected by the network (${hash}).`, `转账被链上拒绝（${hash}）。`));
    // 後端讀的區塊可能還沒看到這筆：稍等再問幾次。
    for (let i = 0; ; i++) {
      try { p = await prepare(); break; } catch (again) { if (!fundsMissing(again) || i >= 5) throw dcaError(again); await sleep(2000); }
    }
  }
  if (p.status !== 'ready' || !p.calls?.length) throw new Error(p.message && !isZh() ? p.message : temporarily());
  const renewal = p.authorization === 'renewal_required' ? await getRenewalParams(t, portfolioId) : null;
  const core: SudoCall[] = [...(renewal ? renewal.initConfig.map((data) => ({ to: account, data: data as Hex, value: 0n })) : []),
    ...p.calls.map((c) => ({ to: c.to, data: c.data, value: BigInt(c.value || '0') }))];
  const state = await approvals, executor = state?.executor ?? null;
  const missing = executor && state ? state.missing.filter((a) => !approved.some((x) => x.toLowerCase() === a.toLowerCase())) : [];
  const extra = executor ? missing.map((asset) => ({ to: asset, data: approveCalldata(executor), value: 0n })) : [];
  const together = core.length + extra.length <= APPROVALS_PER_USEROP;
  step(L('Approve in your wallet to start', '在钱包里确认，开始 DCA'));
  const r = await sendSudoCalls({ wallet, token: t, accountAddress: account, strategyId, calls: together ? [...core, ...extra] : core });
  if (!r.success) throw new Error(L('The transaction didn’t go through. Your USDT is in this portfolio’s account; try again.', '交易没成功，USDT 在这个组合的账户里，再试一次即可。'));
  if (renewal) await recordRenewal(t, portfolioId, renewal);
  if (!together && executor) await sendInBatches(missing, (batch) => sendSudoCalls({ wallet, token: t, accountAddress: account, strategyId, calls: batch.map((asset) => ({ to: asset, data: approveCalldata(executor), value: 0n })) })).catch(() => undefined);
  step(L('Confirming', '正在确认'));
  const done = await confirmDca(t, portfolioId, r.txHash as Hex);
  return { portfolioId, planId: p.planId ?? null, totalUsdt: formatUnits(totalWei, 18), trancheUsdt: formatUnits(BigInt(p.trancheRaw ?? '0'), 18),
    vaultName: p.vaultName ?? null, apyBps: p.apyBps ?? null, recorded: done !== null };
}
export const dcaPause = localized(async (portfolioId: number) => dcaApi<{ state: string }>(token(), `/portfolios/${portfolioId}/dca/pause`, { method: 'POST', body: {} }), '没暂停上，再试一次。');
export const dcaResume = localized(async (portfolioId: number) => dcaApi<{ state: string }>(token(), `/portfolios/${portfolioId}/dca/resume`, { method: 'POST', body: {} }), '没继续上，再试一次。');
/** 領回還沒買的部分（含利息）到錢包：帳戶 owner 簽一次。流動性不夠時丟一句「現在最多可領 X」。 */
export const dcaWithdraw = localized(dcaWithdrawRaw, '没领回，再试一次。');
async function dcaWithdrawRaw(args: { portfolioId: number; onStep?: Step }) {
  const step = args.onStep ?? (() => {});
  const { token: t, wallet } = need();
  step(L('Checking', '正在检查'));
  const p = await dcaApi<{ status: string; amountRaw?: string; maxWithdrawRaw?: string; calls?: EarnCall[] }>(t, `/portfolios/${args.portfolioId}/dca/withdraw`, { method: 'POST', body: {} });
  if (p.status === 'closed') return { amountUsdt: '0', closed: true };
  if (p.status === 'limited') throw new Error(L(`You can take out up to ${usdtText(p.maxWithdrawRaw ?? '0')} USDT right now. Try again later.`, `现在最多只能领 ${usdtText(p.maxWithdrawRaw ?? '0')} USDT，稍后再试。`));
  if (p.status !== 'ready' || !p.calls?.length) throw new Error(temporarily());
  step(L('Approve in your wallet', '在钱包里确认'));
  const hash = await sendStrategyCalls(t, wallet, args.portfolioId, p.calls);
  step(L('Confirming', '正在确认'));
  const done = await confirmDca(t, args.portfolioId, hash as Hex);
  return { amountUsdt: formatUnits(BigInt(done?.returnedRaw ?? p.amountRaw ?? '0'), 18), closed: true };
}

export const chain = { id: CHAIN.id, usdt: USDT, explorer: CHAIN.explorerUrl };
export { transferCalldata };

// IIFE 沒有匯出：掛到 window，通知 app.html。
(window as unknown as { CRE8W: unknown }).CRE8W = {
  mount, subscribe, get, setInvite, waitlistMe, joinWaitlist, waitlistTasks, completeWaitlistTask, redeemInvite, signInWith, sendEmailCode, submitEmailCode, signInWallet, retry, logout, link, exportWallet,
  portfolios, status, activity, walletUsdt, buy, sell, withdrawable, mixes, mix, createMix, fundMixBasket, patchMix, deleteMix, chain,
  txReset, txs,
  withdrawUsdt,
  earn, earnDeposit, earnWithdraw, strategyEarn, strategyOpen, strategyClose, strategyActivity,
  dcaGet, dcaStart, dcaPause, dcaResume, dcaWithdraw,
  /** 頁面換語言後呼叫：重推一次快照，讓錯誤訊息換成新語言。 */
  relang: () => { if (mounted) emit(); },
};
window.dispatchEvent(new Event('cre8w:ready'));
