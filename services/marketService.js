const YahooFinance = require("yahoo-finance2").default;

const yahooFinance = new YahooFinance({
  suppressNotices: ["yahooSurvey"],
});

/*
|--------------------------------------------------------------------------
| GET STOCK QUOTE
|--------------------------------------------------------------------------
|
| We use Yahoo Finance's chart module instead of quote().
|
| The quote() endpoint depends on Yahoo's crumb/cookie flow,
| which is currently returning HTTP 429 on the Render server.
|
| chart() provides the latest available market price without
| depending on that quote crumb flow.
|
|--------------------------------------------------------------------------
*/

const getStockQuote = async (symbol) => {
  try {
    const result = await yahooFinance.chart(symbol, {
      period1: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      period2: new Date(),
      interval: "1d",
      events: "div,splits",
    });

    const meta = result?.meta;

    if (!meta) {
      throw new Error("Yahoo Finance returned no metadata");
    }

    const price = Number(
      meta.regularMarketPrice ??
        meta.chartPreviousClose ??
        meta.previousClose,
    );

    const previousClose = Number(
      meta.previousClose ??
        meta.chartPreviousClose,
    );

    if (!Number.isFinite(price)) {
      throw new Error(
        `Invalid market price returned for ${symbol}`,
      );
    }

    let change = 0;
    let changePercent = 0;

    if (
      Number.isFinite(previousClose) &&
      previousClose !== 0
    ) {
      change = price - previousClose;

      changePercent =
        (change / previousClose) * 100;
    }

    return {
      success: true,

      data: {
        symbol: meta.symbol || symbol,
        name:
          meta.longName ||
          meta.shortName ||
          symbol,
        exchange:
          meta.fullExchangeName ||
          meta.exchangeName,
        currency: meta.currency,

        price,

        change,

        changePercent,

        previousClose,

        open: meta.regularMarketPrice,

        dayHigh: meta.regularMarketDayHigh,

        dayLow: meta.regularMarketDayLow,

        volume: meta.regularMarketVolume,

        marketState: meta.marketState,

        marketTime: meta.regularMarketTime,

        delayedBy: meta.exchangeDataDelayedBy,
      },
    };
  } catch (error) {
    console.error(
      `MARKET DATA ERROR for ${symbol}:`,
      error.message,
    );

    return {
      success: false,
      message: "Unable to fetch market data",
    };
  }
};

/*
|--------------------------------------------------------------------------
| GET MULTIPLE STOCK QUOTES
|--------------------------------------------------------------------------
|
| We deliberately process the symbols sequentially instead of
| firing 17 Yahoo requests simultaneously.
|
| This reduces pressure on Yahoo and makes the backend more
| reliable on Render.
|
|--------------------------------------------------------------------------
*/

const getMultipleStockQuotes = async (symbols) => {
  const results = [];

  for (const symbol of symbols) {
    const result = await getStockQuote(symbol);

    results.push(result);

    /*
     * Small delay between requests.
     *
     * This prevents the backend from immediately hammering
     * Yahoo with many requests at the same time.
     */
    await new Promise((resolve) =>
      setTimeout(resolve, 250),
    );
  }

  return results;
};

/*
|--------------------------------------------------------------------------
| GET HISTORICAL STOCK DATA
|--------------------------------------------------------------------------
*/

const getStockHistory = async (symbol) => {
  try {
    const result = await yahooFinance.chart(symbol, {
      period1: new Date(
        Date.now() - 7 * 24 * 60 * 60 * 1000,
      ),

      period2: new Date(),

      interval: "1d",

      events: "div,splits",
    });

    const timestamps =
      result?.timestamp || [];

    const quotes =
      result?.indicators?.quote?.[0] || {};

    const history = timestamps.map(
      (timestamp, index) => ({
        date: new Date(timestamp * 1000),

        open: quotes.open?.[index] ?? null,

        high: quotes.high?.[index] ?? null,

        low: quotes.low?.[index] ?? null,

        close: quotes.close?.[index] ?? null,

        volume: quotes.volume?.[index] ?? null,
      }),
    );

    const validHistory = history.filter(
      (item) =>
        Number.isFinite(Number(item.close)),
    );

    return {
      success: true,

      data: validHistory,
    };
  } catch (error) {
    console.error(
      `HISTORICAL MARKET DATA ERROR for ${symbol}:`,
      error.message,
    );

    return {
      success: false,

      message:
        "Unable to fetch historical market data",
    };
  }
};

module.exports = {
  getStockQuote,
  getMultipleStockQuotes,
  getStockHistory,
};