const express = require('express');
const router = express.Router();
const donationCtrl = require('../controllers/donation.controller');
const auth = require('../middleware/auth.middleware');

router.use(auth);
router.get('/', donationCtrl.list);
router.post('/', donationCtrl.create);

module.exports = router;
