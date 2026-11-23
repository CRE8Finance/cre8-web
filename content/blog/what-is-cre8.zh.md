---
title: CRE8 是什么？用 USDT 一次买一篮美股和加密资产
slug: /zh/blog/what-is-cre8
lang: zh-Hans
author: CRE8
published: 2026-11-23
updated: 2026-11-23
status: 草稿（产品介绍，第 10 篇）
---

# CRE8 是什么？用 USDT 一次买一篮美股和加密资产

作者：CRE8 · 2026 年 11 月 23 日 · 阅读约 8 分钟

CRE8（cre8.finance）是 BNB Chain 上的应用，用 USDT 一次买入美股代币和加密资产组合，资产放在你自己的智能账户里，还能开启加息策略，让 bStock 多赚一份收益。买入后组合会自动调仓，维持原来的比例。截至 2026 年 11 月 23 日，CRE8 只在 BNB Chain 测试网上运行，不涉及真钱，登录需要邀请码，也没有发行任何代币。

## 先说清楚几个词

bStock 是币安关联公司 BTech Holdings 在 BNB Chain 上发行的美股代币。每枚由托管的正股 1:1 支撑，发行方每天公布抵押证明，价格跟着对应的股票走。币安官方写明「bStocks 不是股票」，分红先扣 30% 美国预扣税，再折成更多代币，不发现金（[Binance Learn](https://www.binance.com/en/learn/bstocks)）。

智能账户是 CRE8 在 BNB Chain 上为每个用户单独开的链上账户。资产放在里面，不和别人的混在一起；CRE8 的自动化只能在账户里帮你交易，钱要转出去，必须你本人签名。

组合是一篮按固定比例配好的资产，比如 7 只美股科技股各占约 14.3%。CRE8 有 21 个精选组合，也可以自己挑资产、定比例。

再平衡（调仓）是指价格涨跌让比例跑掉以后，系统卖掉涨多的、补上跌多的，把比例拉回目标。

## CRE8 能做什么？

一句话：一笔 USDT 买齐一整篮，资产放自己账户，比例自动维持，闲着的 U 能生息。具体功能如下（[CRE8 使用指南](https://cre8.finance/zh/how-it-works)）：

| 功能 | 做什么 |
|---|---|
| 一次买一篮 | 选组合、输入金额，一笔付款按目标权重买齐每个资产，每笔 50 USDT 起 |
| 精选组合 | 21 个：人物 4 个、主题 15 个、杠杆 2 个 |
| 自己配组合 | 自己挑资产、定比例，CRE8 按你选的频率调仓 |
| 自动调仓 | 精选组合每月一次，任一资产偏离目标超过 5 个百分点时也会调 |
| 定投（DCA） | 先存一笔，没买的部分生息，每期自动买一份 |
| Earn | 闲置 USDT 存进白名单金库（Lista、Venus、Aave），随存随取 |
| 加息策略 | 买组合时可开，用组合里的股票抵押借一小笔 USDT 去生息，默认关闭 |
| 卖出与提现 | 部分或全部卖回 USDT，再提到任意 BNB Chain 地址 |

## CRE8 是怎么运作的？

### 买入

用邀请码和 X 账号登录（开通后也能用 Google 或邮箱），CRE8 会在 BNB Chain 上为你开一个只属于你的智能账户。往账户充 USDT，选一个组合，输入金额，确认一次，系统就按权重把每个资产买齐。

交易只走白名单里的链上 DEX：PancakeSwap、KyberSwap 和 OpenOcean。每个资产有单笔上限，大单会自动拆成几笔。DEX 是去中心化交易所，在链上直接用资金池换币，不经过交易所账户。

股票代币只在美股交易时段成交。休市时下的单会在账户里排队，下次开盘时成交，在那之前 USDT 一直留在你自己的账户里。

### 保管

资产以代币形式放在你自己的智能账户里，用任何区块浏览器都查得到。CRE8 的自动化只能在账户里交易，资产要转出账户，必须你本人签名。安全细节另写了一篇：[CRE8 安全吗](/zh/blog/is-cre8-safe)。

### 再平衡

精选组合每月调仓一次。任何资产偏离目标权重超过 5 个百分点，也会马上调。比如英伟达在组合里原本占 19%，涨到 25% 时就会触发调仓，系统卖掉一部分英伟达，补到其他股票上。

自己配的组合，调仓频率可以选每天、每周、每月或每季。

### 定投（DCA）

定投是把一笔钱分成好几期，按固定频率买入，摊平买入价格。在 CRE8 定投，是先把总额存进这个组合的账户，再按每天、每周、每两周或每月自动买一份，每期最少 10 USDT。还没轮到买的钱放在 USDT 金库里生息。杠杆组合不支持分批买入。详细做法见 [用 USDT 定投美股](/zh/blog/dca-us-stocks-with-usdt)。

### Earn

账户里的 USDT 可以放着不动，也可以点 Earn，存进白名单里的 USDT 金库（Lista、Venus、Aave）。每个金库都显示年化，随市场利率浮动，CRE8 不承诺收益率。随存随取，利息一起到账。你不点，CRE8 不会动你的现金。

### 加息策略

买组合时可以顺手打开加息策略，它默认关闭。打开后，系统把组合里的股票存进借贷市场当抵押，只借市场允许额度的一小部分 USDT，再存进 USDT 金库赚利息。价格跌到安全线时，系统自动用金库里的 USDT 还掉一部分借款，股票不卖，事后在活动记录里告诉你还了多少。随时可以关，杠杆组合不提供。

现金、每个组合的资金、加息策略借来的 USDT 永远分开，互不混用。更多见 [闲置 USDT 怎么生息](/zh/blog/earn-yield-on-idle-usdt-and-bstock)。

## 1,000 USDT 用 CRE8 是什么样？

假设你在测试网领了 1,000 测试 USDT，拿 500 买「美股七巨头」组合，剩下 500 点 Earn 存进金库。

500 USDT 会按 llms.txt 公布的权重一次买齐（[CRE8 llms.txt](https://cre8.finance/llms.txt)）：

| 股票 | 权重 | 500 USDT 分到 |
|---|---|---|
| 苹果（AAPL） | 14.29% | 71.45 USDT |
| 微软（MSFT） | 14.28% | 71.40 USDT |
| 谷歌（GOOGL） | 14.29% | 71.45 USDT |
| 亚马逊（AMZN） | 14.29% | 71.45 USDT |
| 英伟达（NVDA） | 14.28% | 71.40 USDT |
| Meta（META） | 14.29% | 71.45 USDT |
| 特斯拉（TSLA） | 14.28% | 71.40 USDT |

在交易所做同样的事，要下 7 单，比例自己算。在 CRE8 是确认一次。之后组合每月调仓一次，任何一只偏离超过 5 个百分点也会调。

另外 500 USDT 在 Earn 里按金库利率生息，想用的时候随时领回。这 500 和七巨头组合的钱是分开记账的。测试网上的价格、金库和利率都是模拟的，测试网不收费，gas 由 CRE8 付。

## 和其他买美股的方法比，CRE8 差在哪？

| | 交易所买股票代币（如币安） | 自己钱包在 DEX 买 | 海外券商 | CRE8（测试网） |
|---|---|---|---|---|
| 买到什么 | 发行方的股票代币，如 bStock | 同左 | 真股票 | bStock 加加密资产组成的组合 |
| 资产放哪 | 交易所账户，可手动提币 | 自己的钱包 | 券商账户 | 你自己的 BNB Chain 智能账户 |
| 能用 USDT 吗 | 能 | 能 | 多数要换法币 | 能 |
| 一次买一篮 | 不行，一只一只下单 | 不行 | 可买 ETF | 可以，一笔按权重买齐 |
| 自动调仓 | 没有 | 没有 | 没有 | 每月，加上偏离 5 个百分点时 |
| 闲置资金生息 | 另外去理财产品 | 自己去借贷协议 | 现金利息 | 同一个账户里点 Earn |
| 可选标的 | 币安 bStock 近 100 只 | 看链上流动性 | 几千只 | 21 个精选组合，或自己配 |
| 目前状态 | 正式运行 | 正式运行 | 正式运行 | 测试网，不涉及真钱 |

资料查询日期：2026-11-23。币安 bStock 数量据 [Finance Magnates](https://www.financemagnates.com/cryptocurrency/exchange/binance-claims-fastest-1-billion-sprint-in-bstocks-with-6-billion-in-share-conversions/) 2026 年 10 月报道「近 100 只」。

## CRE8 现在是什么状态？

CRE8 跑在 BNB Chain 测试网（BSC testnet）上。代币和价格都是测试版，测试 USDT 免费领，不涉及真钱。

登录需要邀请码。官网入口是等候名单 [cre8.finance/zh/waitlist](https://cre8.finance/zh/waitlist)，拿到邀请码后在 tst.cre8.finance 登录。

测试网全免费，gas 由 CRE8 付。主网费率会在上线前公布，DEX 的池子手续费和滑点另计。主网上线时间还没定，上主网前合约会做第三方审计，目前还没完成。

美国以外、当地法规允许的用户都可以使用。CRE8 目前没有发行代币。

## CRE8 和 Solana 上的 CRE8 Finance 有关系吗？

没有关系。本文说的 CRE8 是 BNB Chain 上的应用，网站是 cre8.finance，X 账号是 [@CRE8Finance](https://x.com/CRE8Finance)。它和 Solana 上叫 CRE8 Finance 的项目、以及任何叫 CRE8 的代币都没有关系。CRE8 目前没有发币，看到自称 CRE8 的代币，都不是我们发的。

## CRE8 适合谁？

适合手上有 USDT、想一次买一篮美股和加密资产的人。比如有 1,000 U，想同时持有七巨头，不想下 7 单、不想自己算比例。

适合想自己保管资产，又不想自己操作 DEX 和借贷协议的人。资产在自己的链上账户，交易和调仓由系统按规则做。

适合想定投、想让闲置 U 生息的人。定投没买的钱、没用的现金，都能在同一个账户里生息。

## 什么情况用别的方法就好？

只想买一两只股票。比如 500 U 只想换英伟达，在币安直接买 bStock 最快。

想要真股票和完整的股东权利。bStock 是发行方的凭证，想登记在自己名下的股份，要开海外券商账户。

想要很多选择。币安的 Binance Stocks 有 7,000 多只美股和 ETF（[The Block](https://www.theblock.co/amp/post/403155/binance-adds-us-stocks-etfs-traders-outside-united-states-super-app-push)）；CRE8 只用链上有足够流动性的标的。

要做合约或保证金交易。CRE8 只做现货，两个 3 倍杠杆组合买的是杠杆 ETF 代币，不是合约。

你是美国人，或者现在就想用真钱。CRE8 不对美国用户开放，目前也只有测试网。

## 有哪些风险？

价格会跌，可能亏钱。组合里的股票和加密资产都可能下跌。模型年化是用现在的权重套历史价格算出来的回测，不是实盘战绩，也不代表以后。

bStock 不是股票本身。你持有的是 BTech Holdings 发行的凭证，权利取决于发行方和托管方。

智能合约可能出错。CRE8、以及金库所在的 Lista、Venus、Aave 都是智能合约。CRE8 上主网前会做第三方审计。

加息策略风险低，但不是零。借贷利率会变，收益可能变少甚至没有。

目前只是测试网。价格、金库和利率都是模拟的，测试网上的数字只能当示意。

## 常见问题

**CRE8 是哪条链上的？**
BNB Chain（BSC）。测试网是 BSC testnet。

**CRE8 拿得走我的钱吗？**
拿不走。资产在你的智能账户里，CRE8 的自动化只能在账户里交易，转出必须你本人签名。

**最少投多少？**
每笔买入 50 USDT 起；定投每期最少 10 USDT。

**收费吗？**
测试网全免费，gas 由 CRE8 付。主网费率上线前公布。

**CRE8 有发币吗？**
没有。和 Solana 上的 CRE8 Finance 也不是同一个项目。

**在哪里能用？**
美国以外、当地法规允许的地区。现在需要邀请码登录测试网。

## 下一步

想先看看有哪些组合、每个组合买什么，可以逛 [全部组合](https://cre8.finance/zh/portfolios)。每个组合怎么来的，见 [CRE8 的组合怎么选](/zh/blog/cre8-portfolios-explained)。

---

延伸阅读：[bStock 是什么](/zh/blog/what-is-bstock)、[CRE8 安全吗](/zh/blog/is-cre8-safe)。

资料来源（查询日期 2026-11-23）：[CRE8 使用指南](https://cre8.finance/zh/how-it-works)、[CRE8 llms.txt](https://cre8.finance/llms.txt)、[Binance Learn：bStocks](https://www.binance.com/en/learn/bstocks)、[Finance Magnates](https://www.financemagnates.com/cryptocurrency/exchange/binance-claims-fastest-1-billion-sprint-in-bstocks-with-6-billion-in-share-conversions/)、[The Block](https://www.theblock.co/amp/post/403155/binance-adds-us-stocks-etfs-traders-outside-united-states-super-app-push)。

本文只是介绍产品，不是投资建议。
