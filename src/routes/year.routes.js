const express = require('express');
const router = express.Router();
const yearCtrl = require('../controllers/year.controller');
const auth = require('../middleware/auth.middleware');
const adminOnly = require('../middleware/admin.middleware');

router.use(auth);
router.get('/', yearCtrl.list);
router.post('/', adminOnly, yearCtrl.create);

module.exports = router;
