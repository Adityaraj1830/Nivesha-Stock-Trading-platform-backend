const { Schema } = require("mongoose");

const OrdersSchema = new Schema({
  name: String,
  qty: Number,
  price: Number,
  mode: String,

  status: {
    type: String,
    default: "PENDING",
  },

  realizedPnL: {
    type: Number,
    default: 0,
  },

  time: {
    type: String,
    default: () => new Date().toLocaleTimeString(),
  },
});

module.exports = { OrdersSchema };
