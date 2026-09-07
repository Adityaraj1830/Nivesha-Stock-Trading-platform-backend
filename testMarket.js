const {
  getMultipleStockQuotes,
} = require("./services/marketService");

async function testMarketData() {
  const symbols = [
    "INFY.NS",
    "ONGC.NS",
    "TCS.NS",
    "KPITTECH.NS",
    "QUICKHEAL.NS",
    "WIPRO.NS",
    "M&M.NS",
    "RELIANCE.NS",
    "HINDUNILVR.NS",
    "SBIN.NS",
    "ITC.NS",
    "BHARTIARTL.NS",
    "TATAPOWER.NS",
    "HDFCBANK.NS",
    "EVEREADY.NS",
    "JUBLFOOD.NS",
  ];

  const results = await getMultipleStockQuotes(symbols);

  results.forEach((result, index) => {
    console.log(
      symbols[index],
      "→",
      result.success ? "SUCCESS" : "FAILED",
    );
  });
}

testMarketData();