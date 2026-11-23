---
title: 美股代币能放自己钱包吗？在 BNB Chain 上怎么买
slug: /zh/blog/self-custody-us-stock-tokens-bnb-chain
lang: zh-Hans
author: CRE8
published: 2026-11-23
updated: 2026-11-23
status: 草稿（第 4 篇）
---

# 美股代币能放自己钱包吗？在 BNB Chain 上怎么买

作者：CRE8 · 2026 年 11 月 23 日 · 阅读约 8 分钟

能。BNB Chain 上的美股代币，比如币安的 bStock、Ondo 和 xStocks，都可以放在你自己的钱包里。在 BNB Chain 上买，主要有三条路：在币安买了再提到钱包、把 USDT 转进钱包自己去 PancakeSwap 换，或者用 CRE8 这类应用直接买进你自己的智能账户。自己在链上买，一定要先对照发行方公布的合约地址，链上有不少同名假币。

## 先说清楚几个词

美股代币是发行方在区块链上发的代币，价格跟着某只美股走，背后由托管的正股支撑。你持有的是发行方的凭证，不是股票本身。币安官方写明「bStocks 不是股票」（[Binance Learn](https://www.binance.com/en/learn/bstocks)）。

自己保管（也叫自托管）的意思是：代币放在只有你能动的链上地址里，不在交易所账户上。钱包的助记词或登录方式就是钥匙，钥匙丢了，没人能帮你找回。

BNB Chain 是币安生态的公链，也常被叫作 BSC。gas 是链上每笔交易付给网络的手续费，在 BNB Chain 上用 BNB 付。

合约地址是代币在链上的唯一编号。名字和代号谁都能起，合约地址才能分辨真假。

## BNB Chain 上有哪些美股代币？

截至 2026 年 11 月 23 日，BNB Chain 上规模最大的是币安的 bStock，约 12 亿美元；排第二的是 Ondo，约 6.0 亿美元（这个数字含非股票资产）（[rwa.xyz](https://app.rwa.xyz/networks/bnb-chain)，第三方数据）。

bStock 由币安关联公司 BTech Holdings 发行，只在 BNB Chain 上，每枚由托管的正股 1:1 支撑，发行方每天公布抵押证明（[Binance Learn](https://www.binance.com/en/learn/bstocks)、[BNB Chain 官方博客](https://bnbchain.org/en/blog/introducing-bstocks-on-bnb-chain-trade-24-7-with-zero-fees-deploy-across-defi-protocols-with-full-self-custody)）。据 Finance Magnates 2026 年 10 月 15 日报道，bStock 有近 100 只；rwa.xyz 在 11 月 23 日计到 112 个（[Finance Magnates](https://www.financemagnates.com/cryptocurrency/exchange/binance-claims-fastest-1-billion-sprint-in-bstocks-with-6-billion-in-share-conversions/)、[rwa.xyz](https://app.rwa.xyz/stocks)）。

Ondo 的股票代币在以太坊、BNB Chain 和 Solana 上都有，在 BNB Chain 上主要在 PancakeSwap 交易（[Ondo 文档](https://docs.ondo.finance/ondo-global-markets/overview)、[BNB Chain 官方博客](https://www.bnbchain.org/en/blog/ondo-global-markets-brings-100-tokenized-u-s-stocks-etfs-to-bnb-chain)）。

xStocks 从 2026 年 4 月 30 日起在 BNB Chain 上线了 50 多只（[BNB Chain 官方博客](https://www.bnbchain.org/en/blog/xstocks-is-now-live-on-bnb-chain-with-50-tokenized-equities-with-100-more-coming-soon)）。

Robinhood 和 Dinari 的股票代币目前不在 BNB Chain 上。Robinhood 新版放在它自己的 Robinhood Chain；Dinari 在以太坊、Avalanche、Arbitrum 和 Base 上，而且每个钱包都要先过 KYC（[Robinhood 新闻稿](https://robinhood.com/newsroom/robinhood-accelerates-global-expansion-robinhood-chain-mainnet-stock-tokens-agentic-trading/)、[Dinari 文档](https://docs.dinari.com/api/identity-verification-kyc)）。

## 每家都能提到自己钱包吗？

BNB Chain 上的三家都可以，但条件不一样：

| 发行方 | 能放自己钱包吗 | 条件 |
|---|---|---|
| bStock | 能 | 任何兼容 BSC 的钱包，要先过资格和制裁检查（[Binance Learn](https://www.binance.com/en/learn/bstocks)） |
| Ondo | 能 | ERC-20 兼容，可以自由转账（[Ondo 文档](https://docs.ondo.finance/ondo-stocks/investing-and-redeeming.md)） |
| xStocks | 能 | Kraken 官方说明可以提到自己钱包（[Kraken FAQ](https://support.kraken.com/articles/xstocks-faq)） |
| Robinhood（新版） | 能，但不在 BNB Chain | 通过 Robinhood Wallet（[Robinhood 新闻稿](https://robinhood.com/newsroom/robinhood-accelerates-global-expansion-robinhood-chain-mainnet-stock-tokens-agentic-trading/)） |
| Dinari | 有条件 | 钱包要过 KYC；美国客户的代币目前不能转让（[Dinari 文档](https://docs.dinari.com/docs/us)） |

所有股票代币都不对美国人开放，xStocks 还排除英国、加拿大和澳洲（[Kraken FAQ](https://support.kraken.com/articles/xstocks-faq)）。

## 方法一：在币安买，再提到自己钱包

在币安用 U 买 bStock，最低 5 美元，现货 24 小时都能交易（[Binance Learn](https://www.binance.com/en/learn/bstocks)）。买完以后，可以把 bStock 提到 BNB Chain 钱包，比如 Binance Wallet 或 Trust Wallet，之后自己去 PancakeSwap 交易，或者去 Venus、Lista 借贷（[BNB Chain 官方博客](https://bnbchain.org/en/blog/introducing-bstocks-on-bnb-chain-trade-24-7-with-zero-fees-deploy-across-defi-protocols-with-full-self-custody)）。

这条路的好处是不用担心买到假币：从币安提出来的就是发行方的代币。提币时网络选 BNB Chain，地址填你钱包在 BNB Chain 上的地址。

适合：已经有币安账户、只想把一两只股票放到自己手上的人。

## 方法二：USDT 转进钱包，自己在链上换

把 USDT 转到自己的 BNB Chain 钱包，再在 PancakeSwap 这类去中心化交易所（DEX，不用注册账户、直接用钱包交易的链上交易所）换成股票代币。资产从头到尾都在你自己手上。钱包里要留一点 BNB 付 gas。

这条路最要紧的一步是核对合约地址。DEX 上常有人先部署一个同名同代号的假代币，搜代号出来的第一个不一定是真的（[DEXTools](https://www.dextools.io/news/xstocks-on-bnb-chain-the-reality-of-245-trading)）。纽约证券交易所和世界交易所联合会（WFE）都对假的代币化股票发过警告（[crypto.news：NYSE](https://crypto.news/nyse-warns-fake-tokenized-stocks-threaten-retail/)、[crypto.news：WFE](https://crypto.news/global-stock-exchanges-call-on-regulators-to-crack-down-on-tokenised-stocks/)）。

核对的做法很简单：到发行方官网或官方文档找到这只股票代币的合约地址，复制下来，在 DEX 里粘贴地址搜索，不要只搜代号。在区块浏览器里也能看到这个地址的发行信息和持有人数量，持有人很少、刚部署没几天的，多半有问题。

买到以后，你也可以自己拿去借贷。例如 Venus 在 2026 年 6 月 20 日把 TSLAB、NVDAB、SPCXB 加为抵押品（[CryptoSlate](https://cryptoslate.com/tokenized-stocks-defi-collateral-venus/)），Lista DAO 也支持 NVDAB、TSLAB 等（[Crypto Briefing](https://cryptobriefing.com/bstocks-lista-dao-defi-integration/)）。抵押借钱要自己盯着价格，跌太多会被清算。

适合：用过钱包和 DEX、愿意自己核对地址和盯仓位的人。

## 方法三：用 CRE8 买进自己的智能账户

CRE8 是 BNB Chain 上的应用，用 USDT 一次买入美股代币和加密资产的组合，资产直接放在你自己的智能账户里。智能账户是 BNB Chain 上一个只属于你的合约账户，用邮箱或 Google 登录就会开好，所有人是你登录用的钱包（[CRE8 使用指南](https://cre8.finance/zh/how-it-works)）。

和前两种比，差别在三点。

资产从第一笔起就在你的账户里。代币不和别人的混在一起，任何区块浏览器都查得到。CRE8 的自动化只能在你的账户里交易，资产要转出，必须你本人签名。

不用自己找合约地址。CRE8 的股票以 bStock 持有，交易只走白名单里的 DEX（PancakeSwap、KyberSwap、OpenOcean），每个资产有单笔上限，大单会自动拆成几笔。

一笔钱买一整篮，比例会自己维持。精选组合每月调仓一次，任何资产偏离目标权重超过 5 个百分点时也会调。

要注意的不同：CRE8 只在美股交易时段成交，休市时下的单会排队到下次开盘；币安现货 24 小时都能交易。想走的时候，组合可以部分或全部卖回 USDT，再把 USDT 提到任意 BNB Chain 地址，包括交易所的充值地址。

CRE8 目前只在 BNB Chain 测试网，用免费的测试 USDT，不涉及真钱，登录需要邀请码，主网时间还没定。

## 三种放法放在一起比

| | 放在币安账户 | 提到自己钱包／自己在 DEX 买 | CRE8 智能账户（测试网） |
|---|---|---|---|
| 资产在谁手上 | 交易所账户 | 你自己的钱包 | 你自己的智能账户，转出要你签名 |
| 怎么买 | 交易所一只一只下单 | DEX 一只一只换 | 一笔 USDT 按权重买齐一个组合 |
| 交易时段 | 现货 24 小时 | DEX 24 小时，休市时价差可能变大 | 只在美股交易时段成交 |
| 防假币要做什么 | 不用，交易所上架的就是发行方的 | 自己核对发行方公布的合约地址 | 只走白名单 DEX 和 bStock |
| 要准备什么 | 币安账户 | 钱包、一点 BNB 付 gas | 邮箱或 Google 登录；测试网 gas 由 CRE8 付 |
| 比例维持 | 自己调 | 自己调 | 每月调仓，偏离超过 5 个百分点也调 |
| 拿 bStock 赚收益 | 当交易所保证金 | 自己去 Venus、Lista 抵押，自己盯清算 | 加息策略一个开关，跌到安全线自动还款 |
| 出了错找谁 | 可以找客服 | 钥匙和转账都自己负责 | 账户所有人是你登录用的钱包，登录方式要自己保管好 |
| 目前状态 | 正式上线 | 正式上线 | BNB Chain 测试网，不涉及真钱 |

资料查询日：2026-11-23。

## 用 300 U 走一次是什么样？

假设你手上有 300 U，想买美股七巨头，还想放在自己手上。

走方法一：在币安下 7 单，每只约 42.9 U，买完再把 7 只 bStock 分别提到钱包。每只提币都要选 BNB Chain 网络，提币手续费以币安提币页显示为准。

走方法二：先把 300 U 提到自己的钱包，留一点 BNB 付 gas，再在 PancakeSwap 换 7 次。每一次都要先查发行方公布的合约地址，粘贴地址再换。

走方法三：在 CRE8 打开[美股七巨头组合](https://cre8.finance/zh/portfolios/mag7)，输入 300 USDT，确认一次。苹果、谷歌、亚马逊、Meta 各分到约 42.87 U（14.29%），微软、英伟达、特斯拉各分到约 42.84 U（14.28%），全部进你自己的智能账户。如果是美股休市时间下的单，会排队到下次开盘成交，这之前 300 U 一直在你账户里。

## 什么情况用别的方法就好？

只想买一两只，又不在意放在哪：直接在币安买最省事，24 小时都能成交。

想随时交易、休市也要买卖：币安现货或 DEX 都是 24 小时，CRE8 只在美股交易时段成交。

想要真股票和完整股东权利：股票代币给不了，要去券商开户。中国大陆用户要注意，2026 年 5 月 22 日起境外券商不能再为内地存量用户提供买入和入金（[证监会](https://www.csrc.gov.cn/csrc/c100028/c7634326/content.shtml)）。

想要 Robinhood 或 Dinari 的代币：它们不在 BNB Chain 上，要用对应的链和钱包。

## 有哪些风险？

股票代币不是股票。你的权利取决于发行方和托管方，发行方出问题要走破产程序。bStock 的分红先扣 30% 美国预扣税，再折成更多代币，不发现金（[Binance Learn](https://www.binance.com/en/learn/bstocks)）。

自己保管就要自己负责。钥匙丢了、地址填错、在假网站上签了名，钱都可能找不回来。

假币。只认发行方公布的合约地址，不认代号和名字。

休市价差。美股收盘后代币还在链上交易，但做市的人变少，价格可能和下次开盘价差很多（[OKX 帮助中心](https://www.okx.com/help/unified-tokenized-stocks)）。

智能合约风险。DEX、借贷协议和 CRE8 都用智能合约，合约有出错的可能；CRE8 上主网前会做第三方审计。

价格会跌。不管放在哪里，买的都是会涨也会跌的资产。CRE8 组合页上的模型年化是用现在的权重套历史价格算的回测，不是实盘战绩。

## 常见问题

### 从币安提 bStock 到钱包要 KYC 吗？

在币安买要有币安账户；提到钱包要先过资格和制裁检查（[Binance Learn](https://www.binance.com/en/learn/bstocks)）。bStock 专门的 KYC 条款我们没有查到，以币安页面为准。

### 放在钱包里的 bStock 还能拿到分红吗？

bStock 的分红不发现金，扣 30% 美国预扣税后用乘数增加代币数量。链上持有人怎么体现分红，以发行方说明为准。

### CRE8 拿得走我的资产吗？

拿不走。CRE8 的自动化只能在你的智能账户里交易，资产转出必须你本人签名。

### 在 CRE8 买的资产能转到别的钱包吗？

组合可以卖回 USDT，再提到任意 BNB Chain 地址，包括交易所充值地址。

### CRE8 和 Solana 上的 CRE8 Finance 是同一个吗？

不是。CRE8 在 BNB Chain 上，目前没有发行代币。

## 下一步

想知道资产在 CRE8 里怎么托管、怎么提现，看 [使用指南](https://cre8.finance/zh/how-it-works)。想比较各家股票代币的托管和权利，看 [代币化美股怎么选](/zh/blog/tokenized-stocks-compared)；想先看全部买法，看 [用 USDT 买美股有哪几种方法](/zh/blog/buy-us-stocks-with-usdt)。

---

资料来源（查询日期 2026-11-23）：[Binance Learn：bStocks](https://www.binance.com/en/learn/bstocks)、[BNB Chain 官方博客：bStocks](https://bnbchain.org/en/blog/introducing-bstocks-on-bnb-chain-trade-24-7-with-zero-fees-deploy-across-defi-protocols-with-full-self-custody)、[BNB Chain 官方博客：Ondo](https://www.bnbchain.org/en/blog/ondo-global-markets-brings-100-tokenized-u-s-stocks-etfs-to-bnb-chain)、[BNB Chain 官方博客：xStocks](https://www.bnbchain.org/en/blog/xstocks-is-now-live-on-bnb-chain-with-50-tokenized-equities-with-100-more-coming-soon)、[rwa.xyz：BNB Chain](https://app.rwa.xyz/networks/bnb-chain)、[rwa.xyz：股票](https://app.rwa.xyz/stocks)、[Finance Magnates](https://www.financemagnates.com/cryptocurrency/exchange/binance-claims-fastest-1-billion-sprint-in-bstocks-with-6-billion-in-share-conversions/)、[Ondo 文档：概览](https://docs.ondo.finance/ondo-global-markets/overview)、[Ondo 文档：申购与赎回](https://docs.ondo.finance/ondo-stocks/investing-and-redeeming.md)、[Kraken xStocks FAQ](https://support.kraken.com/articles/xstocks-faq)、[Robinhood 新闻稿](https://robinhood.com/newsroom/robinhood-accelerates-global-expansion-robinhood-chain-mainnet-stock-tokens-agentic-trading/)、[Dinari 文档：美国客户](https://docs.dinari.com/docs/us)、[Dinari 文档：KYC](https://docs.dinari.com/api/identity-verification-kyc)、[DEXTools](https://www.dextools.io/news/xstocks-on-bnb-chain-the-reality-of-245-trading)、[crypto.news：NYSE](https://crypto.news/nyse-warns-fake-tokenized-stocks-threaten-retail/)、[crypto.news：WFE](https://crypto.news/global-stock-exchanges-call-on-regulators-to-crack-down-on-tokenised-stocks/)、[CryptoSlate：Venus](https://cryptoslate.com/tokenized-stocks-defi-collateral-venus/)、[Crypto Briefing：Lista](https://cryptobriefing.com/bstocks-lista-dao-defi-integration/)、[OKX 帮助中心](https://www.okx.com/help/unified-tokenized-stocks)、[中国证监会](https://www.csrc.gov.cn/csrc/c100028/c7634326/content.shtml)、[CRE8 使用指南](https://cre8.finance/zh/how-it-works)。

本文只是说明各种保管和买法的差别，不是投资建议。
