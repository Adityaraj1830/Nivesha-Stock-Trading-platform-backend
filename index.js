require('dotenv').config();

const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");

const { HoldingsModel } = require("./model/HoldingsModel");
const { PositionsModel } = require("./model/PositionsModel");
const { OrdersModel } = require("./model/OrdersModel");

const PORT = process.env.PORT || 3002;
const uri = process.env.MONGO_URL;

const app = express();

app.use(cors());
app.use(bodyParser.json());

app.get("/", (req, res) => {
  res.send("Backend is running 🚀");
});


// ================= HOLDINGS =================
app.get("/allHoldings", async (req, res) => {
  const allHoldings = await HoldingsModel.find({});
  res.json(allHoldings);
});


// ================= POSITIONS =================
app.get("/allPositions", async (req, res) => {
  const allPositions = await PositionsModel.find({});
  res.json(allPositions);
});


// ================= ORDERS =================
app.get("/allOrders", async (req, res) => {
  const orders = await OrdersModel.find({});
  res.json(orders);
});


// ================= BUY / SELL ORDER =================
app.post('/newOrder', async (req, res) => {
  try {
    const { name, qty, price, mode } = req.body;

    // 1️⃣ Save Order
    const newOrder = new OrdersModel({
      name,
      qty,
      price,
      mode,
      status: "COMPLETED",   // directly executed
      time: new Date().toLocaleTimeString(),
    });

    await newOrder.save();


    // 2️⃣ HANDLE BUY
    if (mode === "BUY") {
      let existingStock = await HoldingsModel.findOne({ name });

      if (existingStock) {
        const totalQty = existingStock.qty + qty;
        const totalCost =
          existingStock.avg * existingStock.qty + price * qty;

        existingStock.avg = totalCost / totalQty;
        existingStock.qty = totalQty;
        existingStock.price = price;

        await existingStock.save();
      } else {
        const newHolding = new HoldingsModel({
          name,
          qty,
          avg: price,
          price: price,
          net: "0%",
          day: "0%",
        });

        await newHolding.save();
      }
    }


    // 3️⃣ HANDLE SELL
    if (mode === "SELL") {
      let existingStock = await HoldingsModel.findOne({ name });

      if (existingStock) {
        const remainingQty = existingStock.qty - qty;

        if (remainingQty > 0) {
          existingStock.qty = remainingQty;
          existingStock.price = price;
          await existingStock.save();
        } else {
          // remove stock completely
          await HoldingsModel.deleteOne({ name });
        }
      }
    }

    res.send("Order executed & holdings updated ✅");

  } catch (err) {
    console.error(err);
    res.status(500).send("Error processing order");
  }
});


// ================= CANCEL ORDER =================
app.post("/cancelOrder", async (req, res) => {
  const { id } = req.body;

  await OrdersModel.findByIdAndUpdate(id, {
    status: "CANCELLED",
  });

  res.send("Order cancelled");
});

mongoose.connect(uri)
  .then(() => {
    console.log("DB connected!");
    app.listen(PORT, () => {
      console.log("App Started on PORT", PORT);
    });
  })
  .catch(err => console.log(err));