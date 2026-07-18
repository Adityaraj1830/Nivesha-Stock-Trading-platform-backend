require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const { HoldingsModel } = require("./model/HoldingsModel");
const { PositionsModel } = require("./model/PositionsModel");
const { OrdersModel } = require("./model/OrdersModel");

const PORT = process.env.PORT || 3002;
const uri = process.env.MONGO_URL;

const app = express();

app.use(cors());
app.use(express.json());

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
    price: 4719.0,
    percent: "0.15%",
    isDown: false,
  },
];

app.get("/", (req, res) => {
  res.send("Backend is running 🚀");
});

app.get("/market-data", (req, res) => {
  res.json(marketData);
});

app.get("/allHoldings", async (req, res) => {
  try {
    const allHoldings = await HoldingsModel.find({});
    res.json(allHoldings);
  } catch (error) {
    console.error("HOLDINGS FETCH ERROR:", error);

    res.status(500).json({
      message: "Unable to fetch holdings",
    });
  }
});

app.get("/allPositions", async (req, res) => {
  try {
    const allPositions = await PositionsModel.find({});
    res.json(allPositions);
  } catch (error) {
    console.error("POSITIONS FETCH ERROR:", error);

    res.status(500).json({
      message: "Unable to fetch positions",
    });
  }
});

app.get("/allOrders", async (req, res) => {
  try {
    const orders = await OrdersModel.find({}).sort({ _id: -1 });
    res.json(orders);
  } catch (error) {
    console.error("ORDERS FETCH ERROR:", error);

    res.status(500).json({
      message: "Unable to fetch orders",
    });
  }
});

app.post("/newOrder", async (req, res) => {
  try {
    let { name, qty, price, mode } = req.body;

    name = name?.trim().toUpperCase();
    qty = Number(qty);
    price = Number(price);
    mode = mode?.trim().toUpperCase();

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

    const existingStock = await HoldingsModel.findOne({ name });

    if (mode === "SELL") {
      if (!existingStock) {
        return res.status(400).json({
          success: false,
          message: `You do not own any shares of ${name}`,
        });
      }

      if (qty > existingStock.qty) {
        return res.status(400).json({
          success: false,
          message: `You only own ${existingStock.qty} shares of ${name}`,
        });
      }
    }

    let realizedPnL = 0;

    if (mode === "SELL") {
      realizedPnL = (price - Number(existingStock.avg)) * qty;
    }

    const newOrder = new OrdersModel({
      name,
      qty,
      price,
      mode,
      status: "COMPLETED",
      realizedPnL,
      time: new Date().toLocaleTimeString(),
    });

    await newOrder.save();

    if (mode === "BUY") {
      if (existingStock) {
        const oldQuantity = Number(existingStock.qty);
        const oldAverage = Number(existingStock.avg);

        const totalQuantity = oldQuantity + qty;

        const totalCost = oldAverage * oldQuantity + price * qty;

        existingStock.qty = totalQuantity;
        existingStock.avg = totalCost / totalQuantity;

        await existingStock.save();
      } else {
        const newHolding = new HoldingsModel({
          name,
          qty,
          avg: price,
          price,
          net: "0%",
          day: "0%",
        });

        await newHolding.save();
      }
    }

    if (mode === "SELL") {
      const remainingQuantity = Number(existingStock.qty) - qty;

      if (remainingQuantity === 0) {
        await HoldingsModel.findByIdAndDelete(existingStock._id);
      } else {
        existingStock.qty = remainingQuantity;
        await existingStock.save();
      }
    }

    return res.status(201).json({
      success: true,
      message: `${mode} order executed successfully`,
      order: newOrder,
    });
  } catch (error) {
    console.error("ORDER ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to process order",
    });
  }
});

app.post("/cancelOrder", async (req, res) => {
  try {
    const { id } = req.body;

    const order = await OrdersModel.findById(id);

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
