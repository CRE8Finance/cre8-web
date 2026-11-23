---
title: How to Copy the Pelosi Portfolio With Crypto (and How Late the Data Is)
slug: /blog/copy-pelosi-portfolio-with-crypto
lang: en
author: CRE8
published: 2026-11-23
updated: 2026-11-23
status: Draft (post 7)
---

# How to Copy the Pelosi Portfolio With Crypto (and How Late the Data Is)

By CRE8 · November 23, 2026 · About 8 minutes

The Pelosi household reports its stock trades to the US House of Representatives, usually 30 to 45 days after each trade, and anyone can download those reports from the House Clerk's website. With crypto, you can either read the filings yourself and buy the matching stock tokens one by one with USDT, or buy CRE8's Pelosi Portfolio, which splits one USDT payment across the stocks at set weights. Either way, you are following trades from more than a month ago, not what the household holds today.

## Where does the Pelosi trading data come from?

The data comes from Periodic Transaction Reports (PTRs). A PTR is the form members of Congress use to report securities trades. Under the STOCK Act of 2012, members must report trades over $1,000 made by themselves, their spouses and their dependent children ([5 U.S.C. §13105](https://www.law.cornell.edu/uscode/text/5/13105), [House Committee on Ethics](https://ethics.house.gov/periodic-transaction-report-calculator)). Because spouse trades are included, CRE8's portfolio page describes them as trades by "Nancy Pelosi's household."

The reports are public. Go to the [House Clerk's financial disclosure search](https://disclosures-clerk.house.gov/FinancialDisclosure/ViewSearch), enter the last name Pelosi, pick a year, and you can download each filing as a PDF. The search page notes that the data can't be used for commercial purposes (news media excepted) or to set anyone's credit rating.

## How late are the filings?

At most 45 days. A member has to file within 30 days of learning about a trade, and never later than 45 days after the trade itself ([House Committee on Ethics](https://ethics.house.gov/periodic-transaction-report-calculator)). CRE8's portfolio page puts it as "usually 30 to 45 days after the trade."

For anyone copying the trades, that delay matters. By the time a filing shows up, the stock may have already made its move. You are buying a decision from a month or more ago.

## What do the filings show, and what do they leave out?

A PTR lists the ticker, whether it was a buy or a sale, the date, and a dollar range. It doesn't give the exact amount, so outsiders can't work out how big each position is relative to the others.

The other detail people miss is options. Many of the household's trades are call options. A call option is a contract that pays off if the stock rises above a set price before expiry, and it can expire worthless if the stock doesn't get there. Calls swing much harder than the shares themselves, so buying the shares will not reproduce the household's actual gains or losses.

## What does copying the filings yourself involve?

Doing it yourself takes about five steps:

1. Check the House Clerk search for new PTRs.
2. Read each PDF, pick out the buys, and decide what to do about option trades.
3. Decide how much money goes into each stock, since the filings only give ranges.
4. Buy the stocks one at a time with USDT. On Binance you can buy bStock directly. bStock is a tokenized US stock on BNB Chain, issued by a Binance affiliate, whose price tracks the underlying share. You can also withdraw to your own wallet and swap on PancakeSwap ([Binance Learn](https://www.binance.com/en/learn/bstocks)).
5. Rebalance by hand as prices move and your weights drift.

The upside is full control over which trades you follow, how much you put in, and when you rebalance. The downside is redoing the work every time a new filing lands.

## Can you copy Congress through a brokerage instead?

Yes, if you can open a US brokerage account. Some ETFs pick stocks from congressional disclosures. NANC, for example, buys what Democratic members of Congress and their families report buying ([Yahoo Finance, April 2, 2026](https://finance.yahoo.com/markets/stocks/articles/congress-may-finally-ban-own-165349514.html)). It follows a group of lawmakers, not Pelosi alone.

Funding is the catch for crypto holders. Most brokers want fiat. Interactive Brokers accepts stablecoin deposits, but only USDC, PYUSD and RLUSD, not USDT ([IBKR FAQ](https://www.interactivebrokers.com/support/faq/content/deposit-via-stablecoin-1331500535)). And since May 22, 2026, investors in mainland China can only sell and withdraw at offshore brokers, not buy or deposit ([CSRC](https://www.csrc.gov.cn/csrc/c100028/c7634326/content.shtml)).

## How do you buy the Pelosi Portfolio on CRE8?

CRE8's [Pelosi Portfolio](https://cre8.finance/portfolios/pelosi) turns the filings into fixed target weights. You pick the portfolio, enter an amount, and one USDT payment buys every stock at its weight.

The portfolio page explains the method. It is built from the household's PTRs. Where the trades are call options, the portfolio holds the underlying shares instead. Because the filings only give ranges, CRE8 sets the weights. As of November 23, 2026, that's NVIDIA, Alphabet, Microsoft, Amazon and Intel at 19% each, plus 5% in Broadcom.

Here is what 500 USDT looks like:

| Stock | Weight | Out of 500 USDT |
|---|---|---|
| NVIDIA (NVDA) | 19% | 95 USDT |
| Alphabet (GOOGL) | 19% | 95 USDT |
| Microsoft (MSFT) | 19% | 95 USDT |
| Amazon (AMZN) | 19% | 95 USDT |
| Intel (INTC) | 19% | 95 USDT |
| Broadcom (AVGO) | 5% | 25 USDT |

On an exchange, that's six orders and your own math. On CRE8, it's one confirmation. The bStock lands in your own smart account, an account on BNB Chain that belongs to you, where moving anything out takes your signature.

After that, the portfolio rebalances once a month, and also whenever a stock drifts more than 5 percentage points from its target. If NVIDIA grows to 26% of the portfolio, for example, the system trims it and tops up the others.

A few limits to know up front. The minimum is 50 USDT per purchase. Stock tokens only trade during US market hours, so an order placed while the market is closed waits for the next open. Trades go only through allowlisted venues (PancakeSwap, KyberSwap and OpenOcean), and large orders are split into several trades.

CRE8 is on BNB Chain testnet only. Test USDT is free, no real money is involved, and there's no mainnet date yet.

## What is the Pelosi Portfolio's model APY?

The portfolio page shows a model APY (backtest) of +24.8% as of November 22, 2026. CRE8 calculates it by running today's weights through historical closing prices from November 22, 2024 to November 22, 2026. It is not a track record, and it is not Pelosi's own return.

The same page shows a model return of −21.2% over the last 30 days and −21.8% over the last 90. Six tech stocks can fall fast together.

## Which other people portfolios are built from filings?

CRE8 has two more portfolios built from public filings, each with a different source and delay.

[Trump Holdings](https://cre8.finance/portfolios/trump) is built from the financial disclosures Donald Trump files with the US Office of Government Ethics. Those filings list value ranges without share counts and arrive weeks to months after the trades. The portfolio holds the eight large US stocks in the filings at about 12.5% each: NVIDIA, Apple, Microsoft, Amazon, Meta, Tesla, Alphabet and Netflix. Companies he owns or runs, such as Trump Media, are left out. Model APY (backtest): +9.0% as of November 22, 2026.

[Duan Yongping](https://cre8.finance/portfolios/duan) is built from the quarterly 13F filings of H&H International Investment, the firm that reports Duan's US holdings. A 13F is the holdings report that managers with $100 million or more in US equities file each quarter, due within 45 days after the quarter ends ([SEC 13F FAQ](https://www.sec.gov/divisions/investment/13ffaq)). The portfolio holds Apple, PDD Holdings, NVIDIA and Tesla at 25% each. Berkshire Hathaway, a large holding in the filing, is left out because no on-chain market is deep enough to buy it. Model APY (backtest): +6.4% as of November 22, 2026.

All three reflect what has been disclosed, not what anyone holds today.

## How do the three approaches compare?

| | Copy the filings yourself | Congress-tracking ETF at a broker | CRE8 Pelosi Portfolio (testnet) |
|---|---|---|---|
| Data delay | 30 to 45 days | 30 to 45 days; rebalancing per fund rules | 30 to 45 days |
| Whose trades | Any member you choose | A group of members | The Pelosi household |
| Option trades | Your call | Per fund rules | Holds the underlying shares |
| Who sets weights | You | The fund | CRE8, published on the page |
| Pay with USDT | Yes (exchange or on-chain) | Usually no; fiat first | Yes |
| One purchase for all | No, one order per stock | Yes, one ETF | Yes, one payment at target weights |
| Automatic rebalancing | No | The fund does it | Monthly, plus 5-point drift |
| Where assets sit | Exchange account or your wallet | Brokerage account | Your own smart account |
| Minimum | bStock from $5 on Binance | One ETF share | 50 USDT per purchase |
| Status | Live | Live (needs an account) | BNB Chain testnet, no real money |

Data checked November 23, 2026.

## When is another option the better fit?

If you only want one or two of the names, say just NVIDIA, buying that bStock on Binance is quicker than buying a whole portfolio.

If you want to judge each filing yourself, follow only new buys, or copy the options too, read the PTRs and place your own trades. CRE8's portfolio uses a fixed method, and you can't change its weights.

If you already have a US brokerage account funded in dollars and want exposure spread across many lawmakers' picks, a congress-tracking ETF fits better.

## What are the risks of copying congressional trades?

The delay is the biggest one. You are buying trades from 30 to 45 days ago, and prices can move a long way in that time.

Shares are not options. Many filed trades are call options, while the portfolio holds shares, so results will differ from the household's.

Concentration. The Pelosi Portfolio holds six stocks, all in tech, and its 30-day model return is −21.2%.

The data source may change. Pelosi has said she won't run again, and her term ends January 3, 2027 ([Al Jazeera](https://www.aljazeera.com/news/2025/11/6/nancy-pelosi-first-female-us-house-speaker-to-retire-from-congress)). Yahoo Finance reported in April 2026 that the House Administration Committee had advanced a bill to bar members and their spouses from buying stocks, and that the Senate had not yet taken it up ([Yahoo Finance](https://finance.yahoo.com/markets/stocks/articles/congress-may-finally-ban-own-165349514.html)). Copying depends on new filings, and either change could slow or stop them.

bStock is not a share. It is issued by BTech Holdings, a Binance affiliate, and each token is backed 1:1 by shares held with a custodian, with a daily proof of collateral. Binance states that bStocks are not shares, and dividends arrive as extra tokens after a 30% US withholding tax ([Binance Learn](https://www.binance.com/en/learn/bstocks)).

CRE8 runs on smart contracts, which can have bugs. The contracts get an external audit before mainnet.

## FAQ

**Will copying Pelosi make money?**
There's no basis for assuming that. The filings arrive 30 to 45 days late, the option trades aren't copied, and past returns don't predict future ones. The Pelosi Portfolio's 30-day model return is −21.2%.

**Where can I read the PTRs?**
On the [House Clerk's financial disclosure search](https://disclosures-clerk.house.gov/FinancialDisclosure/ViewSearch). Enter a last name and year to download the PDFs.

**How often does CRE8's Pelosi Portfolio rebalance?**
Monthly, plus whenever a stock drifts more than 5 percentage points from its target. The page shows the current holdings and weights.

**Can US residents use it?**
No. CRE8 is for users outside the US where local rules allow, and bStock isn't offered to US persons.

**Is CRE8 affiliated with Nancy Pelosi?**
No. The portfolio is built from public filings and doesn't represent Pelosi or her family.

## Next step

See the full weights, backtest method and model returns by period on the [Pelosi Portfolio page](https://cre8.finance/portfolios/pelosi).

---

Further reading: [Ways to buy US stocks with USDT](/blog/buy-us-stocks-with-usdt), [What is bStock?](/blog/what-is-bstock)

Sources (checked November 23, 2026): [CRE8 Pelosi Portfolio](https://cre8.finance/portfolios/pelosi), [CRE8 Trump Holdings](https://cre8.finance/portfolios/trump), [CRE8 Duan Yongping](https://cre8.finance/portfolios/duan), [House Clerk financial disclosure search](https://disclosures-clerk.house.gov/FinancialDisclosure/ViewSearch), [House Committee on Ethics PTR deadlines](https://ethics.house.gov/periodic-transaction-report-calculator), [5 U.S.C. §13105](https://www.law.cornell.edu/uscode/text/5/13105), [SEC Form 13F FAQ](https://www.sec.gov/divisions/investment/13ffaq), [Yahoo Finance](https://finance.yahoo.com/markets/stocks/articles/congress-may-finally-ban-own-165349514.html), [Al Jazeera](https://www.aljazeera.com/news/2025/11/6/nancy-pelosi-first-female-us-house-speaker-to-retire-from-congress), [Binance Learn: bStocks](https://www.binance.com/en/learn/bstocks), [IBKR stablecoin deposits](https://www.interactivebrokers.com/support/faq/content/deposit-via-stablecoin-1331500535), [China Securities Regulatory Commission](https://www.csrc.gov.cn/csrc/c100028/c7634326/content.shtml).

This article is not investment advice.
