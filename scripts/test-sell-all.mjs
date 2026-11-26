#!/usr/bin/env node
/**
 * 「全部賣出」迴圈的測試（scripts/vendor/web-sell-all.ts）：用假的後端回應序列，不碰網路。
 *
 *   node scripts/test-sell-all.mjs        （Node 23.6 以上：直接載入 .ts）
 */
import assert from 'node:assert/strict';
import { runSellAll, freshCash, earnFreedNoSale, SELL_ALL_MAX_MS, SELL_ALL_PAUSE_MS } from './vendor/web-sell-all.ts';

const UNWOUND = '[STRATEGY_EARN_UNWINDING] 賣出前已還款取回：BTCB short of USD1: repay 19273906820428080538, take back 1436520336693309 of 1465837156930186; the sale pays the rest tx=0x4889；下一輪再賣';
const round = (outcome, reason, extra = {}) => ({ outcome, reason, txHash: null, ...extra });
const tx = (n) => '0x' + String(n).repeat(64).slice(0, 64);

/** 假的後端：照順序回 `rounds`；每輪花 `roundMs`。回傳紀錄（呼叫幾次、畫面文字、睡了多久）。 */
function fake(rounds, { roundMs = 15_000 } = {}) {
  let clock = 1_000_000, calls = 0;
  const steps = [], sleeps = [];
  const options = {
    close: async () => {
      const next = rounds[Math.min(calls, rounds.length - 1)];
      calls += 1; clock += roundMs;
      if (next instanceof Error) throw next;
      return typeof next === 'function' ? next() : next;
    },
    now: () => clock,
    sleep: async (ms) => { sleeps.push(ms); clock += ms; },
    onUnwind: () => steps.push('unwind'),
    onBatch: (batch) => steps.push('batch ' + batch),
  };
  return { options, steps, sleeps, calls: () => calls, elapsed: () => clock - 1_000_000 };
}

const tests = [];
const test = (name, body) => tests.push([name, body]);

test('portfolio 37 的順序：還款取回 → 賣閒置（還有抵押，不是賣完）→ 補差額關閉 → 賣剩下 → 後端說賣完才結束', async () => {
  const f = fake([
    round('blocked', UNWOUND, { sellAllPending: true, sellAllDone: false, remainingUsdE8: '9958533657' }),
    // 以前這一輪回 remainingUsdE8 "0"，前端就領回了。現在後端說還有約 2%（還抵押著），也明說還沒賣完。
    round('executed', 'Landed on-chain: tx 0xd860', { txHash: tx(1), sellAllPending: true, sellAllDone: false, remainingUsdE8: '199171198' }),
    round('blocked', '[STRATEGY_EARN_UNWINDING] 賣出前已還款取回：BTCB top up 407371640080 USD1 from USDT, repay 407371640081 USD1, take back, sell the USD1 left tx=0xbb；下一輪再賣', { sellAllPending: true, sellAllDone: false }),
    round('executed', 'Landed on-chain: tx 0x17f7', { txHash: tx(2), sellAllPending: true, sellAllDone: true, remainingUsdE8: '0' }),
  ]);
  const run = await runSellAll(f.options);
  assert.deepEqual([run.status, run.rounds, run.sold, run.soldTx], ['done', 4, 2, tx(2)]);
  assert.equal(f.calls(), 4, '賣完就不再呼叫');
  assert.deepEqual(f.steps, ['unwind', 'batch 2', 'unwind'], '沿用既有的進度文字');
  assert.deepEqual(f.sleeps, [SELL_ALL_PAUSE_MS, SELL_ALL_PAUSE_MS], '成交後直接接下一輪，還款取回後稍等');
});

test('remainingUsdE8 是 "0" 但後端沒說賣完（舊的回應形狀、或抵押還在）：不算賣完，繼續呼叫', async () => {
  const f = fake([
    round('executed', 'Landed', { txHash: tx(1), sellAllPending: true, sellAllDone: false, remainingUsdE8: '0' }),
    round('noop', 'nothing to sell', { sellAllPending: false, sellAllDone: true, remainingUsdE8: '0' }),
  ]);
  const run = await runSellAll(f.options);
  assert.deepEqual([run.status, run.rounds, run.sold, run.soldTx], ['done', 2, 1, tx(1)]);
});

test('沒有加息的全部賣出：一輪成交、後端說賣完 → 一次就結束（跟以前一樣快）', async () => {
  const f = fake([round('executed', 'Landed', { txHash: tx(1), sellAllPending: true, sellAllDone: true, remainingUsdE8: '0' })]);
  const run = await runSellAll(f.options);
  assert.deepEqual([run.status, run.rounds, f.steps, f.sleeps], ['done', 1, [], []]);
});

test('帳戶只剩 USDT（之前沒做完、後端後來自己賣完了）：再按一次全部賣出 → 一輪 noop 就是賣完，可以直接領回', async () => {
  const f = fake([round('noop', 'nothing to sell', { sellAllPending: false, sellAllDone: true, remainingUsdE8: '0' })]);
  const run = await runSellAll(f.options);
  assert.deepEqual([run.status, run.rounds, run.sold, run.soldTx], ['done', 1, 0, null]);
});

test('大單分好幾批：每批成交後接著呼叫 `/close`，顯示第 N 批', async () => {
  const f = fake([
    round('executed', 'Landed', { txHash: tx(1), sellAllPending: true, sellAllDone: false, remainingUsdE8: '300' }),
    round('executed', 'Landed', { txHash: tx(2), sellAllPending: true, sellAllDone: false, remainingUsdE8: '100' }),
    round('executed', 'Landed', { txHash: tx(3), sellAllPending: true, sellAllDone: true, remainingUsdE8: '0' }),
  ]);
  const run = await runSellAll(f.options);
  assert.deepEqual([run.status, run.sold, run.soldTx, f.steps], ['done', 3, tx(3), ['batch 2', 'batch 3']]);
});

test('中途 504 之後由交易紀錄補出來的結果（沒有 sellAllDone 欄位）：不當成賣完，再問一輪拿真正的狀態', async () => {
  const f = fake([
    round('blocked', UNWOUND, { sellAllPending: true, sellAllDone: false }),
    // wallet-entry 的 roundOrLanded 在 504 後看到成交紀錄時補出來的形狀。
    { portfolioId: 37, outcome: 'executed', reason: '', txHash: tx(1), steps: [], redeemedUsdE8: '0', remainingUsdE8: '0' },
    round('blocked', UNWOUND, { sellAllPending: true, sellAllDone: false }),
    round('executed', 'Landed', { txHash: tx(2), sellAllPending: true, sellAllDone: true, remainingUsdE8: '0' }),
  ]);
  const run = await runSellAll(f.options);
  assert.deepEqual([run.status, run.rounds, run.sold, run.soldTx], ['done', 4, 2, tx(2)]);
});

test('504 一路沒接上（丟出錯誤）：錯誤照樣丟給畫面，不會走到領回', async () => {
  const gateway = Object.assign(new Error('The server took too long to respond.'), { status: 504 });
  const f = fake([round('blocked', UNWOUND, { sellAllPending: true, sellAllDone: false }), gateway]);
  await assert.rejects(runSellAll(f.options), /took too long/);
  assert.equal(f.calls(), 2);
});

test('超過時間上限還沒賣完：停下來、不算賣完（不領回）；後端記著這筆，之後再按一次', async () => {
  // 每輪 40 秒，一直在還款取回／成交之間，沒有賣完。
  const f = fake([
    round('blocked', UNWOUND, { sellAllPending: true, sellAllDone: false }),
    round('executed', 'Landed', { txHash: tx(1), sellAllPending: true, sellAllDone: false, remainingUsdE8: '500' }),
  ], { roundMs: 40_000 });
  const run = await runSellAll(f.options);
  assert.equal(run.status, 'unfinished');
  assert.ok(f.elapsed() >= SELL_ALL_MAX_MS && f.elapsed() < SELL_ALL_MAX_MS + 60_000, String(f.elapsed()));
  assert.ok(run.rounds >= 5 && run.rounds <= 6, String(run.rounds));
  assert.equal(SELL_ALL_MAX_MS, 210_000);
});

test('通道一直忙（DEX_QUEUED）：繼續問到時間上限；後端記著 → 不領回，沒記著 → 照被擋收尾', async () => {
  const busy = (pending) => round('blocked', '[DEX_QUEUED] 共用市場正處理另一基金，稍後重報價', { sellAllPending: pending, sellAllDone: false, remainingUsdE8: null });
  const kept = fake([round('blocked', UNWOUND, { sellAllPending: true, sellAllDone: false }), busy(true)], { roundMs: 72_000 });
  assert.deepEqual([(await runSellAll(kept.options)).status, kept.steps], ['unfinished', ['unwind']]);
  const fresh = fake([busy(false)], { roundMs: 72_000 });
  const stopped = await runSellAll(fresh.options);
  assert.deepEqual([stopped.status, stopped.sold, stopped.lastOutcome], ['stopped', 0, 'blocked']);
  // 忙了一輪之後就接上：照常做完。
  const through = fake([busy(false), round('executed', 'Landed', { txHash: tx(1), sellAllPending: true, sellAllDone: true, remainingUsdE8: '0' })]);
  assert.equal((await runSellAll(through.options)).status, 'done');
});

test('第一輪就被擋而且後端沒留單（休市、價格源）：停在 stopped，原因交給畫面；再呼叫也一樣所以不重試', async () => {
  for (const reason of ['[MARKET_CLOSED] 股票休市，等待交易時段', 'StaleFeed(0xabc)', '沒有可執行的賣出步驟：待賣量換算後為 0']) {
    const f = fake([round('blocked', reason, { sellAllPending: false, sellAllDone: false, remainingUsdE8: null })]);
    const run = await runSellAll(f.options);
    assert.deepEqual([run.status, run.rounds, run.lastReason], ['stopped', 1, reason]);
  }
});

test('賣到一半某一輪被擋（抵押品還取不回、補差額額度用完、休市）：後端記著 → unfinished，不領回', async () => {
  for (const reason of ['[STRATEGY_EARN_UNWINDING] BTCB cannot be freed yet: the box and the account hold 0 USD1 against a debt of 407371640080', '[STRATEGY_TOPUP_WINDOW] 24 小時補差額額度用完', '[MARKET_CLOSED] 股票休市，等待交易時段']) {
    const f = fake([
      round('blocked', UNWOUND, { sellAllPending: true, sellAllDone: false }),
      round('executed', 'Landed', { txHash: tx(1), sellAllPending: true, sellAllDone: false, remainingUsdE8: '199171198' }),
      round('blocked', reason, { sellAllPending: true, sellAllDone: false, remainingUsdE8: '199171198' }),
    ]);
    const run = await runSellAll(f.options);
    assert.deepEqual([run.status, run.rounds, run.sold, run.soldTx, run.lastOutcome], ['unfinished', 3, 1, tx(1), 'blocked'], reason);
  }
  // 交易上鏈後被回滾：一樣停下（後端有重試的節制），不在前端連續重送。
  const f = fake([round('executed', 'Landed', { txHash: tx(1), sellAllPending: true, sellAllDone: false, remainingUsdE8: '5' }), round('reverted', '上鏈但沒有成功', { sellAllPending: true, sellAllDone: false })]);
  assert.equal((await runSellAll(f.options)).status, 'unfinished');
});

test('領回前的可領金額：後端還停在賣出之前的區塊就重讀，讀到賣出之後的那一份才用（portfolio 39）', async () => {
  // 賣出在區塊 105。後端前兩次還在 104（只看到賣出前的 1.24），第三次到 105（39.60）。
  const reads = [{ block: 104n, free: 124n }, { block: 104n, free: 124n }, { block: 105n, free: 3960n }, { block: 106n, free: 3960n }];
  let i = 0; const sleeps = [];
  const cash = await freshCash({ read: async () => reads[i++], fresh: (c) => c.block >= 105n, sleep: async (ms) => { sleeps.push(ms); } });
  assert.deepEqual([cash.free, i, sleeps.length], [3960n, 3, 2]);
  // 這次沒有賣出（帳戶本來就只剩 USDT）：讀一次就好。
  i = 0;
  assert.equal((await freshCash({ read: async () => reads[i++], fresh: () => true, sleep: async () => { throw new Error('不該等'); } })).free, 124n);
  assert.equal(i, 1);
  // 一直追不上：有上限，回最後讀到的那一份（代付仍會擋多領）。
  let n = 0;
  const stale = await freshCash({ read: async () => { n += 1; return { block: 104n, free: 124n }; }, fresh: (c) => c.block >= 105n, sleep: async () => {}, tries: 5 });
  assert.deepEqual([stale.free, n], [124n, 5]);
  // 讀不到（null）不算一份：繼續讀；全都讀不到回 null（呼叫端照舊用帳戶餘額）。
  const seq = [null, { block: 105n, free: 7n }]; let k = 0;
  assert.equal((await freshCash({ read: async () => seq[k++], fresh: (c) => c.block >= 105n, sleep: async () => {} })).free, 7n);
  assert.equal(await freshCash({ read: async () => null, fresh: () => true, sleep: async () => {}, tries: 3 }), null);
});

test('部分賣出：還款取回上鏈了、賣出沒成交的一輪認得出來（portfolio 55），不會被當成「沒有發出交易」', async () => {
  // 新後端：回應帶 earnFreed；原因開頭是還款取回、後面括號裡才是賣出沒成交的原因（含會被說成「资金没动」的代碼）。
  const stranded = round('blocked', '[STRATEGY_EARN_UNWINDING] 賣出前已還款取回：COINB repay 4000573772342472832 of 9801405742239058437 USDT, take back 4 of 10; the position stays open tx=0x3991；下一輪再賣（這次賣出還沒成交：Send failed (nothing landed): [STRATEGY_EXECUTION_UNAVAILABLE] 無法確認執行結果）', { earnFreed: true });
  assert.equal(earnFreedNoSale(stranded), true);
  // 送出了但結果未知：原因是「送出結果未知」，靠 earnFreed 認。
  assert.equal(earnFreedNoSale(round('blocked', '送出結果未知，保留在途，下一輪先對帳，不重送：receipt timeout', { earnFreed: true })), true);
  // 舊後端（沒有 earnFreed）：只有原因裡的「賣出前已還款取回」。
  assert.equal(earnFreedNoSale(round('blocked', UNWOUND)), true);
  // 成交的一輪、跟加息無關的失敗、只是「需要先還款取回但沒送出」：都不是。
  assert.equal(earnFreedNoSale(round('executed', 'Landed on-chain: tx 0xd860', { earnFreed: true })), false);
  assert.equal(earnFreedNoSale(round('failed', 'Send failed (nothing landed): [STRATEGY_EXECUTION_UNAVAILABLE] 無法確認執行結果')), false);
  assert.equal(earnFreedNoSale(round('blocked', '[STRATEGY_EARN_UNWINDING] 賣出前需先還款取回：DOGE（沒有策略加息 session 權限，等 owner 續期，未送出）')), false);
  assert.equal(earnFreedNoSale(round('blocked', '[MARKET_CLOSED] 股票休市，等待交易時段')), false);
});

let failed = 0;
for (const [name, body] of tests) {
  try { await body(); console.log('ok   ' + name); }
  catch (error) { failed += 1; console.log('FAIL ' + name + '\n' + (error && error.stack ? error.stack : error)); }
}
console.log(`${tests.length - failed} pass, ${failed} fail`);
if (failed > 0) process.exit(1);
