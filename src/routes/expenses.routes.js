const express = require('express');
const router = express.Router();
const expenseCtrl = require('../controllers/expense.controller');
const auth = require('../middleware/auth.middleware');

router.use(auth);
router.get('/', expenseCtrl.list);
router.post('/', expenseCtrl.create);

module.exports = router;
