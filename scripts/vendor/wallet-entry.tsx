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
  postBuyFunding,
  postFaucetUsdt,
  postFundingLot,
  postGasFaucet,
  postRebalance,
  postWaitlistJoin,
  postWaitlistRedeem,
  prepareEnrollment,
  redeemPortfolio,
} from './lib/api';
import type { PortfolioStatus, RedeemResult } from './lib/api';
import { CHAIN, approveCalldata, assertRpcChain, bsc as appChain, publicClientFor, readOnlyClient, sendSudoCalls, sendWithdraw, transferCalldata } from './lib/kernel';
import type { RenewalWallet } from './lib/kernel';
import { assertShownVersion, waitForAccountCode, waitForPreparation } from './lib/first-enroll';
import { firstEnrollCalls } from './lib/atp-contracts';
import { ensureOwnerGas } from './lib/testnet-wallet-buy';
import { retryWhileBusy } from './lib/portfolio-busy';
import { sendInBatches } from './lib/approval-batches';
import { faucetFailure, faucetSuccess, needsDailyFaucet } from './lib/faucet';
import { MAX_SELL_BATCHES, afterSellRun, runSellBatches, SellBatchError } from './lib/sell-batches';
import { cashUsdOf, sellTargetUsd, totalUsdOf } from './lib/withdraw-plan';
import { withdrawAmountWei } from './lib/format';
import { explainTradeFailure } from './lib/trade-failure';
import { isWaitlistPending, signalWaitlistApproved } from './lib/waitlist-signal';
import { normalizeInviteCode, parseWaitlist } from './lib/waitlist';
import { freshCreationPayload, fundMix, readWalletUsdt, signMix } from './features/mix/mix-chain';
import { createElement } from 'react';
import { createWalletClient, custom, encodeFunctionData, erc20Abi, formatUnits, parseUnits } from 'viem';
import type { Address, Hex } from 'viem';

type Step = (text: string) => void;
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
  [/network|fetch|timeout|timed out/i, '网络出问题了，再试一次。'],
  [/^NO_WALLET$/, '钱包还在创建，稍后再试。'],
];
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
      if (!isZh()) throw cause;
      throw new Error(zhMessage(cause instanceof Error ? cause.message : String(cause), fallback));
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
  emit();
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
  return createWalletClient({ account: wallet.address, chain: appChain, transport: custom(wallet.provider as never) }).sendTransaction({ to: USDT, data, chain: appChain });
}

/** 第一次買：後端先部署帳戶 → owner 簽 enroll＋approve → 後端確認建投組（cre8-app FundPage `deposit`）。 */
async function ensurePortfolio(args: { token: string; wallet: RenewalWallet; strategyId: number; onchainId: number; shown: { version: number; configHash: string } | null; step: Step }) {
  const list = await getPortfolios(args.token);
  const existing = list.find((p) => p.strategyId === args.strategyId && p.smartAccounts[0]?.address);
  if (existing) return existing;
  args.step(L('Setting up your account', '正在开通账户'));
  const registry = CHAIN.contracts?.registry as Address, executor = CHAIN.contracts?.executor as Address;
  const prepared = await waitForPreparation(() => apiPrepare(args.token, args.strategyId));
  if (args.shown !== null) assertShownVersion(args.shown, prepared);
  await waitForAccountCode((address) => readOnlyClient().getCode({ address }), prepared.account);
  const calls = await firstEnrollCalls(readOnlyClient(), { registry, executor, usdt: USDT, account: prepared.account, id: BigInt(args.onchainId), expectedVersion: prepared.expectedVersion, configHash: prepared.configHash });
  if (calls !== null) {
    args.step(L('Approve in your wallet to join this portfolio', '在钱包里确认，加入这个组合'));
    const joined = await sendSudoCalls({ wallet: args.wallet, token: args.token, accountAddress: prepared.account, strategyId: args.strategyId, calls });
    if (!joined.success) throw new Error(L(`Joining landed on-chain but reverted (${joined.txHash}). Nothing was transferred.`, `加入组合的交易上链后被回滚（${joined.txHash}），资金没有转出。`));
  }
  return confirmEnrollment(args.token, args.strategyId);
}
const apiPrepare = (t: string, strategyId: number) => prepareEnrollment(t, strategyId);

/** 投入後：沒授權過的資產一次 approve 給 executor（owner 簽），然後請後端跑一輪配置。美股收盤時不會成交，排程會在開盤後買。 */
async function allocate(args: { token: string; wallet: RenewalWallet; account: Address; strategyId: number; portfolioId: number; step: Step }) {
  const fresh = await getPortfolioStatus(args.token, args.portfolioId).catch(() => null);
  const executor = fresh?.executorAddress as Address | null | undefined;
  const universe = fresh?.drift?.assets ?? [];
  if (executor && universe.length > 0) {
    const missing = (await Promise.all(universe.map(async (row) => {
      const allowance = await readOnlyClient().readContract({ address: row.asset as Address, abi: erc20Abi, functionName: 'allowance', args: [args.account, executor] }).catch(() => 0n);
      return allowance > 0n ? null : row;
    }))).filter((row) => row !== null);
    if (missing.length > 0) {
      args.step(L('Approve in your wallet so we can buy the assets', '在钱包里授权，才能买入资产'));
      await sendInBatches(missing, (batch) => sendSudoCalls({
        wallet: args.wallet, token: args.token, accountAddress: args.account, strategyId: args.strategyId,
        calls: batch.map((row) => ({ to: row!.asset as Address, data: approveCalldata(executor), value: 0n })),
      }));
    }
  }
  args.step(L('Placing your order', '正在下单'));
  try {
    const round = await postRebalance(args.token, args.portfolioId);
    if (round.outcome === 'executed') return { filled: true, note: null, txHash: round.txHash };
    const f = explainTradeFailure(round);
    return { filled: false, note: f.kind === 'nothing-to-do' ? null : tradeNote(f), txHash: null };
  } catch (cause) {
    return { filled: false, note: isZh() ? zhMessage((cause as Error).message, '下单没成功，资金已在你的组合账户里，稍后会自动买入。') : (cause as Error).message, txHash: null };
  }
}

/**
 * 買一檔基金。`pay`：'wallet'＝從錢包轉 USDT（金額 `amount`）；'faucet'＝測試網免費 USDT（第一次 10,000，之後每天 1,000，直接進這檔）。
 * 回 `{ filled }`：true＝這一輪就成交；false＝錢已進帳戶、等排程成交（美股開盤時段）。`pending`＝測試 USDT 還在路上。
 */
export const buy = localized(buyRaw, '买入没完成，再试一次。');
async function buyRaw(args: { strategyId: number; onchainId: number; shown?: { version: number; configHash: string } | null; amount?: string; pay: 'wallet' | 'faucet'; onStep?: Step }) {
  const step = args.onStep ?? (() => {});
  const { token: t, wallet, owner } = need();
  const busy = { onBusy: () => step(L('Setting up your account', '正在开通账户')) };
  const portfolio = await ensurePortfolio({ token: t, wallet, strategyId: args.strategyId, onchainId: args.onchainId, shown: args.shown ?? null, step });
  const account = portfolio.smartAccounts[0]?.address as Address | undefined;
  if (!account) throw new Error(L('The server returned no account for this portfolio.', '服务器没有返回这个组合的账户。'));
  let amountWei = 0n;
  if (args.pay === 'wallet') {
    amountWei = parseUnits(args.amount ?? '0', 18);
    if (amountWei <= 0n) throw new Error(L('Enter an amount.', '请输入金额。'));
    step(L('Getting the network fee', '正在准备 gas'));
    const reader = publicClientFor(wallet);
    await ensureOwnerGas({
      readBalance: () => reader.getBalance({ address: owner }),
      requestGas: () => postGasFaucet(t),
      waitForTx: async (h) => { await reader.waitForTransactionReceipt({ hash: h as Hex, confirmations: 1, timeout: 30_000 }); },
    });
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
  const result = await allocate({ token: t, wallet, account, strategyId: portfolio.strategyId, portfolioId: portfolio.id, step });
  return { ...result, pending: false, portfolioId: portfolio.id, amountUsdt: formatUnits(amountWei, 18) };
}

// ---- 賣 --------------------------------------------------------------------------------------
/**
 * 賣出 `usd`（美元）：後端分批賣成 USDT（`/redeem`），再由 owner 簽一筆把 USDT 從帳戶轉回錢包（cre8-app FundPage `withdraw`）。
 * 美股收盤時股票賣不動：回 `{ sentUsd, note }`，note 說明原因。
 */
export const sell = localized(sellRaw, '卖出没完成，再试一次。');
async function sellRaw(args: { portfolioId: number; usd: number; all?: boolean; onStep?: Step }) {
  const step = args.onStep ?? (() => {});
  const { token: t, wallet, owner } = need();
  const list = await getPortfolios(t);
  const holding = list.find((p) => p.id === args.portfolioId);
  const account = holding?.smartAccounts[0]?.address as Address | undefined;
  if (!holding || !account) throw new Error(L('Portfolio not found.', '找不到这个组合。'));
  step(L('Checking your portfolio', '正在检查持仓'));
  let latest: PortfolioStatus = await getPortfolioStatus(t, holding.id);
  const ceiling = totalUsdOf(latest.totalUsdE8);
  const wanted = Math.min(args.all ? ceiling : args.usd, ceiling);
  let note: string | null = null;
  const target = sellTargetUsd(wanted, cashUsdOf(latest.holdings ?? [], 'USDT'));
  if (target !== null) {
    step(L('Selling', '正在卖出'));
    try {
      const first = () => (args.all ? closePosition(t, holding.id) : redeemPortfolio(t, holding.id, target)) as Promise<RedeemResult>;
      const run = await runSellBatches({ first, next: (rest) => continueRedeem(t, holding.id, rest), maxBatches: MAX_SELL_BATCHES, onContinue: ({ batch }) => step(L(`Selling (batch ${batch})`, `正在卖出（第 ${batch} 批）`)) });
      if (afterSellRun(run) !== 'proceed' || run.status === 'stalled') note = tradeNote(explainTradeFailure({ outcome: run.lastOutcome, reason: run.lastReason }));
    } catch (cause) {
      if (!(cause instanceof SellBatchError)) throw cause;
      note = tradeNote(explainTradeFailure({ outcome: cause.outcome, reason: cause.message }));
    }
    latest = await getPortfolioStatus(t, holding.id);
  }
  const balance = await readOnlyClient().readContract({ address: USDT, abi: erc20Abi, functionName: 'balanceOf', args: [account] }).catch(() => 0n);
  const value = withdrawAmountWei(args.all ? formatUnits(balance, 18) : wanted.toFixed(8), balance, 18);
  if (value === 0n) return { sentUsdt: '0', note: note ?? L('Nothing could be sold right now.', '现在没有能卖出的部分。'), txHash: null };
  step(L('Approve in your wallet to receive your USDT', '在钱包里确认，领回 USDT'));
  const receipt = await sendWithdraw({ wallet, token: t, accountAddress: account, strategyId: holding.strategyId, asset: USDT, recipient: owner, amountWei: value });
  if (!receipt.success) throw new Error(L(`The transfer landed but reverted (${receipt.txHash}).`, `转账上链后被回滚（${receipt.txHash}）。`));
  return { sentUsdt: formatUnits(value, 18), note, txHash: receipt.txHash };
}

// ---- My mix（自建籃子） ---------------------------------------------------------------------
const mixApi = {
  list: (t: string) => apiRequest<{ mixes: unknown[] }>('/me/mixes', { token: t }),
  get: (t: string, id: number) => apiRequest<unknown>(`/me/mixes/${id}`, { token: t }),
  create: (t: string, input: unknown, key: string) => apiRequest<unknown>('/me/mixes', { method: 'POST', token: t, body: input, headers: { 'Idempotency-Key': key } }),
  patch: (t: string, id: number, body: unknown) => apiRequest<unknown>(`/me/mixes/${id}`, { method: 'PATCH', token: t, body }),
};
export const mixes = () => mixApi.list(token());
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
/** 放錢進組合：錢包轉帳（amount）或測試網每日 1,000 免費 USDT。 */
export const fundMixBasket = localized(fundMixBasketRaw, '充值没完成，再试一次。');
async function fundMixBasketRaw(args: { mixId: number; portfolioId: number; account: Address; pay: 'wallet' | 'faucet'; amount?: string; onStep?: Step }) {
  const step = args.onStep ?? (() => {});
  const { token: t, wallet } = need();
  step(args.pay === 'wallet' ? L('Approve the USDT transfer in your wallet', '在钱包里确认 USDT 转账') : L('Getting your test USDT', '正在领取测试 USDT'));
  const r = await fundMix({ wallet, token: t, account: args.account, mixId: args.mixId, portfolioId: args.portfolioId, with: args.pay === 'wallet' ? { kind: 'wallet', amount: parseUnits(args.amount ?? '0', 18) } : { kind: 'test-usdt' } });
  return r;
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
    NOTHING_TO_WITHDRAW: L('Nothing to withdraw.', '没有可领出的金额。'),
    TX_FAILED: L('The transaction didn’t go through. Nothing was moved.', '交易没成功，资金没动。'),
    INSUFFICIENT_HOLDING: L('This portfolio doesn’t hold enough of it yet.', '组合里的持仓还不够。'),
    MIX_NO_STRATEGY_EARN: L('Earn extra isn’t available for your own baskets.', '自建组合暂不支持加息。'),
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
    last = hash;
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
 * 領回到錢包（含利息）：`amount` 是 USDT 字串或 'max'。有好幾個 vault 部位時從大的開始領；
 * vault 當下流動性不夠時丟一句「現在最多可領 X」，不報錯碼（max 則先領能領的部分）。
 */
export const earnWithdraw = localized(earnWithdrawRaw, '领出没完成，再试一次。');
async function earnWithdrawRaw(args: { amount: string | 'max'; onStep?: Step }) {
  const step = args.onStep ?? (() => {});
  const { token: t, wallet, owner } = need();
  step(L('Checking your balance', '正在检查余额'));
  const acct = await earnApi<{ status: string; cashEarn: { positions: { vaultId: string; valueRaw: string | null; maxWithdrawRaw: string | null }[] } }>('/me/earn');
  if (acct.status !== 'ok') throw new Error(temporarily());
  const positions = acct.cashEarn.positions.filter((p) => p.valueRaw !== null && BigInt(p.valueRaw) > 0n).sort((a, b) => (BigInt(b.valueRaw!) > BigInt(a.valueRaw!) ? 1 : -1));
  if (positions.length === 0) throw new Error(L('Nothing to withdraw.', '没有可领出的金额。'));
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
      if (!p.partial) throw new Error(L(`You can withdraw up to ${max} USDT right now.`, `现在最多可领 ${max} USDT。`));
      calls = p.partial.calls; amountRaw = p.partial.amountRaw;
      note = L(`Only ${max} USDT could be withdrawn right now. Try the rest later.`, `现在只能领 ${max} USDT，其余稍后再领。`);
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
  return receipt.txHash;
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
  if (held.length === 0) return { opened: [] as string[] };
  const calls: EarnCall[] = [], opened: string[] = [];
  for (const h of held) {
    const r = await earnApi<{ status: string; calls?: EarnCall[] }>(`/portfolios/${args.portfolioId}/strategy-earn/open`, { method: 'POST', body: { asset: h.symbol, collateralRaw: h.amountWei } });
    if (r.status === 'ready' && r.calls?.length) { calls.push(...r.calls); opened.push(h.symbol); }
  }
  if (calls.length === 0) throw new Error(temporarily());
  step(L('Approve in your wallet to turn on Earn extra', '在钱包里确认，开启加息'));
  await sendStrategyCalls(t, wallet, args.portfolioId, calls);
  return { opened };
}

/** 關閉加息（關掉、或賣出前）：每個開著的資產先還款再取回抵押，合成一筆 UserOp。沒有開著的就什麼都不送。 */
export const strategyClose = localized(strategyCloseRaw, '加息没结清，再试一次。');
async function strategyCloseRaw(args: { portfolioId: number; onStep?: Step }) {
  const step = args.onStep ?? (() => {});
  const { token: t, wallet } = need();
  const pos = await earnApi<{ status: string; positions: StrategyPosition[] }>(`/portfolios/${args.portfolioId}/strategy-earn`);
  if (pos.status !== 'ok') throw new Error(temporarily());
  const on = pos.positions.filter((p) => p.status === 'on');
  if (on.length === 0) return { closed: [] as string[] };
  const calls: EarnCall[] = [];
  for (const p of on) {
    const r = await earnApi<{ status: string; calls?: EarnCall[] }>(`/portfolios/${args.portfolioId}/strategy-earn/close`, { method: 'POST', body: { asset: p.asset } });
    if (r.status !== 'ready' || !r.calls?.length) throw new Error(temporarily());
    calls.push(...r.calls);
  }
  step(L('Approve in your wallet to settle Earn extra', '在钱包里确认，结清加息'));
  await sendStrategyCalls(t, wallet, args.portfolioId, calls);
  return { closed: on.map((p) => p.asset) };
}

export const chain = { id: CHAIN.id, usdt: USDT, explorer: CHAIN.explorerUrl };
export { transferCalldata };

// IIFE 沒有匯出：掛到 window，通知 app.html。
(window as unknown as { CRE8W: unknown }).CRE8W = {
  mount, subscribe, get, setInvite, waitlistMe, joinWaitlist, waitlistTasks, completeWaitlistTask, redeemInvite, signInWith, sendEmailCode, submitEmailCode, signInWallet, retry, logout, link, exportWallet,
  portfolios, status, activity, walletUsdt, buy, sell, mixes, mix, createMix, fundMixBasket, patchMix, chain,
  earn, earnDeposit, earnWithdraw, strategyEarn, strategyOpen, strategyClose,
  /** 頁面換語言後呼叫：重推一次快照，讓錯誤訊息換成新語言。 */
  relang: () => { if (mounted) emit(); },
};
window.dispatchEvent(new Event('cre8w:ready'));
