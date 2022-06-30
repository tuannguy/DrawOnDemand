var express = require('express');
var router = express.Router();

// Require controller modules.
var imageController = require('../controllers/imageController');

router.get('/getImage/:subject', imageController.GetImage);

module.exports = router;