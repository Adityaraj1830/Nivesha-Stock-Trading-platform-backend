const { Schema } = require("mongoose");

const UserSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },

    password: {
      type: String,
      required: true,
    },

    accountType: {
      type: String,
      default: "Individual",
    },

    tradingStatus: {
      type: String,
      default: "Active",
    },
  },
  {
    timestamps: true,
  },
);

module.exports = { UserSchema };
