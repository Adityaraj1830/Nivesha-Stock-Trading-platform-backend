const { Schema } = require("mongoose");

const UserSchema = new Schema(
  {
    firebaseUid: {
      type: String,
      required: true,
      unique: true,
    },

    phoneNumber: {
      type: String,
      required: true,
    },

    name: {
      type: String,
      default: "Nivesha User",
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
