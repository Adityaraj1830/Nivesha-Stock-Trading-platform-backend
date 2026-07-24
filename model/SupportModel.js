const mongoose = require("mongoose");

const { SupportSchema } = require("../schemas/SupportSchema");

const SupportModel = mongoose.model("Support", SupportSchema);

module.exports = { SupportModel };
