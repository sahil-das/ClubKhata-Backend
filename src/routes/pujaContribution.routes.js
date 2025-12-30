const router = require("express").Router();
const ctrl = require("../controllers/pujaContribution.controller");
const auth = require("../middleware/auth.middleware");
const admin = require("../middleware/admin.middleware");

router.use(auth);

router.get("/", ctrl.list);
router.post("/", admin, ctrl.create);
router.get(
  "/member/:memberId",
  ctrl.memberTotal
);
// 🔥 SUMMARY (FAST)
router.get("/summary", ctrl.summary);
module.exports = router;
