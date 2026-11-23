---
title: 代币化美股怎么选：bStock、xStocks、Ondo 等几家发行方差在哪
slug: /zh/blog/tokenized-stocks-compared
lang: zh-Hans
author: CRE8
published: 2026-11-23
updated: 2026-11-23
status: 草稿（第 3 篇）
---

# 代币化美股怎么选：bStock、xStocks、Ondo 等几家发行方差在哪

作者：CRE8 · 2026 年 11 月 23 日 · 阅读约 10 分钟

代币化美股主要有五家发行方：币安关联公司的 bStock、Kraken 旗下的 xStocks、Ondo、Robinhood 和 Dinari。几家都用托管的正股支撑代币，差别在法律形式、分红怎么发、在哪条链、能不能提到自己钱包、谁能买。钱在币安或 BNB Chain 上，bStock 和 Ondo 最顺手；要最多的选择看 Ondo；在 Solana 等多条链上用看 xStocks；美国用户目前只有 Dinari 对合格投资人开放。

## 代币化美股是什么？现在有哪几家？

代币化美股是发行方在区块链上发的代币，价格跟着某只美股走，背后由发行方托管的正股或 ETF 支撑。你持有的是发行方的凭证、票据或合约，不是登记在你名下的股票。

截至 2026 年 11 月 23 日，第三方数据站 rwa.xyz 统计全网美股代币总值约 33.7 亿美元，持有人约 497 万。按规模排：bStock 约 12 亿美元，Ondo 约 8.5 亿美元，xStocks 约 6.5 亿美元，Robinhood 约 1.3 亿美元；Dinari 不在前十（[rwa.xyz](https://app.rwa.xyz/stocks)）。rwa.xyz 的口径和各家自报数字不完全一致，看量级就好。

## 五家放在一起比

下表每一格都来自发行方或平台的官方文件，个别来自主流媒体，链接在后文和文末。官方没有公开、我们也查不到可靠来源的，写「官方未公开」。

| | bStock | xStocks | Ondo | Robinhood | Dinari |
|---|---|---|---|---|---|
| 发行方 | BTech Holdings（币安关联公司） | Backed Assets (JE)，泽西岛 SPV；Kraken 已收购 Backed | Ondo Global Markets (BVI)，破产隔离 SPV | Robinhood Assets (Jersey)（2026-07-01 起的新版） | Dinari |
| 法律上是什么 | 凭证，官方写明不是股票 | 由正股或 ETF 1:1 支撑的代币 | 结构化票据（债务工具） | 代币化债务证券，只有经济曝险 | 由对应证券支撑的代币 |
| 托管与证明 | 受监管托管机构（未点名），每天公布抵押证明 | Alpaca Securities 为主、InCore Bank 为辅，每周储备证明 | 美国受监管机构（未点名），每日鉴证，超额抵押 | 官方未公开 | 合格托管机构（未点名） |
| 分红 | 扣 30% 美国预扣税后折成代币 | 自动再投资，增加代币 | 扣税后再投资 | 新版官方未公开 | 以 USDC 现金发放 |
| 投票权 | 官方未公开 | 没有 | 没有 | 没有 | 官方未公开 |
| 散户能否直接赎回 | 币安账户内可和股票 1:1 互转；链上直接赎回官方未公开 | 只有在 Backed 完成 KYC 的客户 | 完成 Ondo KYC 可赎回成现金或稳定币，最低 1 美元，费用 0.05% | 新版官方未公开 | 官方未公开 |
| 在哪条链 | 只在 BNB Chain | Solana、以太坊、BNB Chain 等 10 条 | 以太坊、BNB Chain、Solana | Robinhood Chain | 以太坊、Avalanche、Arbitrum、Base |
| 能否提到自己钱包 | 能，需通过资格和制裁检查 | 能 | 能 | 能，用 Robinhood Wallet | 钱包要先 KYC；美国客户代币暂不能转让 |
| 交易时段 | 币安现货 24/7 | Kraken 上 10 只 24/7，其余 24/5 | 约 24/5 | 新版 24/7 | 官方未公开 |
| 最低金额 | 币安 5 美元 | Kraken 1 美元 | 申购赎回 1 美元 | 新版官方未公开 | 官方未公开 |
| 不对谁开放 | 美国和美国人 | 美国、加拿大、英国、澳洲等 | 美国、加拿大等；英国、欧洲经济区、香港、新加坡要合格投资人 | 美国、加拿大、英国、瑞士、阿联酋 | 2026-08 起开放合格美国投资人 |
| 标的数量 | 近 100 只 | Kraken 上 131 项 | 450 多只 | 官方未公开 | 724 只（二手报道） |

资料查询日：2026 年 11 月 23 日。表里几个术语：SPV 是专门为发行这类产品设立的独立公司；破产隔离指发行方母公司出事时，这家公司的资产不被一起清算；KYC 是身份验证；赎回是把代币交回发行方，换回现金或稳定币。

## 法律上，你持有的到底是什么？

五家都不是把股票直接登记到你名下。差别在你拿到的是哪种「凭证」。

bStock 是 BTech Holdings 依阿布扎比金融监管局（ADGM FSRA）核准的说明书发行的凭证，代表对发行方所持证券的权益，币安官方原文写明 bStocks 不是股票（[Binance Learn](https://www.binance.com/en/learn/bstocks)）。

Ondo 的股票代币在法律上是结构化票据，也就是一种债务工具，依美国 Reg S 规则在美国境外发行（[Ondo 法律文档](https://docs.ondo.finance/ondo-stocks/legal-and-regulatory.md)）。

xStocks 由泽西岛的 Backed Assets 发行，每只代币由对应的正股或 ETF 1:1 支撑，各只分开管理（[xStocks 文档](https://docs.xstocks.fi/)）。

Robinhood 的说法最直接：持有人只有经济曝险，对标的股票没有法律或受益权利。它在欧盟的旧版是和 Robinhood Europe 签的衍生品合约（[Robinhood EU FAQ](https://robinhood.com/eu/en/support/articles/stock-tokens-faq)），2026 年 7 月 1 日起的新版改由 Robinhood Assets (Jersey) 发行代币化债务证券（[Robinhood 新闻室](https://robinhood.com/newsroom/robinhood-accelerates-global-expansion-robinhood-chain-mainnet-stock-tokens-agentic-trading/)）。

Dinari 的代币由合格托管机构持有的对应证券支撑（[The Block](https://www.theblock.co/post/410588)）。

## 谁托管股票，怎么证明真的有？

xStocks 公开的托管信息最多：以 Alpaca Securities 为主、InCore Bank 为辅，另有劳合社（Lloyd's）最高 1.75 亿美元的附加保障，每周公布储备证明（[Kraken FAQ](https://support.kraken.com/articles/xstocks-faq)）。

bStock 和 Ondo 都没有点名托管机构，但公布频率更高：bStock 每天公布抵押证明（[Binance Learn](https://www.binance.com/en/learn/bstocks)）；Ondo 每天由第三方鉴证，由独立的担保代理人持有担保权益，并且超额抵押，也就是托管资产比代币价值多一些（[Ondo 文档](https://docs.ondo.finance/ondo-global-markets/overview)）。

Robinhood 新版和 Dinari 的托管机构名称，我们没有查到官方说法。

## 分红怎么拿？

只有 Dinari 发现金。Dinari 以 USDC 发放股息，前提是你的钱包已经在 Dinari 登记（[Dinari 文档](https://docs.dinari.com/docs/dividend-payments.md)）。

其他几家都把分红变成更多代币：bStock 先扣 30% 美国预扣税，再用乘数增加代币数量；Ondo 扣税后再投资；xStocks 也用乘数自动再投资（[Binance Learn](https://www.binance.com/en/learn/bstocks)、[Ondo 文档](https://docs.ondo.finance/ondo-global-markets/overview)、[Kraken FAQ](https://support.kraken.com/articles/xstocks-faq)）。Robinhood 欧盟旧版可以领现金股息，新版官方还没写。

## 能不能放进自己的钱包？在 BNB Chain 上能用哪几家？

bStock、xStocks、Ondo 都能提到自己的钱包。BNB Chain 用户能直接用的是这三家：

bStock 只发在 BNB Chain 上，可以提到任何兼容 BNB Chain 的钱包，需通过资格和制裁检查（[Binance Learn](https://www.binance.com/en/learn/bstocks)）。rwa.xyz 统计 bStock 在 BNB Chain 上约 12 亿美元，是这条链上最大的美股代币（[rwa.xyz BNB Chain](https://app.rwa.xyz/networks/bnb-chain)）。

Ondo 发在以太坊、BNB Chain 和 Solana 上，在 BNB Chain 上主要通过 PancakeSwap 交易（[BNB Chain 官方博客](https://www.bnbchain.org/en/blog/ondo-global-markets-brings-100-tokenized-u-s-stocks-etfs-to-bnb-chain)）。

xStocks 覆盖的链最多，2026 年 4 月 30 日起在 BNB Chain 上有 50 多只（[BNB Chain 官方博客](https://www.bnbchain.org/en/blog/xstocks-is-now-live-on-bnb-chain-with-50-tokenized-equities-with-100-more-coming-soon)）。

Robinhood 新版在自家的 Robinhood Chain 上，用 Robinhood Wallet 自己保管。Dinari 在以太坊、Avalanche、Arbitrum、Base 上，所有交易钱包都要先 KYC，未验证的钱包交易会失败（[Dinari KYC](https://docs.dinari.com/api/identity-verification-kyc)）。这两家目前都不在 BNB Chain 上。

想详细了解在 BNB Chain 上怎么自己保管，见 [美股代币能放自己钱包吗](/zh/blog/self-custody-us-stock-tokens-bnb-chain)。

## 能拿去 DeFi 抵押借钱吗？

bStock 在 BNB Chain 上的 DeFi 用途最明确。Venus 核心池 2026 年 6 月 20 日上架 TSLAB、NVDAB、SPCXB 当抵押品（[CryptoSlate](https://cryptoslate.com/tokenized-stocks-defi-collateral-venus/)），Lista DAO 约 6 月 16 日支持 NVDAB、TSLAB、MUB（[Crypto Briefing](https://cryptobriefing.com/bstocks-lista-dao-defi-integration/)）。

xStocks 官方列了 Kamino、Morpho 等抵押借款渠道；在 BNB Chain 上接 Venus、Flux，官方写的是「计划中」（[Kraken FAQ](https://support.kraken.com/articles/xstocks-faq)、[BNB Chain 官方博客](https://www.bnbchain.org/en/blog/xstocks-is-now-live-on-bnb-chain-with-50-tokenized-equities-with-100-more-coming-soon)）。Ondo 官方列了 Morpho 等协议，BNB Chain 上主要是 PancakeSwap 交易。Dinari 的美国客户不能用在 DeFi（[Dinari 文档](https://docs.dinari.com/docs/us)）。

## 用 1,000 USDT 比一次：同样想买英伟达，各家怎么走？

假设你在 BNB Chain 上有 1,000 USDT，想持有英伟达。

bStock：在币安现货直接买，5 美元起；或提到钱包后在 PancakeSwap 换。之后可以拿去 Venus 当抵押，NVDAB 的抵押率是 60%，1,000 美元的仓位最多借 600 美元。

Ondo：在 BNB Chain 上通过 PancakeSwap 买。如果你完成了 Ondo 的 KYC，以后可以直接把代币赎回成现金或稳定币，赎回费 0.05%，1,000 美元是 0.5 美元（[Ondo 申购赎回](https://docs.ondo.finance/ondo-stocks/investing-and-redeeming.md)）。

xStocks：在 BNB Chain 上的 50 多只里，先确认有没有你要的那只。也可以在 Kraken 买，用 USDG 或美元买免手续费，用闪兑（Convert）收 1%，1,000 美元是 10 美元（[Kraken FAQ](https://support.kraken.com/articles/xstocks-faq)）。

Robinhood、Dinari：不在 BNB Chain 上，要换链、换钱包，Dinari 还要先做钱包 KYC。

拿到股息时也不一样。同样一笔股息，bStock、Ondo、xStocks 会变成多出来的代币；Dinari 会把 USDC 打到你登记的钱包。

## 怎么选？按你的情况对一下

钱在币安或 BNB Chain 上、想拿股票代币去 Venus 或 Lista 抵押：bStock 最顺手：它是 BNB Chain 上规模最大的美股代币，Venus 和 Lista 都已支持部分 bStock 当抵押。

要最多的选择：Ondo 有 450 多只，Dinari 724 只但钱包要 KYC，xStocks 在 Kraken 上 131 项（[Ondo 文档](https://docs.ondo.finance/ondo-global-markets/overview)、[KuCoin News](https://www.kucoin.com/news/flash/dinari-launches-724-tokenized-us-stocks-for-eligible-investors)、[Kraken FAQ](https://support.kraken.com/articles/xstocks-faq)）。

想以后能直接找发行方赎回：Ondo 写得最清楚，最低 1 美元，0.05% 赎回费，前提是完成 KYC。

资产在 Solana 或其他链：xStocks 覆盖 10 条链（[Finance Magnates](https://www.financemagnates.com/fintech/krakens-xstocks-backing-assets-top-800-million-as-holders-pass-300000/)）。

要现金分红：Dinari 发 USDC。

人在美国：bStock、xStocks、Ondo、Robinhood 都不对美国人开放，Dinari 2026 年 8 月 4 日起开放给合格美国投资人（[The Block](https://www.theblock.co/post/410588)）。

要完整的股东权利：五家都给不了，去海外券商买真股票。几种做法的差别见总览 [用 USDT 买美股有哪几种方法](/zh/blog/buy-us-stocks-with-usdt)。

## CRE8 用的是哪家？

CRE8 只用 bStock。CRE8 是 BNB Chain 上的应用，用 USDT 一次买入美股代币和加密资产的组合，组合里的美股都以 bStock 形式持有，放在你自己的智能账户（BNB Chain 上只属于你的账户，转出必须你本人签名）（[使用指南](https://cre8.finance/zh/how-it-works)）。

所以如果你想要的是 Ondo 或 xStocks 的代币，或者想买 bStock 没有的股票，CRE8 目前帮不上，直接去对应的平台买就好。bStock 本身的细节见 [bStock 是什么](/zh/blog/what-is-bstock)。

CRE8 目前只在 BNB Chain 测试网，用免费的测试 USDT，不涉及真钱，主网时间还没定。

## 有哪些风险？

你持有的不是股票。不管哪家，权利都取决于发行方和托管方，发行方出问题要走破产程序。欧洲证券和市场管理局（ESMA）的执行董事曾提醒，股票代币通常不带股东权利，散户可能误解（[CryptoSlate](https://cryptoslate.com/eu-regulator-warns-tokenized-stocks-may-mislead-retail-investors/)）。

转账可能被限制。Dinari 文档写明被标记的钱包可能被限制转账和交易；交易所也保留限制账户的权利（[Dinari 文档](https://docs.dinari.com/docs/us)、[Binance Learn](https://www.binance.com/en/learn/bstocks)）。

假币。链上常有同代号的假代币，只认发行方公布的合约地址。纽约证券交易所和世界交易所联合会都对假的代币化股票发过警告（[crypto.news](https://crypto.news/nyse-warns-fake-tokenized-stocks-threaten-retail/)）。

休市时价格会偏。美股收盘后代币还在交易，发行方没法对冲，价格可能和下次开盘价差很多。xStocks 的申购赎回只有 24/5，周末要卖只能靠市场上有人接（[xStocks 文档](https://docs.xstocks.fi/)）。

地区限制。各家的完整受限国家名单大多没公开，用之前看平台的地区条款。

## 常见问题

**几家的代币能互换吗？**
不能直接互换。它们是不同发行方的不同代币，要先卖成 USDT 再买另一家。

**哪家最安全？**
没有统一答案。几家的托管、证明频率、法律形式各有不同，表里列的是公开信息，最终取决于发行方和托管方本身。

**表里的信息多久会变？**
这些产品变化很快，表里是 2026 年 11 月 23 日查到的公开信息。发行方改了条款，我们会更新本文并改「更新日期」。

**中国大陆用户能买吗？**
几家发行方都没有公开写明中国大陆是否受限，使用前要看平台的地区条款。

**CRE8 组合里能买到 Ondo 或 xStocks 吗？**
不能。CRE8 组合里的美股目前都是 bStock。

## 下一步

想看 bStock 组成的组合，可以先逛 [全部组合](https://cre8.finance/zh/portfolios)，每个组合都列了持仓和权重。

---

资料来源（查询日期 2026-11-23）：[rwa.xyz](https://app.rwa.xyz/stocks)、[rwa.xyz BNB Chain](https://app.rwa.xyz/networks/bnb-chain)、[Binance Learn：bStocks](https://www.binance.com/en/learn/bstocks)、[Kraken xStocks FAQ](https://support.kraken.com/articles/xstocks-faq)、[xStocks 文档](https://docs.xstocks.fi/)、[Finance Magnates：xStocks](https://www.financemagnates.com/fintech/krakens-xstocks-backing-assets-top-800-million-as-holders-pass-300000/)、[BNB Chain 官方博客：xStocks](https://www.bnbchain.org/en/blog/xstocks-is-now-live-on-bnb-chain-with-50-tokenized-equities-with-100-more-coming-soon)、[Ondo 概览](https://docs.ondo.finance/ondo-global-markets/overview)、[Ondo 法律文档](https://docs.ondo.finance/ondo-stocks/legal-and-regulatory.md)、[Ondo 申购赎回](https://docs.ondo.finance/ondo-stocks/investing-and-redeeming.md)、[Ondo 交易时段](https://docs.ondo.finance/ondo-stocks/market-hours-and-trading-availability.md)、[Ondo 资格](https://docs.ondo.finance/ondo-global-markets/eligibility)、[BNB Chain 官方博客：Ondo](https://www.bnbchain.org/en/blog/ondo-global-markets-brings-100-tokenized-u-s-stocks-etfs-to-bnb-chain)、[Robinhood 新闻室](https://robinhood.com/newsroom/robinhood-accelerates-global-expansion-robinhood-chain-mainnet-stock-tokens-agentic-trading/)、[Robinhood EU FAQ](https://robinhood.com/eu/en/support/articles/stock-tokens-faq)、[The Block：Robinhood](https://www.theblock.co/post/406918/)、[Dinari 文档](https://docs.dinari.com/docs/us)、[Dinari KYC](https://docs.dinari.com/api/identity-verification-kyc)、[Dinari 股息](https://docs.dinari.com/docs/dividend-payments.md)、[The Block：Dinari](https://www.theblock.co/post/410588)、[Cryptonomist：Dinari](https://en.cryptonomist.ch/2026/08/05/tokenized-stock-trading-dinari-usdc/)、[KuCoin News](https://www.kucoin.com/news/flash/dinari-launches-724-tokenized-us-stocks-for-eligible-investors)、[Finance Magnates：bStock](https://www.financemagnates.com/cryptocurrency/exchange/binance-claims-fastest-1-billion-sprint-in-bstocks-with-6-billion-in-share-conversions/)、[CryptoSlate：Venus](https://cryptoslate.com/tokenized-stocks-defi-collateral-venus/)、[Crypto Briefing：Lista DAO](https://cryptobriefing.com/bstocks-lista-dao-defi-integration/)、[CryptoSlate：ESMA](https://cryptoslate.com/eu-regulator-warns-tokenized-stocks-may-mislead-retail-investors/)、[crypto.news：NYSE](https://crypto.news/nyse-warns-fake-tokenized-stocks-threaten-retail/)、[CRE8 使用指南](https://cre8.finance/zh/how-it-works)。

本文不是投资建议。
