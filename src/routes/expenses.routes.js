const express = require("express");
const router = express.Router();

const expenseCtrl = require("../controllers/expense.controller");
const auth = require("../middleware/auth.middleware");
const adminOnly = require("../middleware/admin.middleware");

router.use(auth);

// LIST expenses
router.get("/", expenseCtrl.list);

// CREATE expense
router.post("/", expenseCtrl.create);

// APPROVE expense (ADMIN ONLY)
router.put("/:id/approve", adminOnly, expenseCtrl.approve);

module.exports = router;
