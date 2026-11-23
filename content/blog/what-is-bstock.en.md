---
title: What Is bStock? How to Buy It and How It Differs From Real Shares
slug: /blog/what-is-bstock
lang: en
author: CRE8
published: 2026-11-23
updated: 2026-11-23
status: Draft (post 2)
---

# What Is bStock? How to Buy It and How It Differs From Real Shares

By CRE8 · November 23, 2026 · 8 min read

bStock is a tokenized US stock issued on BNB Chain by BTech Holdings, a Binance affiliate. Each token is backed 1:1 by a real share held with a custodian, so its price tracks the underlying stock. You can buy it with USDT on Binance, withdraw it to your own BNB Chain wallet, or buy it on an on-chain exchange. The key difference from a real share: you hold a certificate from the issuer, and Binance states plainly that "bStocks are not shares" ([Binance Learn](https://www.binance.com/en/learn/bstocks)).

## What exactly is a bStock?

A bStock is a stock token. The issuer buys real shares and holds them with a custodian, then issues the same number of tokens on a blockchain, one token per share. On lending protocols such as Venus and Lista, the NVIDIA bStock trades as NVDAB and the Tesla one as TSLAB ([CryptoSlate](https://cryptoslate.com/tokenized-stocks-defi-collateral-venus/), [Crypto Briefing](https://cryptobriefing.com/bstocks-lista-dao-defi-integration/)).

The basics, all from Binance's own bStocks page ([Binance Learn](https://www.binance.com/en/learn/bstocks)):

| Item | Detail |
|---|---|
| Issuer | BTech Holdings Limited, a Binance affiliate |
| Legal basis | A prospectus approved by the ADGM Financial Services Regulatory Authority (Abu Dhabi) |
| Legal form | Certificates representing an interest in securities held by the issuer |
| Backing | 1:1 by shares held with a regulated custodian; daily proof of collateral |
| Chain | BNB Chain only (BEP-20 tokens) |
| Dividends | 30% US withholding tax deducted, then paid as extra tokens, not cash |
| Not available to | The US and US persons |

A proof of collateral is a daily public report showing how many shares sit in custody and how many tokens are outstanding, so anyone can check that the two match. Binance's page describes the custodian only as a "regulated custodian" and does not name it.

bStock launched on June 11, 2026 ([DefiLlama Research](https://defillama.com/research/spotlight/stocks-onchain-how-binance-stocks-and-bstocks-cover-the-full-equities-spectrum)). Finance Magnates reported on October 15, 2026 that Binance offered close to 100 bStocks, with more than $1 billion in assets and more than $40 billion in cumulative trading volume ([Finance Magnates](https://www.financemagnates.com/cryptocurrency/exchange/binance-claims-fastest-1-billion-sprint-in-bstocks-with-6-billion-in-share-conversions/)). As of November 23, 2026, the data site rwa.xyz counted 112 bStock tokens worth about $1.2 billion, the largest of any tokenized stock issuer ([rwa.xyz](https://app.rwa.xyz/stocks)).

![chart](chart:issuers)

## How is bStock different from owning a real share?

When you buy a share through a broker, it is registered to you (or to your broker on your behalf). A bStock is a certificate from the issuer, so your rights depend on the issuer and its custodian. Here is where that shows up.

Legal status. Buying NVIDIA at a broker makes you a shareholder. Buying NVDA bStock gives you a certificate issued by BTech Holdings, which Binance itself says is not a share.

Dividends. A real share pays cash. bStock deducts 30% US withholding tax and uses a multiplier to increase the number of tokens you hold.

Trading hours. Regular US market hours cover part of each weekday. bStock trades around the clock on Binance spot ([Binance Learn](https://www.binance.com/en/learn/bstocks)). The tradeoff is that nobody can hedge against the real stock while the market is closed, so the token price can drift from where the stock opens next. Crypto Briefing reported that 62% of bStock volume in July 2026 happened while US markets were closed ([Crypto Briefing](https://cryptobriefing.com/binance-bstocks-volume-us-market-closures/)).

Where it lives. A real share stays in your brokerage account. bStock can be withdrawn to any BNB Chain-compatible wallet, subject to eligibility and sanctions checks ([Binance Learn](https://www.binance.com/en/learn/bstocks)).

What you can do with it. bStock can be posted as collateral on lending protocols, which a share in a brokerage account can't.

Binance's public page does not say whether bStock carries voting or other shareholder rights, so we don't guess here. An executive director of the European Securities and Markets Authority has warned that tokenized stocks usually come without shareholder rights and that retail buyers may misunderstand what they own ([CryptoSlate](https://cryptoslate.com/eu-regulator-warns-tokenized-stocks-may-mislead-retail-investors/)).

| | Real share (broker) | bStock |
|---|---|---|
| What you hold | A share | An issuer certificate backed 1:1 by a share |
| Where it sits | Brokerage account | Binance account, or your own BNB Chain wallet |
| Pay with USDT? | Most brokers: no, fiat first | Yes |
| Trading hours | US market hours (some brokers add overnight) | 24/7 on Binance spot |
| Dividends | Cash | Extra tokens after 30% withholding |
| Minimum | Depends on broker; fractional shares often from $2 to $5 | $5 on Binance |
| Use as on-chain collateral | No | Yes (Venus, Lista and others) |
| Account needed | Brokerage account with ID checks | A Binance account if you buy on Binance |

Data checked November 23, 2026.

## How do you buy bStock?

There are three routes: the Binance exchange, an on-chain exchange, or an app like CRE8 that buys on-chain for you.

### On Binance

This is the most direct route. Buy with USDT on Binance spot like any crypto pair, from $5, any hour of the day ([Binance Learn](https://www.binance.com/en/learn/bstocks)). The tokens stay in your Binance account unless you withdraw them.

Inside a Binance account, Binance Stocks shares and bStock convert 1:1 with no conversion fee ([Binance Learn](https://www.binance.com/en/learn/bstocks)). Binance has also reportedly added recurring buys for individual bStocks through Convert and Buy Crypto; check Binance's site for the current terms ([Traders Union](https://tradersunion.com/news/brokers-news/show/2941539-binance-launches-automated-bstock-purchases/)).

### In your own wallet, through a DEX

bStock is a BEP-20 token, so you can withdraw it from Binance to a wallet such as Binance Wallet or Trust Wallet and trade it yourself on PancakeSwap ([BNB Chain blog](https://bnbchain.org/en/blog/introducing-bstocks-on-bnb-chain-trade-24-7-with-zero-fees-deploy-across-defi-protocols-with-full-self-custody)). A DEX (decentralized exchange) is an on-chain swap pool: no account, you just sign with your wallet.

Doing it yourself takes two things. First, a little BNB for gas, the network fee every on-chain transaction pays. Second, the correct contract address. Copycat tokens with the same ticker show up on DEXs, so always check the address the issuer publishes ([DEXTools](https://www.dextools.io/news/xstocks-on-bnb-chain-the-reality-of-245-trading)).

### With CRE8, as part of a basket

CRE8 is an app on BNB Chain for buying baskets of tokenized US stocks and crypto with USDT. The stocks in every CRE8 portfolio are bStock. They sit in your own smart account, an on-chain account on BNB Chain that belongs to you: CRE8's automation can trade inside it, but moving anything out takes your signature ([How it works](https://cre8.finance/how-it-works)).

CRE8 routes trades only through allowlisted DEXs (PancakeSwap, KyberSwap and OpenOcean) and only during US market hours; orders placed while the market is closed wait for the next open. CRE8 is on BNB Chain testnet only. It uses free test USDT, no real money is involved, and there is no mainnet date yet.

## What does buying look like with 1,000 USDT?

Say you have 1,000 USDT and want NVIDIA exposure.

On Binance: one spot order for 1,000 USDT of NVDA bStock. The tokens sit in your Binance account; withdraw them to a BNB Chain wallet if you want to hold them yourself.

On a DEX: withdraw the 1,000 USDT to your own wallet, add a little BNB for gas, confirm the contract address, and swap on PancakeSwap.

On CRE8 (testnet): CRE8 sells portfolios, not single stocks. The Pelosi Portfolio holds NVDA, GOOGL, MSFT, AMZN and INTC at 19% each, plus AVGO at 5% ([Pelosi Portfolio](https://cre8.finance/portfolios/pelosi)). Put in 1,000 USDT and one payment buys the whole basket: 190 USDT of each of the first five and 50 USDT of AVGO, all as bStock in your smart account.

How a dividend lands (illustrative numbers): suppose your share of a dividend on one bStock comes to $10 gross. The 30% US withholding tax leaves $7, and that $7 is added to your position as extra tokens through the multiplier. No cash shows up in your account.

## What can you do with bStock after you buy it?

Besides holding it, you can use bStock as collateral.

On Binance: since September 21, 2026, all eligible users can post bStock as collateral in Cross Margin and Portfolio Margin, valued at a discount ([Bitcoin.com](https://news.bitcoin.com/crypto-news/binance-expands-bstocks-collateral-as-tokenized-stock-volumes-jump-33x/)).

On-chain: Venus listed TSLAB, NVDAB and SPCXB in its Core Pool on June 20, 2026, with collateral factors of 60%, 60% and 50% ([CryptoSlate](https://cryptoslate.com/tokenized-stocks-defi-collateral-venus/)). Lista DAO added NVDAB, TSLAB and MUB around June 16, 2026 ([Crypto Briefing](https://cryptobriefing.com/bstocks-lista-dao-defi-integration/)). A 60% collateral factor means $100 of NVDAB lets you borrow up to $60.

If you do this yourself, you have to watch prices; a sharp drop can get your position liquidated. CRE8's yield strategy wraps those steps in one switch. It posts the portfolio's shares as collateral, borrows a small amount of USDT into a vault to earn interest, and if prices fall to the safety line it repays part of the loan from the vault without selling the shares. The details and risks are in [How to earn yield on idle USDT and bStock](/blog/earn-yield-on-idle-usdt-and-bstock).

## When is something other than bStock the better choice?

If you want full shareholder rights and cash dividends, buy real shares through a broker. That means opening an account and funding it, and most brokers won't take USDT directly. Interactive Brokers, for example, accepts USDC, PYUSD and RLUSD but not USDT ([IBKR FAQ](https://www.interactivebrokers.com/support/faq/content/deposit-via-stablecoin-1331500535)).

If you only want one or two stocks and are happy keeping funds on an exchange, buying bStock directly on Binance spot is the quickest route. You don't need CRE8 for that.

If your crypto is on Solana or Ethereum, or you want hundreds of tickers, look at other issuers such as Ondo or xStocks. We compare them in [Tokenized stocks compared](/blog/tokenized-stocks-compared).

## What are the risks?

bStock is not a share. Your rights depend on the issuer and custodian, and if the issuer fails, holders go through an insolvency process.

Prices drift when the market is closed. bStock keeps trading after the US close, with no live stock price to anchor it, so it can open far from the next day's price.

Fake tokens. Many tokens on-chain copy the same ticker. Only trust the contract address the issuer publishes.

Regional limits. bStock isn't offered to US persons, and Binance hasn't published a full list of eligible countries.

Prices fall. bStock follows the stock down as well as up, and on-chain borrowing adds liquidation risk.

Using CRE8 adds smart contract risk. CRE8's contracts get an external audit before mainnet; for now it runs on testnet only.

## FAQ

**Is bStock the same as Binance Stocks?**
No. Binance Stocks gives you real US shares through a licensed US broker and can't be withdrawn to a wallet. bStock is an on-chain token. Inside a Binance account the two convert 1:1.

**Does bStock pay dividends?**
Yes, but not in cash. 30% US withholding tax is deducted and the rest is added as extra tokens.

**Do I have to buy bStock on Binance?**
No. It's a BNB Chain token, so you can buy it on a DEX such as PancakeSwap or through an app like CRE8 that buys on-chain.

**How many bStocks are there?**
Close to 100 according to an October 2026 report; rwa.xyz counted 112 tokens on November 23, 2026.

**What's the minimum to buy bStock?**
$5 on Binance spot. On CRE8, each portfolio purchase starts at 50 USDT, and recurring buys (DCA) start at 10 USDT per installment.

**Can I buy bStock when the US market is closed?**
On Binance spot, yes; it trades 24/7, though prices can drift from the real stock while the market is shut. On CRE8, stock tokens trade only during US market hours. Orders placed while the market is closed wait for the next open, and your USDT stays in your own account until then.

**Does CRE8 use bStock?**
Yes. Every US stock in a CRE8 portfolio is held as bStock in your own smart account.

## Next step

To see what a basket of bStock looks like, browse [all portfolios](https://cre8.finance/portfolios); each one lists its holdings and weights. If you're still weighing your options, start with [How to buy US stocks with USDT](/blog/buy-us-stocks-with-usdt).

---

Sources (checked November 23, 2026): [Binance Learn: bStocks](https://www.binance.com/en/learn/bstocks), [BNB Chain blog](https://bnbchain.org/en/blog/introducing-bstocks-on-bnb-chain-trade-24-7-with-zero-fees-deploy-across-defi-protocols-with-full-self-custody), [DefiLlama Research](https://defillama.com/research/spotlight/stocks-onchain-how-binance-stocks-and-bstocks-cover-the-full-equities-spectrum), [Finance Magnates](https://www.financemagnates.com/cryptocurrency/exchange/binance-claims-fastest-1-billion-sprint-in-bstocks-with-6-billion-in-share-conversions/), [rwa.xyz](https://app.rwa.xyz/stocks), [Crypto Briefing: after-hours volume](https://cryptobriefing.com/binance-bstocks-volume-us-market-closures/), [Crypto Briefing: Lista DAO](https://cryptobriefing.com/bstocks-lista-dao-defi-integration/), [CryptoSlate: Venus](https://cryptoslate.com/tokenized-stocks-defi-collateral-venus/), [CryptoSlate: ESMA](https://cryptoslate.com/eu-regulator-warns-tokenized-stocks-may-mislead-retail-investors/), [Bitcoin.com](https://news.bitcoin.com/crypto-news/binance-expands-bstocks-collateral-as-tokenized-stock-volumes-jump-33x/), [Traders Union](https://tradersunion.com/news/brokers-news/show/2941539-binance-launches-automated-bstock-purchases/), [DEXTools](https://www.dextools.io/news/xstocks-on-bnb-chain-the-reality-of-245-trading), [IBKR stablecoin deposits](https://www.interactivebrokers.com/support/faq/content/deposit-via-stablecoin-1331500535), [CRE8 How it works](https://cre8.finance/how-it-works).

This article is not investment advice.
