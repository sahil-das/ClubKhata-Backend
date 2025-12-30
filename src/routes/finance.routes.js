const router = require("express").Router();
const financeCtrl = require("../controllers/finance.controller");
const auth = require("../middleware/auth.middleware");

router.get("/central-fund", auth, financeCtrl.getCentralFund);

module.exports = router;
