const { Schema } = require("mongoose");

const FundsSchema = new Schema(
  {
    availableBalance: {
      type: Number,
      default: 100000,
      min: 0,
    },

    totalDeposited: {
      type: Number,
      default: 100000,
    },

    totalWithdrawn: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = { FundsSchema };
