const { Schema } = require("mongoose");

const FundsSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "user",
      required: true,
      unique: true,
      index: true,
    },

    availableBalance: {
      type: Number,
      default: 100000,
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
