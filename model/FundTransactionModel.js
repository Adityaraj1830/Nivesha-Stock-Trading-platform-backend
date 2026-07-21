const { model } = require("mongoose");

const { FundTransactionSchema } = require("../schemas/FundTransactionSchema");

const FundTransactionModel = model("fundTransaction", FundTransactionSchema);

module.exports = { FundTransactionModel };
