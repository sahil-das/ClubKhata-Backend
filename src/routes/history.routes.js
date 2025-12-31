const router = require("express").Router();
const auth = require("../middleware/auth.middleware");
const admin = require("../middleware/admin.middleware");
const historyController = require("../controllers/history.controller");

router.use(auth, admin);

// SUMMARY
router.get("/:year/summary", historyController.yearSummary);

// DETAILS
router.get("/:year/weekly", historyController.weekly);
router.get("/:year/puja", historyController.puja);
router.get("/:year/donations", historyController.donations);
router.get("/:year/expenses", historyController.expenses);

module.exports = router;
