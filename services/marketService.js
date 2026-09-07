const YahooFinance = require("yahoo-finance2").default;

const yahooFinance = new YahooFinance({
  suppressNotices: ["yahooSurvey"],
});

const getStockQuote = async (symbol) => {
  try {
    const quote = await yahooFinance.quote(symbol);

    return {
      success: true,
      data: {
        symbol: quote.symbol,
        name: quote.longName || quote.shortName,

        exchange: quote.fullExchangeName,
        currency: quote.currency,

        price: quote.regularMarketPrice,

        change: quote.regularMarketChange,
        changePercent: quote.regularMarketChangePercent,

        previousClose: quote.regularMarketPreviousClose,
        open: quote.regularMarketOpen,

        dayHigh: quote.regularMarketDayHigh,
        dayLow: quote.regularMarketDayLow,

        volume: quote.regularMarketVolume,

        marketState: quote.marketState,
        marketTime: quote.regularMarketTime,

        delayedBy: quote.exchangeDataDelayedBy,
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


// Fetch multiple stock quotes
const getMultipleStockQuotes = async (symbols) => {
  try {
    const results = await Promise.all(
      symbols.map(async (symbol) => {
        const result = await getStockQuote(symbol);

        return result;
      }),
    );

    return results;
  } catch (error) {
    console.error(
      "MULTIPLE MARKET DATA ERROR:",
      error.message,
    );

    return [];
  }
};


module.exports = {
  getStockQuote,
  getMultipleStockQuotes,
};