const { Schema } = require("mongoose");

const FundTransactionSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "user",
      required: true,
      index: true,
    },

    type: {
      type: String,
      enum: ["DEPOSIT", "WITHDRAWAL", "BUY", "SELL"],
      required: true,
    },

    amount: {
      type: Number,
      required: true,
    },

    stockName: {
      type: String,
      default: null,
    },

    quantity: {
      type: Number,
      default: null,
    },

    description: {
      type: String,
      required: true,
    },

    balanceAfter: {
      type: Number,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = { FundTransactionSchema };
