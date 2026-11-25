/**
 * 「全部賣出」的迴圈（純邏輯：不碰 fetch、不碰錢包，`node scripts/test-sell-all.mjs` 直接測）。
 * scripts/build-vendor.ts 會把這個檔案跟 wallet-entry.tsx 一起放進打包用的資料夾。
 *
 * 背景（2026-11-25 測試網 portfolio 37）：開著加息時，全部賣出要好幾輪 `/close`——還款取回大部分、賣掉取回的、
 * 用賣出所得補差額並取回剩下的抵押、再賣掉。以前第二輪回 `remainingUsdE8: "0"`（其實還有約 2% 抵押著）前端就領回，
 * 把補差額要用的 USDT 領走，剩下的抵押品賣不掉。
 *
 * 規則：一直呼叫 `/close`，後端說 `sellAllDone: true`（沒有抵押、沒有負債、沒有可賣的）才算賣完，賣完才領回。
 * 沒賣完就停下來時（超過時間上限、或某一輪被擋）不領回：後端記著這筆全部賣出（`sellAllPending`），排程器會接著做完，
 * 之後再按一次全部賣出就直接領回。
 */

export type CloseRound = {
  outcome: 'executed' | 'noop' | 'blocked' | 'reverted' | 'failed';
  reason: string;
  txHash?: string | null;
  /** 全部賣出還開著：後端自己會接著賣，再呼叫只是接續。 */
  sellAllPending?: boolean;
  /** 真的賣完了。沒有這個欄位（504 之後由交易紀錄補出來的結果）一律當成還沒賣完，再問一次。 */
  sellAllDone?: boolean;
};

export type SellAllRun = {
  /**
   * - `done`       賣完了：可以領回。
   * - `unfinished` 還沒賣完，後端記著、會自己做完：這次不領回。
   * - `stopped`    還沒賣完，而且後端沒有記著（第一輪什麼都沒做成就被擋，例如休市）：照被擋的原因收尾。
   */
  status: 'done' | 'unfinished' | 'stopped';
  /** 一共呼叫了幾輪 `/close`。 */
  rounds: number;
  /** 成交了幾批。 */
  sold: number;
  /** 最後一筆成交的交易（沒有成交是 null）。 */
  soldTx: string | null;
  lastOutcome: CloseRound['outcome'];
  lastReason: string;
};

/** 這一輪只做了還款取回（已上鏈），資產下一輪才賣：接著呼叫。 */
export const UNWOUND = /^\[STRATEGY_EARN_UNWINDING\] 賣出前已還款取回/;
/** 排程器正在處理別的基金或這一檔：什麼都沒送，等一下再問。 */
export const SCHEDULER_BUSY = /^\[(DEX_QUEUED|PORTFOLIO_LOCK_BUSY)\]/;

/** 一次點擊最多做多久（毫秒）。排程器一輪要幾分鐘，前端連續呼叫比等它快；超過就交給後端做完。 */
export const SELL_ALL_MAX_MS = 210_000;
/** 還款取回、或通道忙之後，隔多久再問下一輪。 */
export const SELL_ALL_PAUSE_MS = 3_000;

export async function runSellAll(options: {
  /** 一輪 `/close`（504 與通道忙的短暫重問由呼叫端包好）。 */
  close: () => Promise<CloseRound>;
  now: () => number;
  sleep: (ms: number) => Promise<unknown>;
  maxMs?: number;
  /** 這一輪是還款取回，接著要賣：顯示「正在结清加息策略，然后卖出」。 */
  onUnwind?: () => void;
  /** 要賣第 `batch` 批之前（第一批不叫）：顯示「正在卖出（第 N 批）」。 */
  onBatch?: (batch: number) => void;
}): Promise<SellAllRun> {
  const maxMs = options.maxMs ?? SELL_ALL_MAX_MS;
  const started = options.now();
  let rounds = 0;
  let sold = 0;
  let soldTx: string | null = null;
  for (;;) {
    const r = await options.close();
    rounds += 1;
    if (r.outcome === 'executed') {
      sold += 1;
      if (r.txHash) soldTx = r.txHash;
    }
    const end = (status: SellAllRun['status']): SellAllRun => ({ status, rounds, sold, soldTx, lastOutcome: r.outcome, lastReason: r.reason });
    if (r.sellAllDone === true) return end('done');
    // 後端記著這筆全部賣出；504 之後補出來的結果沒有這個欄位，那一輪是成交了的，後端一定記著。
    const kept = r.sellAllPending === true || (r.sellAllPending === undefined && r.outcome === 'executed');
    const unwound = r.outcome === 'blocked' && UNWOUND.test(r.reason);
    const busy = r.outcome === 'blocked' && SCHEDULER_BUSY.test(r.reason);
    // 其他被擋的原因（休市、價格源、抵押品還取不回…）再問也一樣：停下來。
    if (r.outcome !== 'executed' && !unwound && !busy) return end(kept ? 'unfinished' : 'stopped');
    if (options.now() - started >= maxMs) return end(kept ? 'unfinished' : 'stopped');
    if (r.outcome === 'executed') options.onBatch?.(sold + 1);
    else {
      if (unwound) options.onUnwind?.();
      await options.sleep(SELL_ALL_PAUSE_MS);
    }
  }
}

/**
 * 賣出落地後，後端讀到的帳戶現金可能還停在賣出之前那個區塊（它的節點慢一兩個區塊）：那時「可領金額」少了剛賣出的所得，
 * 前端照它領就只領到零頭，還把差額說成「留給進行中的買入」（2026-11-26 portfolio 39：賣了 38.36，只領回 1.24）。
 * 所以領回前要讀到賣出之後的那一份：`fresh` 說還不是就稍等重讀，最多 `tries` 次。
 * 讀不到（null）或一直追不上：回最後一次讀到的（呼叫端照舊用它，代付那邊仍會擋）。
 */
export async function freshCash<T>(options: {
  read: () => Promise<T | null>;
  /** 這一份是不是賣出之後的（例如它的區塊不早於賣出那筆交易的區塊）。 */
  fresh: (cash: T) => boolean;
  sleep: (ms: number) => Promise<unknown>;
  tries?: number;
  pauseMs?: number;
}): Promise<T | null> {
  const tries = Math.max(1, options.tries ?? 6);
  let last: T | null = null;
  for (let i = 0; i < tries; i++) {
    if (i > 0) await options.sleep(options.pauseMs ?? 2_000);
    const next = await options.read();
    if (next === null) continue;
    last = next;
    if (options.fresh(next)) return next;
  }
  return last;
}
