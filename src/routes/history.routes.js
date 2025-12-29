const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth.middleware");
const historyCtrl = require("../controllers/history.controller");

router.use(auth);

// GET year-wise history summary
router.get("/:year", historyCtrl.getYearSummary);

module.exports = router;
