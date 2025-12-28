const express = require('express');
const router = express.Router();
const contribCtrl = require('../controllers/contribution.controller');
const auth = require('../middleware/auth.middleware');

router.use(auth);
router.get('/weekly', contribCtrl.listWeekly);
router.get('/puja', contribCtrl.listPuja);

module.exports = router;
