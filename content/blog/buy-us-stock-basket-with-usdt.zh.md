---
title: 用 USDT 一次买一篮美股：Mag7、AI 芯片怎么配
slug: /zh/blog/buy-us-stock-basket-with-usdt
lang: zh-Hans
seo_title: 用 USDT 一次买一篮美股：七巨头、AI 芯片
description: 一笔 USDT 买齐一篮美股：美股七巨头和 AI 芯片组合的权重怎么配，自动再平衡怎么维持比例。
author: CRE8
published: 2026-11-23
updated: 2026-11-23
status: 草稿（第 6 篇）
---

# 用 USDT 一次买一篮美股：Mag7、AI 芯片怎么配

作者：CRE8 · 2026 年 11 月 23 日 · 阅读约 8 分钟

用 USDT 买一篮美股，可以在交易所一只一只买、在券商或加密平台买 ETF，也可以用 CRE8 一笔 USDT 按权重买齐一整篮。CRE8 的美股七巨头组合是 7 只等权，每只约 14.3%；AI 芯片组合是英伟达、台积电、英特尔、SK 海力士各 21.25%，博通、Marvell、Penguin Solutions 各 5%。买完以后比例会自动维持：精选组合每月调仓一次，任何一只偏离目标超过 5 个百分点也会调。

## 一篮子和再平衡是什么意思？

一篮子就是按事先定好的比例，同时持有好几只股票。比如 1,000 U 买美股七巨头，每只放约 143 U，而不是全押一只。

再平衡（也叫调仓）是把跑掉的比例调回来。股票涨跌不一样，过一阵子涨多的那只占比会变大，跌多的变小。再平衡就是卖掉一点涨多的、补一点跌多的，让每只回到目标比例。

CRE8 是 BNB Chain 上的应用，用 USDT 一次买入美股代币和加密资产的组合，资产放在你自己的智能账户里（BNB Chain 上只属于你的账户，转出必须你本人签名）。美股以 bStock 形式持有。bStock 是币安关联公司 BTech Holdings 发行的美股代币，每枚由托管的正股 1:1 支撑；币安官方写明「bStocks 不是股票」（[Binance Learn](https://www.binance.com/en/learn/bstocks)）。

## 美股七巨头组合怎么配？

CRE8 的[美股七巨头组合](https://cre8.finance/zh/portfolios/mag7)是七只等权：苹果、谷歌、亚马逊、Meta 各 14.29%，微软、英伟达、特斯拉各 14.28%（[CRE8 llms.txt](https://cre8.finance/llms.txt)，2026-11-23 查询）。

![chart](chart:weights-mag7)

![chart](chart:nav-mag7)

等权的意思是不按市值，每只放一样多的钱。这样市值最大的那一两只不会占掉大头。

模型年化是 +13.1%，截至 2026 年 11 月 22 日。这是回测：用现在的权重套 2024 年 11 月 22 日到 2026 年 11 月 22 日的历史收盘价算出来的复利年化，不是实盘战绩。同一个页面也列出近 30 天是 −13.0%，近 1 年是 +0.4%（[美股七巨头组合页](https://cre8.finance/zh/portfolios/mag7)）。

## AI 芯片组合怎么配？

CRE8 的[AI 芯片组合](https://cre8.finance/zh/portfolios/ai-chips)有 7 只：英伟达、台积电、英特尔、SK 海力士各 21.25%，博通、Marvell、Penguin Solutions 各 5%（[CRE8 llms.txt](https://cre8.finance/llms.txt)）。

![chart](chart:weights-ai-chips)

![chart](chart:nav-ai-chips)

为什么不是等权？CRE8 挑贴合主题、又能在链上用足够流动性买到的股票。链上池子深的放核心仓位，池子浅的每只约 5%。池子浅的股票买多了，成交价会被推高，所以只放一小份（[AI 芯片组合页](https://cre8.finance/zh/portfolios/ai-chips)）。

模型年化是 +61.4%，截至 2026 年 11 月 22 日，计算方式和上面一样。波动也大：同一页列出近 30 天 −29.3%、近 90 天 −31.5%。只有 7 只、集中在一个行业，涨跌都会比七巨头猛。

想配 AI 相关的，CRE8 还有两个更集中的主题组合：AI 存储（SK 海力士、美光、闪迪各约三分之一，模型年化 +228.2%）和韩国半导体（SK 海力士、韩国大盘 ETF EWY 各 50%，模型年化 +111.0%），数字同样是截至 2026 年 11 月 22 日的回测。另有 3 倍半导体组合（SOXL 100%），它是每日重置的 3 倍杠杆 ETF，风险很高，也不提供加息策略。

## 七巨头和 AI 芯片，差在哪？

两个组合都有英伟达，但思路不一样。七巨头买的是美股市值最大的几家公司，横跨手机、云、广告、电商、电动车，行业分得比较开。AI 芯片只押一条产业链，从设计芯片的英伟达、博通，到代工的台积电、做存储的 SK 海力士。

所以两者的波动差很多。截至 2026 年 11 月 22 日，七巨头近 90 天是 −9.0%，AI 芯片是 −31.5%；拉长到两年的回测，AI 芯片又比七巨头高得多。七巨头更接近「买一篮大型科技股」，行业分散一些；AI 芯片押的是一个行业，适合能承受大起大落的人。

两个都想要，可以各买一份。两个组合各自独立，各自调仓，钱也不会混在一起。

## 再平衡多久做一次？

精选组合每月调仓一次。另外，任何一只偏离目标权重超过 5 个百分点，也会马上触发调仓（[CRE8 使用指南](https://cre8.finance/zh/how-it-works)）。

「5 个百分点」是绝对差。目标 21.25% 的英伟达，涨到 26.25% 以上，或跌到 16.25% 以下，就会触发。

自己配的组合也会帮你调，频率可以选每天、每周、每月或每季。

调仓也是交易，同样只走白名单里的链上 DEX（PancakeSwap、KyberSwap、OpenOcean），股票代币只在美股交易时段成交。休市时该调的仓，会等下次开盘。

## 能不能自己配一篮？

能。在 CRE8 里自己挑股票、定比例，CRE8 一样帮你调仓，频率四选一：每天、每周、每月、每季。

比如想用七巨头的名单，但英伟达多放一点、特斯拉少放一点，就可以自己配。买入一样是每笔 50 USDT 起。

## 用 1,000 U 走一次是什么样？

假设你有 1,000 U，想买 AI 芯片组合。

在 CRE8 打开 AI 芯片组合，输入 1,000 USDT，确认一次。英伟达、台积电、英特尔、SK 海力士各分到 212.5 U，博通、Marvell、Penguin Solutions 各分到 50 U。大单会按每个资产的单笔上限自动拆成几笔。

自己在交易所买同样一篮，就是下 7 单，每单金额自己算。币安单只 bStock 最低 5 美元（[Binance Learn](https://www.binance.com/en/learn/bstocks)）。之后比例跑掉，也要自己算、自己调。

再看调仓怎么触发。下面是假设的情况，不算手续费和滑点：

如果其他 6 只不动，英伟达涨 30%，它从 212.5 U 变成约 276.3 U，组合共约 1,063.8 U，英伟达占 25.97%，偏离 4.72 个百分点，还没到 5，等月度调仓再调。

如果英伟达涨 35%，它变成约 286.9 U，组合共约 1,074.4 U，英伟达占 26.70%，偏离 5.45 个百分点，马上触发调仓。系统会卖出约 58.6 U 的英伟达，补到其他 6 只，让英伟达回到约 228.3 U，也就是 21.25%。

CRE8 目前只在 BNB Chain 测试网，用的是免费的测试 USDT，价格是模拟的，不涉及真钱。

## 几种买法放在一起比

| | 交易所逐只买 | 自己在链上逐只买 | 券商或加密平台买 ETF | CRE8（测试网） |
|---|---|---|---|---|
| 下几单 | 一只一单 | 一只换一次 | 一只 ETF 一单 | 一笔 USDT 买齐 |
| 比例谁定 | 自己算 | 自己算 | ETF 发行方定 | 组合页公开；也可以自己配 |
| 再平衡 | 自己调 | 自己调 | ETF 内部调，规则看各 ETF | 精选组合每月＋偏离 5 个百分点；自己配的选每天／周／月／季 |
| 能直接用 USDT 吗 | 能 | 能 | 多数券商要先换法币；币安的 Binance Stocks 下单时把 USDT 换成 USDC | 能 |
| 资产放哪 | 交易所账户 | 自己的钱包 | 券商或平台的账户 | 自己的智能账户 |
| 买到的是什么 | 股票代币 | 股票代币 | 真股或真 ETF 份额 | 股票代币和加密资产 |
| 可选范围 | bStock 近 100 只 | 看 DEX 上有哪些 | 几千只股票和 ETF | 有链上流动性的 bStock 和加密资产 |
| 最低金额 | 单只 5 美元起 | 看 gas | 视券商而定 | 每笔 50 USDT |
| 目前状态 | 正式上线 | 正式上线 | 正式上线 | BNB Chain 测试网，不涉及真钱 |

资料查询日：2026-11-23。bStock 数量据 [Finance Magnates](https://www.financemagnates.com/cryptocurrency/exchange/binance-claims-fastest-1-billion-sprint-in-bstocks-with-6-billion-in-share-conversions/) 2026 年 10 月 15 日报道；Binance Stocks 见 [Binance Learn](https://www.binance.com/en/learn/binance-stocks)。

## 什么情况用别的方法就好？

想要一只 ETF 就搞定，又能开户入金：在券商买 ETF，拿到的是真份额。Binance Stocks 也有 7,000 多只美股和 ETF，用 U 下单会换成 USDC，但份额由合作券商 Alpaca 托管，不能提到自己钱包（[Binance Learn](https://www.binance.com/en/learn/binance-stocks)）。

只想买一两只：在币安直接下单最快，不需要一篮子。

要 24 小时交易：币安现货 24 小时都能成交，CRE8 只在美股交易时段成交。

中国大陆用户要注意：2026 年 5 月 22 日起，境外券商不能再为内地存量用户提供买入和入金，富途、老虎 6 月 12 日起照办（[证监会](https://www.csrc.gov.cn/csrc/c100028/c7634326/content.shtml)、[澎湃](https://www.thepaper.cn/newsDetail_forward_33309776)）。

## 有哪些风险？

价格会跌。一篮子分散的是单只股票的风险，不是整个市场的风险。七巨头全是大型科技股，AI 芯片集中在一个行业，行业一跌整篮一起跌。

模型年化不是承诺。它是用现在的权重套历史价格算的回测，换一个时间段数字会差很多，测试网上的余额也是按模拟价格变动。

bStock 不是股票。你持有的是发行方的凭证，分红先扣 30% 美国预扣税，再折成更多代币，不发现金（[Binance Learn](https://www.binance.com/en/learn/bstocks)）。

链上池子有深有浅。池子浅的股票，大额买卖会有滑点，也就是成交价比报价差一些。

再平衡不保证赚钱。它只是把比例调回来，卖掉的那只之后也可能继续涨。

智能合约风险。CRE8 用智能合约运作，上主网前会做第三方审计。

## 常见问题

### 最少投多少？

每笔买入 50 USDT 起。买 AI 芯片组合的话，5% 的那几只各分到 2.5 U。

### 组合的成分会变吗？

可能。成分和权重以官网组合页为准，本文写的是 2026 年 11 月 23 日查到的数字。

### 美股休市时能买吗？

可以下单，但股票代币只在美股交易时段成交。休市时下的单会排队到下次开盘，在那之前 USDT 一直在你自己的账户里。

### 收费吗？

测试网全部免费，gas 也由 CRE8 付。主网费率会在上线前公布。

### 卖出以后钱去哪？

组合可以部分或全部卖回 USDT，钱回到你的账户，再提到任意 BNB Chain 地址。

## 下一步

先看一眼两个组合的完整持仓、权重和历史走势：[美股七巨头](https://cre8.finance/zh/portfolios/mag7)、[AI 芯片](https://cre8.finance/zh/portfolios/ai-chips)。

---

资料来源（查询日期 2026-11-23）：[CRE8 llms.txt](https://cre8.finance/llms.txt)、[CRE8 美股七巨头组合页](https://cre8.finance/zh/portfolios/mag7)、[CRE8 AI 芯片组合页](https://cre8.finance/zh/portfolios/ai-chips)、[CRE8 使用指南](https://cre8.finance/zh/how-it-works)、[Binance Learn：bStocks](https://www.binance.com/en/learn/bstocks)、[Binance Learn：Binance Stocks](https://www.binance.com/en/learn/binance-stocks)、[Finance Magnates](https://www.financemagnates.com/cryptocurrency/exchange/binance-claims-fastest-1-billion-sprint-in-bstocks-with-6-billion-in-share-conversions/)、[中国证监会](https://www.csrc.gov.cn/csrc/c100028/c7634326/content.shtml)、[澎湃](https://www.thepaper.cn/newsDetail_forward_33309776)。

本文只是说明一篮子怎么配、怎么维持比例，不是投资建议。
