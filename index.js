require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");

const { adminAuth } = require("./firebaseAdmin");

const { HoldingsModel } = require("./model/HoldingsModel");
const { PositionsModel } = require("./model/PositionsModel");
const { OrdersModel } = require("./model/OrdersModel");
const { UserModel } = require("./model/UserModel");
const { FundsModel } = require("./model/FundsModel");
const { FundTransactionModel } = require("./model/FundTransactionModel");

const PORT = process.env.PORT || 3002;
const uri = process.env.MONGO_URL;

const app = express();

app.use(
  cors({
    origin: ["http://localhost:3000", "http://localhost:3001"],
    credentials: true,
  }),
);

app.use(express.json());
app.use(cookieParser());

// ======================================================
// AUTHENTICATION MIDDLEWARE
// ======================================================

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

// ======================================================
// MARKET DATA
// ======================================================

const marketData = [
  {
    name: "INFY",
    price: 1555.45,
    percent: "-1.60%",
    isDown: true,
  },
  {
    name: "ONGC",
    price: 116.8,
    percent: "-0.09%",
    isDown: true,
  },
  {
    name: "TCS",
    price: 3194.8,
    percent: "-0.25%",
    isDown: true,
  },
  {
    name: "KPITTECH",
    price: 266.45,
    percent: "3.54%",
    isDown: false,
  },
  {
    name: "QUICKHEAL",
    price: 308.55,
    percent: "-0.15%",
    isDown: true,
  },
  {
    name: "WIPRO",
    price: 577.75,
    percent: "0.32%",
    isDown: false,
  },
  {
    name: "M&M",
    price: 779.8,
    percent: "-0.01%",
    isDown: true,
  },
  {
    name: "RELIANCE",
    price: 2112.4,
    percent: "1.44%",
    isDown: false,
  },
  {
    name: "HUL",
    price: 512.4,
    percent: "1.04%",
    isDown: false,
  },
  {
    name: "HINDUNILVR",
    price: 2417.4,
    percent: "0.21%",
    isDown: false,
  },
  {
    name: "SBIN",
    price: 430.2,
    percent: "-0.34%",
    isDown: true,
  },
  {
    name: "ITC",
    price: 207.9,
    percent: "0.80%",
    isDown: false,
  },
  {
    name: "BHARTIARTL",
    price: 541.15,
    percent: "2.99%",
    isDown: false,
  },
  {
    name: "TATAPOWER",
    price: 124.15,
    percent: "-0.24%",
    isDown: true,
  },
  {
    name: "HDFCBANK",
    price: 1522.35,
    percent: "0.11%",
    isDown: false,
  },
  {
    name: "SGBMAY29",
    price: 4719,
    percent: "0.15%",
    isDown: false,
  },
  {
    name: "EVEREADY",
    price: 312.35,
    percent: "-1.24%",
    isDown: true,
  },
  {
    name: "JUBLFOOD",
    price: 3082.65,
    percent: "-1.35%",
    isDown: true,
  },
];

// ======================================================
// SERVER TEST
// ======================================================

app.get("/", (req, res) => {
  res.send("Backend is running 🚀");
});

// ======================================================
// FIREBASE LOGIN
// ======================================================

app.post("/auth/firebase", async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({
        success: false,
        message: "Firebase ID token is required",
      });
    }

    const decodedToken = await adminAuth.verifyIdToken(idToken);

    let user = await UserModel.findOne({
      firebaseUid: decodedToken.uid,
    });

    if (!user) {
      user = new UserModel({
        firebaseUid: decodedToken.uid,
        phoneNumber: decodedToken.phone_number || "Not available",
      });

      await user.save();
    } else if (
      decodedToken.phone_number &&
      user.phoneNumber !== decodedToken.phone_number
    ) {
      user.phoneNumber = decodedToken.phone_number;

      await user.save();
    }

    // Create personal funds account for the user
    let funds = await FundsModel.findOne({
      userId: user._id,
    });

    if (!funds) {
      funds = new FundsModel({
        userId: user._id,
        availableBalance: 100000,
        totalDeposited: 100000,
        totalWithdrawn: 0,
      });

      await funds.save();
    }

    const sessionToken = jwt.sign(
      {
        userId: user._id.toString(),
        firebaseUid: user.firebaseUid,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      },
    );

    res.cookie("nivesha_session", sessionToken, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/",
    });

    return res.status(200).json({
      success: true,
      message: "User authenticated successfully",

      user: {
        id: user._id,
        name: user.name,
        phoneNumber: user.phoneNumber,
        accountType: user.accountType,
        tradingStatus: user.tradingStatus,
      },
    });
  } catch (error) {
    console.error("FIREBASE AUTHENTICATION ERROR:", error);

    return res.status(401).json({
      success: false,
      message: "Authentication failed",
    });
  }
});

// ======================================================
// CURRENT USER
// ======================================================

app.get("/auth/me", authenticateUser, async (req, res) => {
  return res.status(200).json({
    success: true,

    user: {
      id: req.user._id,
      name: req.user.name,
      phoneNumber: req.user.phoneNumber,
      accountType: req.user.accountType,
      tradingStatus: req.user.tradingStatus,
    },
  });
});

// ======================================================
// LOGOUT
// ======================================================

app.post("/auth/logout", (req, res) => {
  res.clearCookie("nivesha_session", {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    path: "/",
  });

  return res.status(200).json({
    success: true,
    message: "Logged out successfully",
  });
});

// ======================================================
// MARKET DATA ROUTE
// ======================================================

app.get("/market-data", (req, res) => {
  res.json(marketData);
});

// ======================================================
// GET USER FUNDS
// ======================================================

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

// ======================================================
// ADD FUNDS
// ======================================================

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

    funds.availableBalance = Number(funds.availableBalance) + amount;

    funds.totalDeposited = Number(funds.totalDeposited) + amount;

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

// ======================================================
// WITHDRAW FUNDS
// ======================================================

app.post("/withdrawFunds", authenticateUser, async (req, res) => {
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

    funds.availableBalance = Number(funds.availableBalance) - amount;

    funds.totalWithdrawn = Number(funds.totalWithdrawn) + amount;

    await funds.save();

    await FundTransactionModel.create({
      userId,
      type: "WITHDRAWAL",
      amount,
      description: "Funds withdrawn from trading account",
      balanceAfter: funds.availableBalance,
    });

    return res.json({
      success: true,
      message: "Funds withdrawn successfully",
      funds,
    });
  } catch (error) {
    console.error("WITHDRAW FUNDS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to withdraw funds",
    });
  }
});

// ======================================================
// GET USER FUND TRANSACTIONS
// ======================================================

app.get("/fund-transactions", authenticateUser, async (req, res) => {
  try {
    const transactions = await FundTransactionModel.find({
      userId: req.user._id,
    }).sort({
      createdAt: -1,
    });

    return res.json(transactions);
  } catch (error) {
    console.error("FUND TRANSACTION FETCH ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch fund transactions",
    });
  }
});

// ======================================================
// GET USER HOLDINGS
// ======================================================

app.get("/allHoldings", authenticateUser, async (req, res) => {
  try {
    const allHoldings = await HoldingsModel.find({
      userId: req.user._id,
    });

    return res.json(allHoldings);
  } catch (error) {
    console.error("HOLDINGS FETCH ERROR:", error);

    return res.status(500).json({
      message: "Unable to fetch holdings",
    });
  }
});

// ======================================================
// GET USER POSITIONS
// ======================================================

app.get("/allPositions", authenticateUser, async (req, res) => {
  try {
    const allPositions = await PositionsModel.find({
      userId: req.user._id,
    });

    return res.json(allPositions);
  } catch (error) {
    console.error("POSITIONS FETCH ERROR:", error);

    return res.status(500).json({
      message: "Unable to fetch positions",
    });
  }
});

// ======================================================
// GET USER ORDERS
// ======================================================

app.get("/allOrders", authenticateUser, async (req, res) => {
  try {
    const orders = await OrdersModel.find({
      userId: req.user._id,
    }).sort({
      createdAt: -1,
    });

    return res.json(orders);
  } catch (error) {
    console.error("ORDERS FETCH ERROR:", error);

    return res.status(500).json({
      message: "Unable to fetch orders",
    });
  }
});

// ======================================================
// PLACE NEW ORDER
// ======================================================

app.post("/newOrder", authenticateUser, async (req, res) => {
  try {
    let { name, qty, price, mode, product = "CNC" } = req.body;

    name = name?.trim().toUpperCase();

    qty = Number(qty);

    price = Number(price);

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
        message: "Quantity must be a positive whole number",
      });
    }

    if (!Number.isFinite(price) || price <= 0) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid stock price",
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
      existingStock = await HoldingsModel.findOne({
        userId,
        name,
      });
    } else {
      existingStock = await PositionsModel.findOne({
        userId,
        name,
        product: "MIS",
      });
    }

    // BUY VALIDATION

    if (mode === "BUY") {
      if (orderValue > Number(funds.availableBalance)) {
        return res.status(400).json({
          success: false,
          message: "Insufficient available balance",
        });
      }
    }

    // SELL VALIDATION

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

    // CALCULATE REALIZED P&L

    let realizedPnL = 0;

    if (mode === "SELL") {
      realizedPnL = (price - Number(existingStock.avg)) * qty;
    }

    // CREATE ORDER

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

    // ==================================================
    // BUY ORDER
    // ==================================================

    if (mode === "BUY") {
      funds.availableBalance = Number(funds.availableBalance) - orderValue;

      await funds.save();

      // Record BUY fund transaction
      await FundTransactionModel.create({
        userId,
        type: "BUY",
        amount: orderValue,
        stockName: name,
        quantity: qty,
        description: `${product} BUY - ${qty} shares of ${name}`,
        balanceAfter: funds.availableBalance,
      });

      // UPDATE EXISTING STOCK

      if (existingStock) {
        const oldQuantity = Number(existingStock.qty);

        const oldAverage = Number(existingStock.avg);

        const totalQuantity = oldQuantity + qty;

        const totalCost = oldAverage * oldQuantity + price * qty;

        existingStock.qty = totalQuantity;

        existingStock.avg = totalCost / totalQuantity;

        existingStock.price = price;

        await existingStock.save();
      }

      // CREATE CNC HOLDING
      else if (product === "CNC") {
        const newHolding = new HoldingsModel({
          userId,
          name,
          qty,
          avg: price,
          price,
          net: "0%",
          day: "0%",
        });

        await newHolding.save();
      }

      // CREATE MIS POSITION
      else {
        const newPosition = new PositionsModel({
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

    // ==================================================
    // SELL ORDER
    // ==================================================

    if (mode === "SELL") {
      funds.availableBalance = Number(funds.availableBalance) + orderValue;

      await funds.save();

      // Record SELL fund transaction
      await FundTransactionModel.create({
        userId,
        type: "SELL",
        amount: orderValue,
        stockName: name,
        quantity: qty,
        description: `${product} SELL - ${qty} shares of ${name}`,
        balanceAfter: funds.availableBalance,
      });

      const remainingQuantity = Number(existingStock.qty) - qty;

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
        existingStock.qty = remainingQuantity;

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
    console.error("ORDER ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to process order",
    });
  }
});

// ======================================================
// CANCEL USER ORDER
// ======================================================

app.post("/cancelOrder", authenticateUser, async (req, res) => {
  try {
    const { id } = req.body;

    const order = await OrdersModel.findOne({
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
        message: "Completed orders cannot be cancelled",
      });
    }

    order.status = "CANCELLED";

    await order.save();

    return res.json({
      success: true,
      message: "Order cancelled successfully",
    });
  } catch (error) {
    console.error("CANCEL ORDER ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to cancel order",
    });
  }
});

// ======================================================
// DATABASE CONNECTION
// ======================================================

mongoose
  .connect(uri)
  .then(() => {
    console.log("DB connected!");

    app.listen(PORT, () => {
      console.log(`App Started on PORT ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("DATABASE CONNECTION ERROR:", error);
  });
