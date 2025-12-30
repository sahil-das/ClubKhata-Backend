const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth.middleware");
const donationCtrl = require("../controllers/donation.controller");

router.use(auth);

router.get("/", donationCtrl.list);
router.post("/", donationCtrl.create);

module.exports = router;
