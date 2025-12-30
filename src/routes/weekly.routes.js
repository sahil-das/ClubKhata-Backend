const router = require("express").Router();
const weeklyController = require("../controllers/weekly.controller");
const auth = require("../middleware/auth.middleware");
const admin = require("../middleware/admin.middleware");

router.post("/pay", auth, admin, weeklyController.pay);
router.post("/undo/:id", auth, admin, weeklyController.undo);
router.get(
  "/member/:userId",
  auth,
  weeklyController.memberStatus
);

module.exports = router;
