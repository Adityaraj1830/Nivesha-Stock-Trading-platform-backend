const { Schema } = require("mongoose");

const PositionsSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "user",
      required: true,
      index: true,
    },

    product: {
      type: String,
      default: "MIS",
    },

    name: {
      type: String,
      required: true,
    },

    qty: {
      type: Number,
      required: true,
    },

    avg: {
      type: Number,
      required: true,
    },

    price: {
      type: Number,
      required: true,
    },

    net: {
      type: String,
      default: "0%",
    },

    day: {
      type: String,
      default: "0%",
    },

    isLoss: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = { PositionsSchema };
