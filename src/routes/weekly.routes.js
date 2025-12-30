const router = require("express").Router();
const weeklyController = require("../controllers/weekly.controller");
const auth = require("../middleware/auth.middleware");
const admin = require("../middleware/admin.middleware");

// get weekly status
router.get(
  "/member/:memberId",
  auth,
  weeklyController.getMemberWeeklyStatus
);

// mark paid (admin only)
router.post(
  "/mark-paid",
  auth,
  admin,
  weeklyController.markWeekPaid
);

// undo paid (admin only)
router.post(
  "/undo-paid",
  auth,
  admin,
  weeklyController.undoWeekPaid
);

module.exports = router;
