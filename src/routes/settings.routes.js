// src/routes/settings.routes.js
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth.middleware");
const admin = require("../middleware/admin.middleware");
const ctrl = require("../controllers/settings.controller");

router.use(auth, admin);

router.get("/", ctrl.getSettings);
router.put("/", ctrl.updateSettings);
router.post("/close-year", ctrl.closeYear);

module.exports = router;
