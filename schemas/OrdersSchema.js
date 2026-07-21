const { Schema } = require("mongoose");

const OrdersSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "user",
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
    },

    qty: {
      type: Number,
      required: true,
    },

    price: {
      type: Number,
      required: true,
    },

    mode: {
      type: String,
      enum: ["BUY", "SELL"],
      required: true,
    },

    product: {
      type: String,
      enum: ["CNC", "MIS"],
      default: "CNC",
    },

    status: {
      type: String,
      default: "COMPLETED",
    },

    realizedPnL: {
      type: Number,
      default: 0,
    },

    time: {
      type: String,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = { OrdersSchema };
