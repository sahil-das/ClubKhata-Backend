const express = require('express');
const router = express.Router();
const reportCtrl = require('../controllers/report.controller');
const auth = require('../middleware/auth.middleware');

router.use(auth);
router.get('/summary', reportCtrl.getSummary);

module.exports = router;
