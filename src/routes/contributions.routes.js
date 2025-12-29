const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth.middleware");
const checkYearOpen = require("../middleware/checkYearOpen");

const weeklyCtrl = require("../controllers/weeklyContribution.controller");
const pujaCtrl = require("../controllers/pujaContribution.controller");

router.use(auth);

// WEEKLY
router.get("/weekly", weeklyCtrl.list);
router.post("/weekly", checkYearOpen, weeklyCtrl.create);

// PUJA
router.get("/puja", pujaCtrl.list);
router.post("/puja", checkYearOpen, pujaCtrl.create);

module.exports = router;
