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
    emailError: p.emailError ? String((p.emailError as Error).message ?? p.emailError) : null,
    error: p.phase === 'error' && err ? (err.code ?? null) : null,
    errorText: p.phase === 'error' && err ? String(err.message ?? err) : null,
    oauthError: p.oauthError ? String((p.oauthError as Error).message ?? p.oauthError) : null,
    linkError: p.linkError,
    hasX: p.methods.some((m) => m.kind === 'x'),
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
        if (cause.code === 'X_REQUIRED') { waitlist = { state: 'error', message: 'Right now invite codes only work with X. Sign out and continue with X.' }; emit(); return; }
        // 碼不能用（錯、用過、過期）：照一般排隊，並說明。
        body = await postWaitlistJoin(p.identityToken);
        const r = parseWaitlist(body);
        waitlist = { state: r?.status === 'approved' ? 'approved' : 'waiting', message: cause.code === 'ALREADY_APPROVED' ? null : 'That invite code didn’t work, so you joined the waitlist instead.' };
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
    waitlist = { state: 'error', message: code409 === 'X_REQUIRED' ? 'CRE8 is invite-only. Sign in with X and enter your invite code.' : (cause as Error).message };
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
  if (a === null) throw new Error('Sign-in is still loading. Try again in a moment.');
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
  if (!s.signedIn || s.token === null || s.address === null) throw new Error('Sign in first.');
  const w = useWallet.getState();
  if (w.kind !== 'injected' || w.provider === null || w.address === null || w.address.toLowerCase() !== s.address.toLowerCase()) {
    throw new Error('Your wallet is still connecting. Try again in a moment.');
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
/** 加入（`POST /waitlist/join`，冪等）。已放行就讓 PrivyRoot 重換 session。 */
export async function joinWaitlist() {
  const t = identityToken();
  if (t === null) throw new Error('Connect X first.');
  const record = parseWaitlist(await postWaitlistJoin(t));
  if (record?.status === 'approved') signalWaitlistApproved();
  return record;
}

// ---- 讀資料 ----------------------------------------------------------------------------------
const token = () => { const t = get().token; if (t === null) throw new Error('Sign in first.'); return t; };
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
  args.step('Setting up your account');
  const registry = CHAIN.contracts?.registry as Address, executor = CHAIN.contracts?.executor as Address;
  const prepared = await waitForPreparation(() => apiPrepare(args.token, args.strategyId));
  if (args.shown !== null) assertShownVersion(args.shown, prepared);
  await waitForAccountCode((address) => readOnlyClient().getCode({ address }), prepared.account);
  const calls = await firstEnrollCalls(readOnlyClient(), { registry, executor, usdt: USDT, account: prepared.account, id: BigInt(args.onchainId), expectedVersion: prepared.expectedVersion, configHash: prepared.configHash });
  if (calls !== null) {
    args.step('Approve in your wallet to join this portfolio');
    const joined = await sendSudoCalls({ wallet: args.wallet, token: args.token, accountAddress: prepared.account, strategyId: args.strategyId, calls });
    if (!joined.success) throw new Error(`Joining landed on-chain but reverted (${joined.txHash}). Nothing was transferred.`);
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
      args.step('Approve in your wallet so we can buy the assets');
      await sendInBatches(missing, (batch) => sendSudoCalls({
        wallet: args.wallet, token: args.token, accountAddress: args.account, strategyId: args.strategyId,
        calls: batch.map((row) => ({ to: row!.asset as Address, data: approveCalldata(executor), value: 0n })),
      }));
    }
  }
  args.step('Placing your order');
  try {
    const round = await postRebalance(args.token, args.portfolioId);
    if (round.outcome === 'executed') return { filled: true, note: null, txHash: round.txHash };
    const f = explainTradeFailure(round);
    return { filled: false, note: f.kind === 'nothing-to-do' ? null : f.summary, txHash: null };
  } catch (cause) {
    return { filled: false, note: (cause as Error).message, txHash: null };
  }
}

/**
 * 買一檔基金。`pay`：'wallet'＝從錢包轉 USDT（金額 `amount`）；'faucet'＝測試網免費 USDT（第一次 10,000，之後每天 1,000，直接進這檔）。
 * 回 `{ filled }`：true＝這一輪就成交；false＝錢已進帳戶、等排程成交（美股開盤時段）。`pending`＝測試 USDT 還在路上。
 */
export async function buy(args: { strategyId: number; onchainId: number; shown?: { version: number; configHash: string } | null; amount?: string; pay: 'wallet' | 'faucet'; onStep?: Step }) {
  const step = args.onStep ?? (() => {});
  const { token: t, wallet, owner } = need();
  const busy = { onBusy: () => step('Setting up your account') };
  const portfolio = await ensurePortfolio({ token: t, wallet, strategyId: args.strategyId, onchainId: args.onchainId, shown: args.shown ?? null, step });
  const account = portfolio.smartAccounts[0]?.address as Address | undefined;
  if (!account) throw new Error('The server returned no account for this portfolio.');
  let amountWei = 0n;
  if (args.pay === 'wallet') {
    amountWei = parseUnits(args.amount ?? '0', 18);
    if (amountWei <= 0n) throw new Error('Enter an amount.');
    step('Getting the network fee');
    const reader = publicClientFor(wallet);
    await ensureOwnerGas({
      readBalance: () => reader.getBalance({ address: owner }),
      requestGas: () => postGasFaucet(t),
      waitForTx: async (h) => { await reader.waitForTransactionReceipt({ hash: h as Hex, confirmations: 1, timeout: 30_000 }); },
    });
    step('Approve the USDT transfer in your wallet');
    const hash = await sendUsdt(wallet, account, amountWei);
    step('Waiting for the network');
    const receipt = await reader.waitForTransactionReceipt({ hash, confirmations: 2, timeout: 60_000 });
    if (receipt.status !== 'success') throw new Error(`The transfer was rejected by the network (${hash}).`);
    await retryWhileBusy(() => postFundingLot(t, portfolio.id, { kind: 'wallet_transfer', txHash: hash }), busy);
  } else {
    step('Getting your test USDT');
    let welcome = null as Awaited<ReturnType<typeof postBuyFunding>> | null;
    try {
      welcome = await retryWhileBusy(() => postBuyFunding(t, portfolio.id), busy);
    } catch (cause) {
      if (!needsDailyFaucet(cause)) throw cause;
    }
    if (welcome?.state === 'pending') return { filled: false, pending: true, portfolioId: portfolio.id, amountUsdt: '10000', note: 'Your 10,000 test USDT is on its way. Press Buy again in a minute to finish.' };
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
export async function sell(args: { portfolioId: number; usd: number; all?: boolean; onStep?: Step }) {
  const step = args.onStep ?? (() => {});
  const { token: t, wallet, owner } = need();
  const list = await getPortfolios(t);
  const holding = list.find((p) => p.id === args.portfolioId);
  const account = holding?.smartAccounts[0]?.address as Address | undefined;
  if (!holding || !account) throw new Error('Portfolio not found.');
  step('Checking your portfolio');
  let latest: PortfolioStatus = await getPortfolioStatus(t, holding.id);
  const ceiling = totalUsdOf(latest.totalUsdE8);
  const wanted = Math.min(args.all ? ceiling : args.usd, ceiling);
  let note: string | null = null;
  const target = sellTargetUsd(wanted, cashUsdOf(latest.holdings ?? [], 'USDT'));
  if (target !== null) {
    step('Selling');
    try {
      const first = () => (args.all ? closePosition(t, holding.id) : redeemPortfolio(t, holding.id, target)) as Promise<RedeemResult>;
      const run = await runSellBatches({ first, next: (rest) => continueRedeem(t, holding.id, rest), maxBatches: MAX_SELL_BATCHES, onContinue: ({ batch }) => step(`Selling (batch ${batch})`) });
      if (afterSellRun(run) !== 'proceed' || run.status === 'stalled') note = explainTradeFailure({ outcome: run.lastOutcome, reason: run.lastReason }).summary;
    } catch (cause) {
      if (!(cause instanceof SellBatchError)) throw cause;
      note = explainTradeFailure({ outcome: cause.outcome, reason: cause.message }).summary;
    }
    latest = await getPortfolioStatus(t, holding.id);
  }
  const balance = await readOnlyClient().readContract({ address: USDT, abi: erc20Abi, functionName: 'balanceOf', args: [account] }).catch(() => 0n);
  const value = withdrawAmountWei(args.all ? formatUnits(balance, 18) : wanted.toFixed(8), balance, 18);
  if (value === 0n) return { sentUsdt: '0', note: note ?? 'Nothing could be sold right now.', txHash: null };
  step('Approve in your wallet to receive your USDT');
  const receipt = await sendWithdraw({ wallet, token: t, accountAddress: account, strategyId: holding.strategyId, asset: USDT, recipient: owner, amountWei: value });
  if (!receipt.success) throw new Error(`The transfer landed but reverted (${receipt.txHash}).`);
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
export async function createMix(args: { input: MixInput; key: string; onStep?: Step }) {
  const step = args.onStep ?? (() => {});
  const { token: t, wallet } = need();
  step('Creating your basket');
  const created = await mixApi.create(t, args.input, args.key) as Parameters<typeof freshCreationPayload>[1];
  const payload = await freshCreationPayload(t, created);
  if (payload === null) return { mixId: created.mixId, account: created.account, portfolioId: null };
  step('Approve in your wallet to start your basket');
  return signMix({ wallet, token: t, payload, picks: args.input.assets, onStage: (s) => s === 'confirm' && step('Confirming') });
}
/** 放錢進組合：錢包轉帳（amount）或測試網每日 1,000 免費 USDT。 */
export async function fundMixBasket(args: { mixId: number; portfolioId: number; account: Address; pay: 'wallet' | 'faucet'; amount?: string; onStep?: Step }) {
  const step = args.onStep ?? (() => {});
  const { token: t, wallet } = need();
  step(args.pay === 'wallet' ? 'Approve the USDT transfer in your wallet' : 'Getting your test USDT');
  const r = await fundMix({ wallet, token: t, account: args.account, mixId: args.mixId, portfolioId: args.portfolioId, with: args.pay === 'wallet' ? { kind: 'wallet', amount: parseUnits(args.amount ?? '0', 18) } : { kind: 'test-usdt' } });
  return r;
}
/** 改名、頻率（不用簽）或成分（要簽一次，立刻生效）。 */
export async function patchMix(args: { id: number; patch: Partial<MixInput>; onStep?: Step }) {
  const step = args.onStep ?? (() => {});
  const { token: t, wallet } = need();
  const result = await mixApi.patch(t, args.id, args.patch) as Record<string, unknown>;
  if (!('intentId' in result)) return { signed: false, mix: result };
  step('Approve in your wallet to apply the new weights');
  await signMix({ wallet, token: t, payload: result, picks: args.patch.assets, onStage: (s) => s === 'confirm' && step('Confirming') });
  return { signed: true, mix: null };
}

export const chain = { id: CHAIN.id, usdt: USDT, explorer: CHAIN.explorerUrl };
export { transferCalldata };

// IIFE 沒有匯出：掛到 window，通知 app.html。
(window as unknown as { CRE8W: unknown }).CRE8W = {
  mount, subscribe, get, setInvite, waitlistMe, joinWaitlist, signInWith, sendEmailCode, submitEmailCode, signInWallet, retry, logout, link, exportWallet,
  portfolios, status, activity, walletUsdt, buy, sell, mixes, mix, createMix, fundMixBasket, patchMix, chain,
};
window.dispatchEvent(new Event('cre8w:ready'));
