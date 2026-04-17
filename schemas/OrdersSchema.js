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
  time: {
    type: String,
    default: () => new Date().toLocaleTimeString(),
  },
});

module.exports = { OrdersSchema };