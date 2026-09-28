require("dotenv").config();

const { sendSupportEmail } = require("./utils/email");
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const isProduction = process.env.NODE_ENV === "production";

const { HoldingsModel } = require("./model/HoldingsModel");
const { PositionsModel } = require("./model/PositionsModel");
const { OrdersModel } = require("./model/OrdersModel");
const { UserModel } = require("./model/UserModel");
const { FundsModel } = require("./model/FundsModel");
const { FundTransactionModel } = require("./model/FundTransactionModel");
const { SupportModel } = require("./model/SupportModel");

const {
  getStockQuote,
  getMultipleStockQuotes,
  getStockHistory,
} = require("./services/marketService");

const PORT = process.env.PORT || 3002;
const uri = process.env.MONGO_URL;

const app = express();

const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.DASHBOARD_URL,
  process.env.PROD_FRONTEND_URL,
  process.env.PROD_DASHBOARD_URL,
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`CORS not allowed for origin: ${origin}`));
    },
    credentials: true,
  }),
);

app.use(express.json());
app.use(cookieParser());

const authenticateUser = async (req, res, next) => {
  try {
    const token = req.cookies.nivesha_session;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await UserModel.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User account not found",
      });
    }

    req.user = user;

    next();
  } catch (error) {
    console.error("AUTHENTICATION ERROR:", error.message);

    return res.status(401).json({
      success: false,
      message: "Invalid or expired session",
    });
  }
};

const createSession = (res, user) => {
  const sessionToken = jwt.sign(
    {
      userId: user._id.toString(),
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d",
    },
  );

  res.cookie("nivesha_session", sessionToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  });
};

const getPublicUser = (user) => ({
  id: user._id,
  name: user.name,
  username: user.username,
  email: user.email,
  accountType: user.accountType,
  tradingStatus: user.tradingStatus,
});

/*
|--------------------------------------------------------------------------
| LIVE MARKET DATA CONFIGURATION
|--------------------------------------------------------------------------
*/

const marketData = [
  "INFY",
  "ONGC",
  "TCS",
  "KPITTECH",
  "QUICKHEAL",
  "WIPRO",
  "M&M",
  "RELIANCE",
  "HUL",
  "HINDUNILVR",
  "SBIN",
  "ITC",
  "BHARTIARTL",
  "TATAPOWER",
  "HDFCBANK",
  "EVEREADY",
  "JUBLFOOD",
];

const yahooSymbolMap = {
  INFY: "INFY.NS",
  ONGC: "ONGC.NS",
  TCS: "TCS.NS",
  KPITTECH: "KPITTECH.NS",
  QUICKHEAL: "QUICKHEAL.NS",
  WIPRO: "WIPRO.NS",
  "M&M": "M&M.NS",
  RELIANCE: "RELIANCE.NS",
  HUL: "HINDUNILVR.NS",
  HINDUNILVR: "HINDUNILVR.NS",
  SBIN: "SBIN.NS",
  ITC: "ITC.NS",
  BHARTIARTL: "BHARTIARTL.NS",
  TATAPOWER: "TATAPOWER.NS",
  HDFCBANK: "HDFCBANK.NS",
  EVEREADY: "EVEREADY.NS",
  JUBLFOOD: "JUBLFOOD.NS",
};

/*
 * Stores the most recent successfully fetched LIVE market value.
 *
 * Important:
 * We do NOT fall back to the old hard-coded prices anymore.
 *
 * If Yahoo Finance temporarily fails, we use the last successful
 * LIVE value instead.
 */
const lastSuccessfulMarketData = new Map();

let cachedMarketData = null;
let marketDataCacheTime = 0;

const MARKET_CACHE_DURATION = 60 * 1000;

/*
|--------------------------------------------------------------------------
| GET LATEST MARKET STOCK
|--------------------------------------------------------------------------
*/

const getLatestMarketStock = async (name) => {
  const yahooSymbol = yahooSymbolMap[name];

  if (!yahooSymbol) {
    return null;
  }

  try {
    const result = await getStockQuote(yahooSymbol);

    if (
      result.success &&
      result.data &&
      Number.isFinite(Number(result.data.price))
    ) {
      const changePercent = Number(result.data.changePercent) || 0;

      const stock = {
        name,
        price: Number(Number(result.data.price).toFixed(2)),
        percent: `${changePercent >= 0 ? "+" : ""}${changePercent.toFixed(
          2,
        )}%`,
        isDown: changePercent < 0,
      };

      lastSuccessfulMarketData.set(name, stock);

      return stock;
    }
  } catch (error) {
    console.error(
      `LATEST MARKET PRICE ERROR for ${name}:`,
      error.message,
    );
  }

  /*
   * Yahoo temporarily failed.
   *
   * Return the last successful LIVE value instead of the old
   * hard-coded/demo price.
   */
  return lastSuccessfulMarketData.get(name) || null;
};

app.get("/", (req, res) => {
  res.send("Backend is running 🚀");
});

/*
|--------------------------------------------------------------------------
| AUTH - SIGNUP
|--------------------------------------------------------------------------
*/

app.post("/auth/signup", async (req, res) => {
  try {
    let { name, username, email, password } = req.body;

    name = name?.trim();
    username = username?.trim().toLowerCase();
    email = email?.trim().toLowerCase();

    if (!name || name.length < 2) {
      return res.status(400).json({
        success: false,
        message: "Please enter your full name",
      });
    }

    if (!username || username.length < 3) {
      return res.status(400).json({
        success: false,
        message: "User ID must contain at least 3 characters",
      });
    }

    const usernamePattern = /^[a-z0-9_]+$/;

    if (!usernamePattern.test(username)) {
      return res.status(400).json({
        success: false,
        message:
          "User ID can only contain letters, numbers and underscores",
      });
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email || !emailPattern.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address",
      });
    }

    if (!password || password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must contain at least 8 characters",
      });
    }

    const existingUser = await UserModel.findOne({
      $or: [{ email }, { username }],
    });

    if (existingUser) {
      if (existingUser.email === email) {
        return res.status(409).json({
          success: false,
          message: "An account with this email already exists",
        });
      }

      return res.status(409).json({
        success: false,
        message: "This User ID is already taken",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await UserModel.create({
      name,
      username,
      email,
      password: hashedPassword,
      accountType: "Individual",
      tradingStatus: "Active",
    });

    await FundsModel.create({
      userId: user._id,
      availableBalance: 100000,
      totalDeposited: 100000,
      totalWithdrawn: 0,
    });

    createSession(res, user);

    return res.status(201).json({
      success: true,
      message: "Nivesha account created successfully",
      user: getPublicUser(user),
    });
  } catch (error) {
    console.error("SIGNUP ERROR:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Email or User ID already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Unable to create your account",
    });
  }
});

/*
|--------------------------------------------------------------------------
| AUTH - LOGIN
|--------------------------------------------------------------------------
*/

app.post("/auth/login", async (req, res) => {
  try {
    const email = req.body.email?.trim().toLowerCase();
    const password = req.body.password;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const user = await UserModel.findOne({ email });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const isPasswordCorrect = await bcrypt.compare(
      password,
      user.password,
    );

    if (!isPasswordCorrect) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    let funds = await FundsModel.findOne({
      userId: user._id,
    });

    if (!funds) {
      funds = await FundsModel.create({
        userId: user._id,
        availableBalance: 100000,
        totalDeposited: 100000,
        totalWithdrawn: 0,
      });
    }

    createSession(res, user);

    return res.status(200).json({
      success: true,
      message: "Logged in successfully",
      user: getPublicUser(user),
    });
  } catch (error) {
    console.error("LOGIN ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to login",
    });
  }
});

/*
|--------------------------------------------------------------------------
| AUTH - CURRENT USER
|--------------------------------------------------------------------------
*/

app.get("/auth/me", authenticateUser, async (req, res) => {
  return res.status(200).json({
    success: true,
    user: getPublicUser(req.user),
  });
});

/*
|--------------------------------------------------------------------------
| AUTH - LOGOUT
|--------------------------------------------------------------------------
*/

app.post("/auth/logout", (req, res) => {
  res.clearCookie("nivesha_session", {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    path: "/",
  });

  return res.status(200).json({
    success: true,
    message: "Logged out successfully",
  });
});

/*
|--------------------------------------------------------------------------
| LIVE MARKET DATA
|--------------------------------------------------------------------------
*/

app.get("/market-data", async (req, res) => {
  try {
    const now = Date.now();

    /*
     * Return cached LIVE data for 60 seconds.
     */
    if (
      cachedMarketData &&
      now - marketDataCacheTime < MARKET_CACHE_DURATION
    ) {
      return res.json(cachedMarketData);
    }

    const yahooSymbols = marketData
      .map((name) => yahooSymbolMap[name])
      .filter(Boolean);

    const yahooResults =
      await getMultipleStockQuotes(yahooSymbols);

    const yahooDataMap = {};

    yahooResults.forEach((result, index) => {
      if (
        result.success &&
        result.data &&
        Number.isFinite(Number(result.data.price))
      ) {
        yahooDataMap[yahooSymbols[index]] = result.data;
      }
    });

    /*
     * Build the response only from:
     *
     * 1. Fresh Yahoo Finance data
     * OR
     * 2. Previously successful LIVE data
     *
     * Never use the old hard-coded prices.
     */
    const updatedMarketData = marketData
      .map((name) => {
        const yahooSymbol = yahooSymbolMap[name];
        const yahooStock = yahooDataMap[yahooSymbol];

        if (yahooStock) {
          const changePercent =
            Number(yahooStock.changePercent) || 0;

          const stock = {
            name,
            price: Number(
              Number(yahooStock.price).toFixed(2),
            ),
            percent: `${
              changePercent >= 0 ? "+" : ""
            }${changePercent.toFixed(2)}%`,
            isDown: changePercent < 0,
          };

          /*
           * Save this successful LIVE value.
           */
          lastSuccessfulMarketData.set(name, stock);

          return stock;
        }

        /*
         * Yahoo failed for this particular stock.
         *
         * Use the previous successful LIVE value.
         * Do NOT use the old static price.
         */
        return (
          lastSuccessfulMarketData.get(name) || null
        );
      })
      .filter(Boolean);

    /*
     * If we have no market data at all, don't pretend that
     * hard-coded prices are live.
     */
    if (updatedMarketData.length === 0) {
      if (cachedMarketData) {
        return res.json(cachedMarketData);
      }

      return res.status(503).json({
        success: false,
        message:
          "Live market data is temporarily unavailable",
      });
    }

    /*
     * Save the latest successful/last-known-live response
     * for the next 60 seconds.
     */
    cachedMarketData = updatedMarketData;
    marketDataCacheTime = now;

    return res.json(updatedMarketData);
  } catch (error) {
    console.error(
      "MARKET DATA ROUTE ERROR:",
      error.message,
    );

    /*
     * If the entire request fails, return the last successful
     * LIVE response if one exists.
     *
     * Never return old fake/static prices.
     */
    if (cachedMarketData) {
      return res.json(cachedMarketData);
    }

    return res.status(503).json({
      success: false,
      message:
        "Live market data is temporarily unavailable",
    });
  }
});

/*
|--------------------------------------------------------------------------
| FUNDS
|--------------------------------------------------------------------------
*/

app.get("/funds", authenticateUser, async (req, res) => {
  try {
    let funds = await FundsModel.findOne({
      userId: req.user._id,
    });

    if (!funds) {
      funds = new FundsModel({
        userId: req.user._id,
        availableBalance: 100000,
        totalDeposited: 100000,
        totalWithdrawn: 0,
      });

      await funds.save();
    }

    return res.json(funds);
  } catch (error) {
    console.error("FUNDS FETCH ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch funds",
    });
  }
});

app.post("/addFunds", authenticateUser, async (req, res) => {
  try {
    const amount = Number(req.body.amount);

    const userId = req.user._id;

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid deposit amount",
      });
    }

    let funds = await FundsModel.findOne({
      userId,
    });

    if (!funds) {
      funds = new FundsModel({
        userId,
        availableBalance: 100000,
        totalDeposited: 100000,
        totalWithdrawn: 0,
      });
    }

    funds.availableBalance =
      Number(funds.availableBalance) + amount;

    funds.totalDeposited =
      Number(funds.totalDeposited) + amount;

    await funds.save();

    await FundTransactionModel.create({
      userId,
      type: "DEPOSIT",
      amount,
      description: "Funds added to trading account",
      balanceAfter: funds.availableBalance,
    });

    return res.json({
      success: true,
      message: "Funds added successfully",
      funds,
    });
  } catch (error) {
    console.error("ADD FUNDS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to add funds",
    });
  }
});

app.post(
  "/withdrawFunds",
  authenticateUser,
  async (req, res) => {
    try {
      const amount = Number(req.body.amount);

      const userId = req.user._id;

      if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({
          success: false,
          message: "Enter a valid withdrawal amount",
        });
      }

      const funds = await FundsModel.findOne({
        userId,
      });

      if (!funds) {
        return res.status(404).json({
          success: false,
          message: "Funds account not found",
        });
      }

      if (amount > Number(funds.availableBalance)) {
        return res.status(400).json({
          success: false,
          message: "Insufficient available balance",
        });
      }

      funds.availableBalance =
        Number(funds.availableBalance) - amount;

      funds.totalWithdrawn =
        Number(funds.totalWithdrawn) + amount;

      await funds.save();

      await FundTransactionModel.create({
        userId,
        type: "WITHDRAWAL",
        amount,
        description:
          "Funds withdrawn from trading account",
        balanceAfter: funds.availableBalance,
      });

      return res.json({
        success: true,
        message: "Funds withdrawn successfully",
        funds,
      });
    } catch (error) {
      console.error(
        "WITHDRAW FUNDS ERROR:",
        error,
      );

      return res.status(500).json({
        success: false,
        message: "Unable to withdraw funds",
      });
    }
  },
);

app.get(
  "/fund-transactions",
  authenticateUser,
  async (req, res) => {
    try {
      const transactions =
        await FundTransactionModel.find({
          userId: req.user._id,
        }).sort({
          createdAt: -1,
        });

      return res.json(transactions);
    } catch (error) {
      console.error(
        "FUND TRANSACTION FETCH ERROR:",
        error,
      );

      return res.status(500).json({
        success: false,
        message: "Unable to fetch fund transactions",
      });
    }
  },
);

/*
|--------------------------------------------------------------------------
| HOLDINGS
|--------------------------------------------------------------------------
*/

app.get(
  "/allHoldings",
  authenticateUser,
  async (req, res) => {
    try {
      const allHoldings =
        await HoldingsModel.find({
          userId: req.user._id,
        });

      return res.json(allHoldings);
    } catch (error) {
      console.error(
        "HOLDINGS FETCH ERROR:",
        error,
      );

      return res.status(500).json({
        message: "Unable to fetch holdings",
      });
    }
  },
);

/*
|--------------------------------------------------------------------------
| POSITIONS
|--------------------------------------------------------------------------
*/

app.get(
  "/allPositions",
  authenticateUser,
  async (req, res) => {
    try {
      const allPositions =
        await PositionsModel.find({
          userId: req.user._id,
        });

      return res.json(allPositions);
    } catch (error) {
      console.error(
        "POSITIONS FETCH ERROR:",
        error,
      );

      return res.status(500).json({
        message: "Unable to fetch positions",
      });
    }
  },
);

/*
|--------------------------------------------------------------------------
| ORDERS
|--------------------------------------------------------------------------
*/

app.get(
  "/allOrders",
  authenticateUser,
  async (req, res) => {
    try {
      const orders =
        await OrdersModel.find({
          userId: req.user._id,
        }).sort({
          createdAt: -1,
        });

      return res.json(orders);
    } catch (error) {
      console.error(
        "ORDERS FETCH ERROR:",
        error,
      );

      return res.status(500).json({
        message: "Unable to fetch orders",
      });
    }
  },
);

/*
|--------------------------------------------------------------------------
| CREATE BUY / SELL ORDER
|--------------------------------------------------------------------------
*/

app.post(
  "/newOrder",
  authenticateUser,
  async (req, res) => {
    try {
      let {
        name,
        qty,
        mode,
        product = "CNC",
      } = req.body;

      name = name?.trim().toUpperCase();
      qty = Number(qty);
      mode = mode?.trim().toUpperCase();
      product = product?.trim().toUpperCase();

      if (!name) {
        return res.status(400).json({
          success: false,
          message: "Stock name is required",
        });
      }

      if (!Number.isInteger(qty) || qty <= 0) {
        return res.status(400).json({
          success: false,
          message:
            "Quantity must be a positive whole number",
        });
      }

      if (!["BUY", "SELL"].includes(mode)) {
        return res.status(400).json({
          success: false,
          message: "Invalid order type",
        });
      }

      if (!["CNC", "MIS"].includes(product)) {
        return res.status(400).json({
          success: false,
          message: "Invalid product type",
        });
      }

      /*
       * IMPORTANT:
       *
       * Previously the order used:
       *
       * marketData.find(...)
       *
       * which could return the old hard-coded price.
       *
       * Now we fetch the latest available LIVE price.
       */
      const marketStock =
        await getLatestMarketStock(name);

      if (!marketStock) {
        return res.status(503).json({
          success: false,
          message:
            "Live market price is temporarily unavailable. Please try again.",
        });
      }

      const price = Number(marketStock.price);

      const userId = req.user._id;

      const orderValue = qty * price;

      let funds = await FundsModel.findOne({
        userId,
      });

      if (!funds) {
        funds = new FundsModel({
          userId,
          availableBalance: 100000,
          totalDeposited: 100000,
          totalWithdrawn: 0,
        });

        await funds.save();
      }

      let existingStock;

      if (product === "CNC") {
        existingStock =
          await HoldingsModel.findOne({
            userId,
            name,
          });
      } else {
        existingStock =
          await PositionsModel.findOne({
            userId,
            name,
            product: "MIS",
          });
      }

      if (mode === "BUY") {
        if (
          orderValue >
          Number(funds.availableBalance)
        ) {
          return res.status(400).json({
            success: false,
            message: "Insufficient available balance",
          });
        }
      }

      if (mode === "SELL") {
        if (!existingStock) {
          return res.status(400).json({
            success: false,
            message: `You do not own any ${product} shares of ${name}`,
          });
        }

        if (qty > Number(existingStock.qty)) {
          return res.status(400).json({
            success: false,
            message: `You only own ${existingStock.qty} shares of ${name}`,
          });
        }
      }

      let realizedPnL = 0;

      if (mode === "SELL") {
        realizedPnL =
          (price - Number(existingStock.avg)) *
          qty;
      }

      const newOrder = new OrdersModel({
        userId,
        name,
        qty,
        price,
        mode,
        product,
        status: "COMPLETED",
        realizedPnL,
        time: new Date().toLocaleTimeString(),
      });

      await newOrder.save();

      if (mode === "BUY") {
        funds.availableBalance =
          Number(funds.availableBalance) -
          orderValue;

        await funds.save();

        await FundTransactionModel.create({
          userId,
          type: "BUY",
          amount: orderValue,
          stockName: name,
          quantity: qty,
          description: `${product} BUY - ${qty} shares of ${name}`,
          balanceAfter:
            funds.availableBalance,
        });

        if (existingStock) {
          const oldQuantity =
            Number(existingStock.qty);

          const oldAverage =
            Number(existingStock.avg);

          const totalQuantity =
            oldQuantity + qty;

          const totalCost =
            oldAverage * oldQuantity +
            price * qty;

          existingStock.qty =
            totalQuantity;

          existingStock.avg =
            totalCost / totalQuantity;

          existingStock.price =
            price;

          await existingStock.save();
        } else if (product === "CNC") {
          const newHolding =
            new HoldingsModel({
              userId,
              name,
              qty,
              avg: price,
              price,
              net: "0%",
              day: "0%",
            });

          await newHolding.save();
        } else {
          const newPosition =
            new PositionsModel({
              userId,
              product: "MIS",
              name,
              qty,
              avg: price,
              price,
              net: "0%",
              day: "0%",
              isLoss: false,
            });

          await newPosition.save();
        }
      }

      if (mode === "SELL") {
        funds.availableBalance =
          Number(funds.availableBalance) +
          orderValue;

        await funds.save();

        await FundTransactionModel.create({
          userId,
          type: "SELL",
          amount: orderValue,
          stockName: name,
          quantity: qty,
          description: `${product} SELL - ${qty} shares of ${name}`,
          balanceAfter:
            funds.availableBalance,
        });

        const remainingQuantity =
          Number(existingStock.qty) - qty;

        if (remainingQuantity === 0) {
          if (product === "CNC") {
            await HoldingsModel.deleteOne({
              _id: existingStock._id,
              userId,
            });
          } else {
            await PositionsModel.deleteOne({
              _id: existingStock._id,
              userId,
            });
          }
        } else {
          existingStock.qty =
            remainingQuantity;

          await existingStock.save();
        }
      }

      return res.status(201).json({
        success: true,
        message: `${product} ${mode} order executed successfully`,
        order: newOrder,
        funds,
      });
    } catch (error) {
      console.error(
        "ORDER ERROR:",
        error,
      );

      return res.status(500).json({
        success: false,
        message: "Unable to process order",
      });
    }
  },
);

/*
|--------------------------------------------------------------------------
| CANCEL ORDER
|--------------------------------------------------------------------------
*/

app.post(
  "/cancelOrder",
  authenticateUser,
  async (req, res) => {
    try {
      const { id } = req.body;

      const order =
        await OrdersModel.findOne({
          _id: id,
          userId: req.user._id,
        });

      if (!order) {
        return res.status(404).json({
          success: false,
          message: "Order not found",
        });
      }

      if (order.status === "COMPLETED") {
        return res.status(400).json({
          success: false,
          message:
            "Completed orders cannot be cancelled",
        });
      }

      order.status = "CANCELLED";

      await order.save();

      return res.json({
        success: true,
        message: "Order cancelled successfully",
      });
    } catch (error) {
      console.error(
        "CANCEL ORDER ERROR:",
        error,
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to cancel order",
      });
    }
  },
);

/*
|--------------------------------------------------------------------------
| SUPPORT
|--------------------------------------------------------------------------
*/

app.post(
  "/support",
  authenticateUser,
  async (req, res) => {
    try {
      let { subject, message } = req.body;

      subject = subject?.trim();
      message = message?.trim();

      if (!subject) {
        return res.status(400).json({
          success: false,
          message: "Subject is required",
        });
      }

      if (!message) {
        return res.status(400).json({
          success: false,
          message: "Message is required",
        });
      }

      const ticketId =
        "NV-" +
        Date.now().toString().slice(-6) +
        Math.floor(Math.random() * 100);

      const supportTicket =
        await SupportModel.create({
          userId: req.user._id,
          name: req.user.name,
          email: req.user.email,
          subject,
          message,
          ticketId,
          status: "Pending",
        });

      try {
        await sendSupportEmail(
          supportTicket,
        );
      } catch (err) {
        console.error(
          "Email sending failed:",
          err,
        );
      }

      return res.status(201).json({
        success: true,
        message:
          "Support ticket created successfully",
        ticket: supportTicket,
      });
    } catch (error) {
      console.error(
        "SUPPORT ERROR:",
        error,
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to submit support request",
      });
    }
  },
);

/*
|--------------------------------------------------------------------------
| SINGLE MARKET QUOTE
|--------------------------------------------------------------------------
*/

app.get(
  "/market/quote/:symbol",
  async (req, res) => {
    try {
      const { symbol } = req.params;

      const result =
        await getStockQuote(symbol);

      if (!result.success) {
        return res.status(500).json(result);
      }

      return res.status(200).json(result);
    } catch (error) {
      console.error(
        "MARKET QUOTE ROUTE ERROR:",
        error,
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to fetch market quote",
      });
    }
  },
);

/*
|--------------------------------------------------------------------------
| HISTORICAL MARKET DATA
|--------------------------------------------------------------------------
*/

app.get(
  "/market/history/:symbol",
  async (req, res) => {
    try {
      const { symbol } = req.params;

      const yahooSymbolMap = {
        INFY: "INFY.NS",
        ONGC: "ONGC.NS",
        TCS: "TCS.NS",
        KPITTECH: "KPITTECH.NS",
        QUICKHEAL: "QUICKHEAL.NS",
        WIPRO: "WIPRO.NS",
        "M&M": "M&M.NS",
        RELIANCE: "RELIANCE.NS",
        HUL: "HINDUNILVR.NS",
        HINDUNILVR: "HINDUNILVR.NS",
        SBIN: "SBIN.NS",
        ITC: "ITC.NS",
        BHARTIARTL: "BHARTIARTL.NS",
        TATAPOWER: "TATAPOWER.NS",
        HDFCBANK: "HDFCBANK.NS",
        EVEREADY: "EVEREADY.NS",
        JUBLFOOD: "JUBLFOOD.NS",
      };

      const yahooSymbol =
        yahooSymbolMap[symbol] ||
        `${symbol}.NS`;

      const result =
        await getStockHistory(yahooSymbol);

      if (!result.success) {
        return res.status(500).json(result);
      }

      return res.status(200).json(result);
    } catch (error) {
      console.error(
        "MARKET HISTORY ROUTE ERROR:",
        error,
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to fetch historical market data",
      });
    }
  },
);

/*
|--------------------------------------------------------------------------
| DATABASE CONNECTION
|--------------------------------------------------------------------------
*/

mongoose
  .connect(uri)
  .then(() => {
    console.log("DB connected!");

    app.listen(PORT, () => {
      console.log(
        `App Started on PORT ${PORT}`,
      );
    });
  })
  .catch((error) => {
    console.error(
      "DATABASE CONNECTION ERROR:",
      error,
    );
  });