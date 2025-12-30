const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth.middleware");
const reportCtrl = require("../controllers/reports.controller");

router.use(auth);

router.get("/weekly-total", reportCtrl.weeklyTotal);
router.get("/donations-total", reportCtrl.donationTotal);
router.get("/expenses-total", reportCtrl.expenseTotal);
router.get("/puja-total", reportCtrl.pujaTotal);

module.exports = router;
