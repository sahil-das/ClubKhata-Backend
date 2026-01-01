const router = require("express").Router();
const auth = require("../middleware/auth.middleware");
const admin = require("../middleware/admin.middleware");
const settingsController = require("../controllers/settings.controller");

router.get("/", auth, admin, settingsController.get);
router.put("/", auth, admin, settingsController.update);
router.post("/close-year", auth, admin, settingsController.closeYear);

module.exports = router;
