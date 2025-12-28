const express = require('express');
const router = express.Router();
const memberCtrl = require('../controllers/member.controller');
const auth = require('../middleware/auth.middleware');

router.use(auth);
router.get('/', memberCtrl.list);
router.get('/:id', memberCtrl.get);

module.exports = router;
