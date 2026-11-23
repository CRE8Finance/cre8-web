---
title: bStock 是什么？怎么买，和真股票差在哪
slug: /zh/blog/what-is-bstock
lang: zh-Hans
author: CRE8
published: 2026-11-23
updated: 2026-11-23
status: 草稿（第 2 篇）
---

# bStock 是什么？怎么买，和真股票差在哪

作者：CRE8 · 2026 年 11 月 23 日 · 阅读约 8 分钟

bStock 是币安关联公司 BTech Holdings 在 BNB Chain 上发行的美股代币，每枚由托管机构里的正股 1:1 支撑，价格跟着对应的美股走。可以在币安用 USDT 直接买，也可以提到自己的 BNB Chain 钱包，或在链上 DEX 买。它和真股票最大的差别是：你持有的是发行方的凭证，币安官方写明「bStocks 不是股票」，分红也不发现金（[Binance Learn](https://www.binance.com/en/learn/bstocks)）。

## bStock 到底是什么？

bStock 是一种「股票代币」：发行方先在托管机构买入真实股票，再在区块链上发行等量的代币，一枚代币对应一股。比如英伟达对应的 bStock，在 Venus、Lista 这些借贷协议里的代号是 NVDAB，特斯拉是 TSLAB（[CryptoSlate](https://cryptoslate.com/tokenized-stocks-defi-collateral-venus/)、[Crypto Briefing](https://cryptobriefing.com/bstocks-lista-dao-defi-integration/)）。

几个基本事实，都来自币安官方的 bStocks 说明页（[Binance Learn](https://www.binance.com/en/learn/bstocks)）：

| 项目 | 内容 |
|---|---|
| 发行方 | BTech Holdings Limited，币安关联公司 |
| 发行依据 | 阿布扎比全球市场金融服务监管局（ADGM FSRA）核准的公开说明书 |
| 法律上是什么 | 凭证（Certificates），代表「对发行方所持证券的权益」 |
| 怎么支撑 | 每枚由受监管托管机构里的正股 1:1 支撑，每天公布抵押证明 |
| 在哪条链 | 只在 BNB Chain，代币标准是 BEP-20 |
| 分红 | 先扣 30% 美国预扣税，再增加你的代币数量，不发现金 |
| 谁不能买 | 美国和美国人 |

抵押证明（Proof of Collateral）就是发行方每天公开一次「托管里的股票有多少、代币发了多少」，让人核对两边对得上。托管机构的名字，官方页面写的是「regulated custodian」，没有点名。

bStock 2026 年 6 月 11 日上线（[DefiLlama Research](https://defillama.com/research/spotlight/stocks-onchain-how-binance-stocks-and-bstocks-cover-the-full-equities-spectrum)）。据 Finance Magnates 2026 年 10 月 15 日报道，bStock 已有近 100 只，管理资产超过 10 亿美元，累计交易量超过 400 亿美元（[Finance Magnates](https://www.financemagnates.com/cryptocurrency/exchange/binance-claims-fastest-1-billion-sprint-in-bstocks-with-6-billion-in-share-conversions/)）。第三方数据站 rwa.xyz 在 2026 年 11 月 23 日的统计是 112 个代币、总值约 12 亿美元，是全网规模最大的美股代币（[rwa.xyz](https://app.rwa.xyz/stocks)）。

![chart](chart:issuers)

## bStock 和真股票差在哪？

最核心的一点：真股票登记在你（或你的券商）名下，bStock 是发行方的凭证，你的权利取决于发行方和托管方。具体差在下面几处。

法律身份不同。在券商买英伟达，你就是英伟达的股东之一。买 NVDA 的 bStock，你持有的是 BTech Holdings 发行的凭证，币安官方原文就写了 bStocks 不是股票。

分红方式不同。真股票派现金股息；bStock 先扣 30% 美国预扣税，剩下的部分用「乘数」（Multiplier）增加你的代币数量。

交易时间不同。美股正常交易时段只有工作日的几个小时；bStock 在币安现货 24 小时都能交易（[Binance Learn](https://www.binance.com/en/learn/bstocks)）。代价是休市时没有正股可以对冲，价格可能和下次开盘价有差距。据 Crypto Briefing 报道，2026 年 7 月 bStock 有 62% 的成交量发生在美股休市时段（[Crypto Briefing](https://cryptobriefing.com/binance-bstocks-volume-us-market-closures/)）。

能放的地方不同。真股票只能放在券商账户。bStock 是链上代币，可以提到任何兼容 BNB Chain 的钱包，前提是通过资格和制裁检查（[Binance Learn](https://www.binance.com/en/learn/bstocks)）。

能做的事不同。bStock 在链上可以拿去借贷协议当抵押，这是券商账户里的股票做不到的（下面细说）。

投票权、参加股东大会这类股东权利，币安公开的说明页没有写明，本文不做推断。欧洲证券和市场管理局（ESMA）的执行董事曾公开提醒，股票代币通常不带股东权利，散户可能误解自己买到的东西（[CryptoSlate](https://cryptoslate.com/eu-regulator-warns-tokenized-stocks-may-mislead-retail-investors/)）。

| | 真股票（券商） | bStock |
|---|---|---|
| 你持有什么 | 股份 | 发行方的凭证，由正股 1:1 支撑 |
| 放在哪 | 券商账户 | 币安账户，或自己的 BNB Chain 钱包 |
| 能直接用 USDT 买吗 | 多数券商不行，要先换法币 | 能 |
| 交易时间 | 美股交易时段（部分券商有夜盘） | 币安现货 24 小时 |
| 分红 | 现金 | 扣 30% 预扣税后折成代币 |
| 最低金额 | 看券商，零股多为 2–5 美元起 | 币安 5 美元起 |
| 链上抵押借款 | 不行 | 可以（Venus、Lista 等） |
| 需要开户 | 要，开户和身份验证 | 在币安买需要币安账户 |

资料查询日：2026 年 11 月 23 日。

## bStock 怎么买？

目前有三条路：币安交易所、链上 DEX、以及像 CRE8 这样替你在链上买的应用。

### 在币安交易所买

最直接。用 USDT 在币安现货下单，和买币一样，最低 5 美元，24 小时可交易（[Binance Learn](https://www.binance.com/en/learn/bstocks)）。买到的 bStock 默认放在币安账户里。

币安账户里，Binance Stocks 的股票和 bStock 可以 1:1 免费互转（[Binance Learn](https://www.binance.com/en/learn/bstocks)）。据报道，币安还支持在「闪兑」和「买币」里给单只 bStock 设周期买入，具体条款以币安官网为准（[Traders Union](https://tradersunion.com/news/brokers-news/show/2941539-binance-launches-automated-bstock-purchases/)）。

### 提到自己的钱包，或在链上 DEX 买

bStock 是 BNB Chain 上的 BEP-20 代币，可以从币安提到 Binance Wallet、Trust Wallet 这类钱包，之后自己去 PancakeSwap 交易（[BNB Chain 官方博客](https://bnbchain.org/en/blog/introducing-bstocks-on-bnb-chain-trade-24-7-with-zero-fees-deploy-across-defi-protocols-with-full-self-custody)）。DEX（去中心化交易所）就是链上的兑换池，不用注册账户，用钱包签名就能换。

链上自己买要准备两样东西：一点 BNB 付 gas（gas 是每笔链上交易付给网络的手续费），以及正确的合约地址。DEX 上常有人部署同名假币，买之前要对照发行方公布的地址（[DEXTools](https://www.dextools.io/news/xstocks-on-bnb-chain-the-reality-of-245-trading)）。

### 用 CRE8 一次买一篮

CRE8 是 BNB Chain 上的应用，用 USDT 一次买入美股代币和加密资产的组合，美股部分就是 bStock。资产放在你自己的智能账户里，智能账户是 BNB Chain 上只属于你的账户，CRE8 的自动化只能在里面交易，转出必须你本人签名（[使用指南](https://cre8.finance/zh/how-it-works)）。

CRE8 的交易只走白名单 DEX（PancakeSwap、KyberSwap、OpenOcean），只在美股交易时段成交，休市时下的单排到下次开盘。CRE8 目前只在 BNB Chain 测试网，用免费的测试 USDT，不涉及真钱，主网时间还没定。

## 用 1,000 USDT 走一遍是什么样？

假设你手上有 1,000 USDT，想持有英伟达。

走币安：在现货买 1,000 USDT 的 NVDA bStock，下一单就完成，资产在币安账户。想自己保管，再提到 BNB Chain 钱包。

走链上：先把 1,000 USDT 提到自己的钱包，再准备少量 BNB 当 gas，在 PancakeSwap 核对合约地址后兑换。

走 CRE8（测试网）：CRE8 卖的是组合，不是单只股票。以佩洛西持仓组合为例，权重是英伟达、谷歌、微软、亚马逊、英特尔各 19%，博通 5%（[佩洛西持仓](https://cre8.finance/zh/portfolios/pelosi)）。投 1,000 USDT，系统按权重一次买齐：五只各 190 USDT，博通 50 USDT，全部是 bStock，放在你的智能账户里。

分红怎么算：假设你持有的某只 bStock 对应股票派息，你这部分的毛股息是 10 美元。先扣 30% 美国预扣税剩 7 美元，这 7 美元按乘数折成更多代币加到你的持仓里，账户里不会多出 7 美元现金。数字是为了说明机制假设的。

## bStock 买了能做什么？

除了拿着等涨跌，bStock 可以当抵押品。

在币安：2026 年 9 月 21 日起，所有合格用户都能把 bStock 当全仓杠杆和统一保证金账户的抵押品，按折扣计价（[Bitcoin.com](https://news.bitcoin.com/crypto-news/binance-expands-bstocks-collateral-as-tokenized-stock-volumes-jump-33x/)）。

在链上：Venus 核心池 2026 年 6 月 20 日上架 TSLAB、NVDAB、SPCXB 当抵押品，抵押率分别是 60%、60%、50%（[CryptoSlate](https://cryptoslate.com/tokenized-stocks-defi-collateral-venus/)）。Lista DAO 约在 2026 年 6 月 16 日支持 NVDAB、TSLAB、MUB（[Crypto Briefing](https://cryptobriefing.com/bstocks-lista-dao-defi-integration/)）。抵押率 60% 的意思是，价值 100 美元的 NVDAB 最多能借出 60 美元。

自己去借贷协议操作，要自己盯价格，跌太多会被清算。CRE8 的加息策略把这几步放进一个开关：用组合里的股票做抵押，只借一小笔 USDT 存进金库生息，跌到安全线时自动用金库的 USDT 还款，不卖股票。详细做法和风险见 [闲置 USDT 怎么生息](/zh/blog/earn-yield-on-idle-usdt-and-bstock)。

## 什么情况不用 bStock，用别的就好？

要完整的股东权利、要现金分红，选海外券商买真股票。代价是要开户、入金，多数券商不能直接用 USDT，中国大陆用户 2026 年 5 月起已经不能在境外券商买入（[中国证监会](https://www.csrc.gov.cn/csrc/c100028/c7634326/content.shtml)）。

只想买一两只、习惯把钱放交易所，直接在币安现货买 bStock 最快，不需要 CRE8。

资产在 Solana 或以太坊上，或者想要几百只的选择，可以看其他发行方的股票代币，比如 Ondo、xStocks。几家的差别见 [代币化美股怎么选](/zh/blog/tokenized-stocks-compared)。

## 有哪些风险？

bStock 不是股票。你的权利取决于发行方和托管方，发行方出问题要走破产程序。

休市时价格会偏。美股收盘后 bStock 还在交易，但没有正股成交可以参照，价格可能和下次开盘价差很多。

假币。链上同名代币很多，只认发行方公布的合约地址。

地区限制。bStock 不对美国人开放，币安没有公布完整的合格国家名单。

价格会跌。bStock 跟着股票走，股票跌它就跌；链上抵押借款还有清算风险。

用 CRE8 还多一层智能合约风险，主网前会做第三方审计，目前只在测试网。

## 常见问题

**bStock 和币安的 Binance Stocks 是一回事吗？**
不是同一个产品。Binance Stocks 是币安接美国持牌券商卖的真实美股，不能提到钱包；bStock 是链上代币。两者在币安账户里可以 1:1 互转。

**bStock 能拿到分红吗？**
能，但不是现金。先扣 30% 美国预扣税，再增加你的代币数量。

**bStock 一定要在币安买吗？**
不一定。它是 BNB Chain 上的代币，也可以在 PancakeSwap 这类 DEX 买，或者用 CRE8 这样的应用在链上买。

**bStock 有多少只？**
截至 2026 年 10 月中旬报道是近 100 只，rwa.xyz 2026 年 11 月 23 日统计 112 个代币。

**bStock 最少买多少？**
在币安现货 5 美元起。在 CRE8 买组合，每笔 50 USDT 起，定投每期最少 10 USDT。

**美股休市时能买 bStock 吗？**
在币安现货可以，24 小时交易，但休市时价格可能偏离正股。在 CRE8，股票代币只在美股交易时段成交，休市时下的单排队到下次开盘，在那之前 USDT 一直在你自己的账户里。

**CRE8 买的是 bStock 吗？**
是。CRE8 组合里的美股都以 bStock 形式持有，放在你自己的智能账户。

## 下一步

想看 bStock 组成的组合长什么样，可以先逛 [全部组合](https://cre8.finance/zh/portfolios)，每个组合都列了持仓和权重。还没决定用哪种方法，可以看总览 [用 USDT 买美股有哪几种方法](/zh/blog/buy-us-stocks-with-usdt)。

---

资料来源（查询日期 2026-11-23）：[Binance Learn：bStocks](https://www.binance.com/en/learn/bstocks)、[BNB Chain 官方博客](https://bnbchain.org/en/blog/introducing-bstocks-on-bnb-chain-trade-24-7-with-zero-fees-deploy-across-defi-protocols-with-full-self-custody)、[DefiLlama Research](https://defillama.com/research/spotlight/stocks-onchain-how-binance-stocks-and-bstocks-cover-the-full-equities-spectrum)、[Finance Magnates](https://www.financemagnates.com/cryptocurrency/exchange/binance-claims-fastest-1-billion-sprint-in-bstocks-with-6-billion-in-share-conversions/)、[rwa.xyz](https://app.rwa.xyz/stocks)、[Crypto Briefing：休市成交](https://cryptobriefing.com/binance-bstocks-volume-us-market-closures/)、[Crypto Briefing：Lista DAO](https://cryptobriefing.com/bstocks-lista-dao-defi-integration/)、[CryptoSlate：Venus](https://cryptoslate.com/tokenized-stocks-defi-collateral-venus/)、[CryptoSlate：ESMA](https://cryptoslate.com/eu-regulator-warns-tokenized-stocks-may-mislead-retail-investors/)、[Bitcoin.com](https://news.bitcoin.com/crypto-news/binance-expands-bstocks-collateral-as-tokenized-stock-volumes-jump-33x/)、[Traders Union](https://tradersunion.com/news/brokers-news/show/2941539-binance-launches-automated-bstock-purchases/)、[DEXTools](https://www.dextools.io/news/xstocks-on-bnb-chain-the-reality-of-245-trading)、[中国证监会](https://www.csrc.gov.cn/csrc/c100028/c7634326/content.shtml)、[CRE8 使用指南](https://cre8.finance/zh/how-it-works)。

本文不是投资建议。
